-- =============================================================================
-- 0005 — Fonctions et triggers
-- Step by Step Coaching
--
-- Cinq blocs : outillage, triggers, parcours cliente, gestes d'Oriane,
-- Stripe et jobs. Les GRANT EXECUTE sont regroupes tout en bas.
--
-- Toutes les fonctions sont SECURITY DEFINER avec search_path fige. Elles sont
-- donc executees par le proprietaire des tables, qui contourne la RLS : c'est
-- exactement ce qu'on veut, puisque `authenticated` n'a AUCUN privilege
-- d'ecriture sur bookings, credit_lots ni credit_movements. Le controle d'acces
-- ne vient pas de la RLS ici, il vient de deux choses :
--   * le GRANT EXECUTE, qui dit qui peut appeler quoi,
--   * le garde is_admin() en tete des fonctions d'administration.
--
-- Codes d'erreur, a traduire cote interface (le message porte deja le texte
-- francais, le code sert a router) :
--   SB001  plus aucune seance disponible
--   SB002  le solde expire avant la date du cours
--   SB003  cours complet
--   SB004  cours annule
--   SB005  cours deja commence ou passe
--   SB006  deja inscrite a ce cours
--   SB007  delai d'annulation depasse
--   SB008  objet introuvable, ou qui ne t'appartient pas
--   SB009  action reservee, ou session absente
--   SB010  solde insuffisant pour ce retrait manuel
--   SB011  commande non payee
--   SB012  formule deja vendue, prix immuable (regle 10)
--   SB013  capacite reduite sous le nombre d'inscrites
-- =============================================================================


-- ===========================================================================
-- BLOC 1 — OUTILLAGE
-- ===========================================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;


-- Journal des gestes d'administration. Appelee uniquement depuis d'autres
-- fonctions SECURITY DEFINER : jamais exposee directement.
create or replace function public.log_audit(
  p_action       text,
  p_entity_table text,
  p_entity_id    uuid,
  p_before       jsonb default null,
  p_after        jsonb default null
)
returns void
language sql
security definer
set search_path = public, extensions, pg_temp
as $$
  insert into public.audit_log (actor_id, action, entity_table, entity_id, before, after)
  values (auth.uid(), p_action, p_entity_table, p_entity_id, p_before, p_after);
$$;


-- ===========================================================================
-- BLOC 2 — TRIGGERS
-- ===========================================================================

-- --- Creation du profil a l'inscription ------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  insert into public.profiles (id, email, first_name, last_name, phone)
  values (
    new.id,
    new.email,
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'first_name'), ''), 'Prenom'),
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'last_name'),  ''), 'Nom'),
    nullif(btrim(new.raw_user_meta_data ->> 'phone'), '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

comment on function public.handle_new_user() is
  'Les valeurs de repli « Prenom » / « Nom » ne sont pas de la coquetterie : '
  'first_name et last_name sont NOT NULL et non vides. Si ce trigger levait une '
  'exception, l''inscription entiere echouerait. Le formulaire d''inscription '
  'fournit toujours les deux ; ces valeurs signalent un profil a completer.';

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- --- Miroir de l'email -----------------------------------------------------

create or replace function public.sync_profile_email()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  if new.email is distinct from old.email then
    update public.profiles
       set email = new.email, updated_at = now()
     where id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_changed on auth.users;
create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row execute function public.sync_profile_email();


-- --- Regle 10 : prix immuables ---------------------------------------------

create or replace function public.plans_guard_immutable()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  if (new.price_cents       is distinct from old.price_cents
   or new.sessions_count    is distinct from old.sessions_count
   or new.validity_interval is distinct from old.validity_interval
   or new.kind              is distinct from old.kind)
   and exists (select 1 from public.orders where plan_id = old.id)
  then
    raise exception
      'Cette formule a deja ete vendue : son prix, son nombre de seances, sa validite et son type ne se modifient plus. Cree une nouvelle formule et archive celle-ci.'
      using errcode = 'SB012';
  end if;
  return new;
end;
$$;

drop trigger if exists plans_guard_immutable_trg on public.plans;
create trigger plans_guard_immutable_trg
  before update on public.plans
  for each row execute function public.plans_guard_immutable();


-- --- Capacite : jamais sous le nombre d'inscrites --------------------------
--
-- Sans ce trigger, reduire la capacite d'un cours deja rempli violerait la
-- contrainte courses_seats_range et remonterait une exception Postgres brute
-- jusqu'a Oriane. Meme logique que courses_no_overlap : la base refuse, mais
-- c'est ici que la phrase francaise est ecrite.

create or replace function public.courses_guard_capacity()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  if new.capacity < old.seats_taken then
    raise exception
      'Ce cours a deja % inscrite(s) : tu ne peux pas descendre en dessous. Desinscris quelqu''un d''abord, ou garde % places.',
      old.seats_taken, old.seats_taken
      using errcode = 'SB013';
  end if;
  return new;
end;
$$;

drop trigger if exists courses_guard_capacity_trg on public.courses;
create trigger courses_guard_capacity_trg
  before update of capacity on public.courses
  for each row execute function public.courses_guard_capacity();


-- --- seats_taken -----------------------------------------------------------

create or replace function public.bookings_sync_seats()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    if new.status = 'booked' then
      update public.courses set seats_taken = seats_taken + 1 where id = new.course_id;
    end if;
    return new;

  elsif tg_op = 'UPDATE' then
    if new.course_id is distinct from old.course_id then
      raise exception 'Une reservation ne change pas de cours. Annule et reserve a nouveau.'
        using errcode = 'SB008';
    end if;
    if old.status = 'booked' and new.status <> 'booked' then
      update public.courses set seats_taken = seats_taken - 1 where id = new.course_id;
    elsif old.status <> 'booked' and new.status = 'booked' then
      update public.courses set seats_taken = seats_taken + 1 where id = new.course_id;
    end if;
    return new;

  else
    if old.status = 'booked' then
      update public.courses set seats_taken = seats_taken - 1 where id = old.course_id;
    end if;
    return old;
  end if;
end;
$$;

comment on function public.bookings_sync_seats() is
  'seats_taken est denormalise pour que la vitrine publique affiche « 7 places » '
  'sans jamais lire bookings. La contrainte courses_seats_range est le filet : '
  'si ce trigger derivait, l''ecriture echouerait au lieu de mentir.';

drop trigger if exists bookings_sync_seats_trg on public.bookings;
create trigger bookings_sync_seats_trg
  after insert or update or delete on public.bookings
  for each row execute function public.bookings_sync_seats();


-- --- updated_at ------------------------------------------------------------

drop trigger if exists profiles_set_updated_at      on public.profiles;
drop trigger if exists plans_set_updated_at         on public.plans;
drop trigger if exists subscriptions_set_updated_at on public.subscriptions;
drop trigger if exists orders_set_updated_at        on public.orders;
drop trigger if exists courses_set_updated_at       on public.courses;

create trigger profiles_set_updated_at      before update on public.profiles      for each row execute function public.set_updated_at();
create trigger plans_set_updated_at         before update on public.plans         for each row execute function public.set_updated_at();
create trigger subscriptions_set_updated_at before update on public.subscriptions for each row execute function public.set_updated_at();
create trigger orders_set_updated_at        before update on public.orders        for each row execute function public.set_updated_at();
create trigger courses_set_updated_at       before update on public.courses       for each row execute function public.set_updated_at();


-- ===========================================================================
-- BLOC 3 — PARCOURS CLIENTE
-- ===========================================================================

-- --- book_course : le coeur du modele --------------------------------------

create or replace function public.book_course(p_course_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_user_id    uuid := auth.uid();
  v_course     public.courses%rowtype;
  v_lot_id     uuid;
  v_booking_id uuid;
begin
  if v_user_id is null then
    raise exception 'Connecte-toi pour reserver ta place.' using errcode = 'SB009';
  end if;

  -- Verrou 1 : le cours. Il serialise la verification de capacite et empeche
  -- deux inscriptions simultanees de depasser le nombre de places.
  select * into v_course from public.courses where id = p_course_id for update;

  if not found then
    raise exception 'Ce cours n''existe pas.' using errcode = 'SB008';
  end if;
  if v_course.status = 'canceled' then
    raise exception 'Ce cours a ete annule.' using errcode = 'SB004';
  end if;
  if v_course.starts_at <= now() then
    raise exception 'Ce cours a deja commence.' using errcode = 'SB005';
  end if;
  if v_course.seats_taken >= v_course.capacity then
    raise exception 'Ce cours est complet.' using errcode = 'SB003';
  end if;
  if exists (
    select 1 from public.bookings
     where course_id = p_course_id and user_id = v_user_id and status = 'booked'
  ) then
    raise exception 'Tu es deja inscrite a ce cours.' using errcode = 'SB006';
  end if;

  -- Verrou 2 : TOUS les lots ouverts de la cliente, pas seulement celui qu'on
  -- va choisir. Un FOR UPDATE pose sur un SELECT ... LIMIT 1 rendrait un
  -- resultat vide si le lot elu venait d'etre vide par une transaction
  -- concurrente, au lieu de passer au suivant. En verrouillant d'abord, le
  -- choix se fait sur un etat stable.
  -- L'ordre des verrous est le meme dans toutes les fonctions : cours, puis
  -- lots. C'est ce qui evite les interblocages.
  perform 1
    from public.credit_lots
   where user_id = v_user_id
     and quantity_remaining > 0
     and closed_at is null
   for update;

  -- Regle 5 : le lot doit couvrir la date du cours.
  -- Regle 4 : parmi ceux qui la couvrent, celui qui expire le plus tot.
  select id into v_lot_id
    from public.credit_lots
   where user_id = v_user_id
     and quantity_remaining > 0
     and closed_at is null
     and expires_at > now()
     and expires_at >= v_course.starts_at
   order by expires_at, issued_at
   limit 1;

  if v_lot_id is null then
    -- Distinguer les deux causes : « tu n'as plus rien » et « tu as des
    -- seances, mais elles expirent avant ce cours-la » n'appellent pas la
    -- meme action de la part de la cliente.
    if exists (
      select 1 from public.credit_lots
       where user_id = v_user_id and quantity_remaining > 0
         and closed_at is null and expires_at > now()
    ) then
      raise exception 'Tes seances expirent avant ce cours. Reserve un cours plus tot, ou recharge ton solde.'
        using errcode = 'SB002';
    else
      raise exception 'Tu n''as plus de seance disponible. Choisis une formule pour recharger ton solde.'
        using errcode = 'SB001';
    end if;
  end if;

  update public.credit_lots
     set quantity_remaining = quantity_remaining - 1
   where id = v_lot_id;

  insert into public.bookings (course_id, user_id, credit_lot_id)
  values (p_course_id, v_user_id, v_lot_id)
  returning id into v_booking_id;

  insert into public.credit_movements (user_id, credit_lot_id, delta, reason, booking_id)
  values (v_user_id, v_lot_id, -1, 'booking', v_booking_id);

  return v_booking_id;
end;
$$;


-- --- cancel_booking : annulation par la cliente ----------------------------

create or replace function public.cancel_booking(p_booking_id uuid)
returns void
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_user_id  uuid := auth.uid();
  v_booking  public.bookings%rowtype;
  v_course   public.courses%rowtype;
  v_lot      public.credit_lots%rowtype;
  v_hours    integer;
begin
  if v_user_id is null then
    raise exception 'Connecte-toi pour gerer tes reservations.' using errcode = 'SB009';
  end if;

  select * into v_booking from public.bookings where id = p_booking_id;
  if not found or v_booking.user_id <> v_user_id then
    raise exception 'Cette reservation n''existe pas.' using errcode = 'SB008';
  end if;
  if v_booking.status <> 'booked' then
    raise exception 'Cette reservation est deja annulee.' using errcode = 'SB008';
  end if;

  select * into v_course from public.courses where id = v_booking.course_id for update;

  -- Regle 6 : le delai vient de la formule qui a finance la seance, jamais
  -- d'une constante. Un lot cree a la main par Oriane n'a pas de formule :
  -- 24 h par defaut.
  select coalesce(p.cancellation_deadline_hours, 24)
    into v_hours
    from public.credit_lots l
    left join public.plans p on p.id = l.plan_id
   where l.id = v_booking.credit_lot_id;

  if now() > v_course.starts_at - make_interval(hours => v_hours) then
    raise exception
      'Trop tard pour annuler : il faut s''y prendre au moins % h avant le cours. Ta seance reste decomptee.',
      v_hours using errcode = 'SB007';
  end if;

  select * into v_lot from public.credit_lots where id = v_booking.credit_lot_id for update;

  update public.bookings
     set status = 'canceled_by_client', canceled_at = now(), canceled_by = v_user_id
   where id = p_booking_id;

  -- Option A stricte : le recredit va sur le lot d'origine, ou nulle part.
  -- Aucun report sur un autre lot, jamais (regles 1 et 2). En pratique le lot
  -- est toujours valide ici, puisque la regle 5 exigeait deja
  -- expires_at >= starts_at a la reservation et que l'annulation intervient
  -- avant le cours. Ce garde-fou couvre les lots fermes entre-temps par un
  -- remboursement ou un reset d'abonnement.
  if v_lot.closed_at is null
     and v_lot.expires_at > now()
     and v_lot.quantity_remaining < v_lot.quantity_initial
  then
    update public.credit_lots
       set quantity_remaining = quantity_remaining + 1
     where id = v_lot.id;

    update public.bookings set credit_refunded_at = now() where id = p_booking_id;

    insert into public.credit_movements (user_id, credit_lot_id, delta, reason, booking_id)
    values (v_user_id, v_lot.id, 1, 'booking_refund', p_booking_id);
  end if;
end;
$$;


-- ===========================================================================
-- BLOC 4 — GESTES D'ORIANE
-- ===========================================================================

-- --- Regle 7 : annuler un cours --------------------------------------------
-- Rend la liste des clientes touchees pour que la route serveur envoie les
-- emails. Elle ne les envoie pas elle-meme : Postgres ne parle pas a Resend.

create or replace function public.cancel_course(
  p_course_id uuid,
  p_reason    text default null
)
returns table (user_id uuid, booking_id uuid, refunded boolean)
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_course public.courses%rowtype;
  v_b      record;
  v_lot    public.credit_lots%rowtype;
  v_ok     boolean;
begin
  if not public.is_admin() then
    raise exception 'Action reservee a l''administratrice.' using errcode = 'SB009';
  end if;

  select * into v_course from public.courses where id = p_course_id for update;
  if not found then
    raise exception 'Ce cours n''existe pas.' using errcode = 'SB008';
  end if;
  if v_course.status = 'canceled' then
    raise exception 'Ce cours est deja annule.' using errcode = 'SB004';
  end if;

  update public.courses
     set status = 'canceled', canceled_at = now(), cancellation_reason = p_reason
   where id = p_course_id;

  for v_b in
    select b.id, b.user_id, b.credit_lot_id
      from public.bookings b
     where b.course_id = p_course_id and b.status = 'booked'
     order by b.booked_at
  loop
    select * into v_lot from public.credit_lots where id = v_b.credit_lot_id for update;

    update public.bookings
       set status = 'course_canceled', canceled_at = now(), canceled_by = auth.uid()
     where id = v_b.id;

    v_ok := v_lot.closed_at is null
        and v_lot.expires_at > now()
        and v_lot.quantity_remaining < v_lot.quantity_initial;

    if v_ok then
      update public.credit_lots
         set quantity_remaining = quantity_remaining + 1
       where id = v_lot.id;

      update public.bookings set credit_refunded_at = now() where id = v_b.id;

      insert into public.credit_movements (user_id, credit_lot_id, delta, reason, booking_id, actor_id)
      values (v_b.user_id, v_lot.id, 1, 'course_canceled_refund', v_b.id, auth.uid());
    end if;

    user_id    := v_b.user_id;
    booking_id := v_b.id;
    refunded   := v_ok;
    return next;
  end loop;

  perform public.log_audit(
    'course.canceled', 'courses', p_course_id,
    null, jsonb_build_object('reason', p_reason)
  );
end;
$$;


-- --- Desinscrire une cliente a la main -------------------------------------

create or replace function public.admin_unbook(
  p_booking_id uuid,
  p_refund     boolean default true,
  p_note       text default null
)
returns void
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_booking public.bookings%rowtype;
  v_lot     public.credit_lots%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Action reservee a l''administratrice.' using errcode = 'SB009';
  end if;

  select * into v_booking from public.bookings where id = p_booking_id;
  if not found then
    raise exception 'Cette reservation n''existe pas.' using errcode = 'SB008';
  end if;
  if v_booking.status <> 'booked' then
    raise exception 'Cette reservation est deja annulee.' using errcode = 'SB008';
  end if;

  perform 1 from public.courses where id = v_booking.course_id for update;
  select * into v_lot from public.credit_lots where id = v_booking.credit_lot_id for update;

  update public.bookings
     set status = 'canceled_by_admin', canceled_at = now(), canceled_by = auth.uid()
   where id = p_booking_id;

  -- Pas de controle de delai : c'est un geste de rattrapage. Oriane decide si
  -- la seance revient ou non, et ce choix est trace.
  if p_refund
     and v_lot.closed_at is null
     and v_lot.expires_at > now()
     and v_lot.quantity_remaining < v_lot.quantity_initial
  then
    update public.credit_lots
       set quantity_remaining = quantity_remaining + 1
     where id = v_lot.id;

    update public.bookings set credit_refunded_at = now() where id = p_booking_id;

    insert into public.credit_movements (user_id, credit_lot_id, delta, reason, booking_id, actor_id, note)
    values (v_booking.user_id, v_lot.id, 1, 'admin_adjust', p_booking_id, auth.uid(),
            coalesce(p_note, 'Desinscription par l''administratrice'));
  end if;

  perform public.log_audit(
    'booking.unbooked', 'bookings', p_booking_id,
    null, jsonb_build_object('refunded', p_refund, 'note', p_note)
  );
end;
$$;


-- --- Ajouter des seances a la main -----------------------------------------

create or replace function public.admin_grant_credits(
  p_user_id    uuid,
  p_quantity   integer,
  p_expires_at timestamptz,
  p_reason     text
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_lot_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Action reservee a l''administratrice.' using errcode = 'SB009';
  end if;
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Indique un nombre de seances superieur a zero.' using errcode = 'SB010';
  end if;
  if p_expires_at is null or p_expires_at <= now() then
    raise exception 'La date de validite doit etre dans le futur.' using errcode = 'SB010';
  end if;
  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'Indique un motif : un geste de rattrapage sans motif n''est pas trace.'
      using errcode = 'SB010';
  end if;

  insert into public.credit_lots (
    user_id, origin, quantity_initial, quantity_remaining, expires_at, granted_by, reason
  )
  values (p_user_id, 'admin_grant', p_quantity, p_quantity, p_expires_at, auth.uid(), p_reason)
  returning id into v_lot_id;

  insert into public.credit_movements (user_id, credit_lot_id, delta, reason, actor_id, note)
  values (p_user_id, v_lot_id, p_quantity, 'admin_adjust', auth.uid(), p_reason);

  perform public.log_audit(
    'credits.granted', 'credit_lots', v_lot_id,
    null, jsonb_build_object('user_id', p_user_id, 'quantity', p_quantity,
                             'expires_at', p_expires_at, 'reason', p_reason)
  );
  return v_lot_id;
end;
$$;


-- --- Retirer des seances a la main -----------------------------------------

create or replace function public.admin_revoke_credits(
  p_user_id  uuid,
  p_quantity integer,
  p_reason   text
)
returns integer
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_reste integer := p_quantity;
  v_prise integer;
  v_lot   record;
begin
  if not public.is_admin() then
    raise exception 'Action reservee a l''administratrice.' using errcode = 'SB009';
  end if;
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Indique un nombre de seances superieur a zero.' using errcode = 'SB010';
  end if;
  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'Indique un motif : un geste de rattrapage sans motif n''est pas trace.'
      using errcode = 'SB010';
  end if;

  -- Retrait par expiration la PLUS LOINTAINE : l'exact inverse de la
  -- consommation. Un retrait corrige un credit de trop ; il ne doit pas
  -- amputer les seances que la cliente doit poser en premier.
  for v_lot in
    select id, quantity_remaining
      from public.credit_lots
     where user_id = p_user_id
       and quantity_remaining > 0
       and closed_at is null
       and expires_at > now()
     order by expires_at desc, issued_at desc
     for update
  loop
    exit when v_reste <= 0;
    v_prise := least(v_reste, v_lot.quantity_remaining);

    update public.credit_lots
       set quantity_remaining = quantity_remaining - v_prise
     where id = v_lot.id;

    insert into public.credit_movements (user_id, credit_lot_id, delta, reason, actor_id, note)
    values (p_user_id, v_lot.id, -v_prise, 'admin_adjust', auth.uid(), p_reason);

    v_reste := v_reste - v_prise;
  end loop;

  if v_reste > 0 then
    raise exception 'Cette cliente n''a que % seance(s) disponible(s).', p_quantity - v_reste
      using errcode = 'SB010';
  end if;

  perform public.log_audit(
    'credits.revoked', 'profiles', p_user_id,
    null, jsonb_build_object('quantity', p_quantity, 'reason', p_reason)
  );
  return p_quantity;
end;
$$;


-- --- Retirer des seances sur UN lot precis ---------------------------------
--
-- Le cas reel d'Oriane : corriger un lot qu'elle vient de crediter par erreur.
-- Laisser admin_revoke_credits choisir l'echeance la plus lointaine irait
-- piocher ailleurs. Ici, elle designe le lot.

create or replace function public.admin_revoke_credits_from_lot(
  p_credit_lot_id uuid,
  p_quantity      integer,
  p_reason        text
)
returns integer
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_lot public.credit_lots%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Action reservee a l''administratrice.' using errcode = 'SB009';
  end if;
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Indique un nombre de seances superieur a zero.' using errcode = 'SB010';
  end if;
  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'Indique un motif : un geste de rattrapage sans motif n''est pas trace.'
      using errcode = 'SB010';
  end if;

  select * into v_lot from public.credit_lots where id = p_credit_lot_id for update;
  if not found then
    raise exception 'Ce lot de seances n''existe pas.' using errcode = 'SB008';
  end if;
  if v_lot.closed_at is not null then
    raise exception 'Ce lot est deja ferme : il n''y a plus rien a retirer.' using errcode = 'SB010';
  end if;
  if v_lot.quantity_remaining < p_quantity then
    raise exception 'Ce lot ne contient que % seance(s) disponible(s).', v_lot.quantity_remaining
      using errcode = 'SB010';
  end if;

  -- Volontairement sans controle sur expires_at : un lot echu dont le balayage
  -- nocturne n'est pas encore passe garde un solde non nul, et Oriane doit
  -- pouvoir le corriger.
  update public.credit_lots
     set quantity_remaining = quantity_remaining - p_quantity
   where id = p_credit_lot_id;

  insert into public.credit_movements (user_id, credit_lot_id, delta, reason, actor_id, note)
  values (v_lot.user_id, p_credit_lot_id, -p_quantity, 'admin_adjust', auth.uid(), p_reason);

  perform public.log_audit(
    'credits.revoked_from_lot', 'credit_lots', p_credit_lot_id,
    null, jsonb_build_object('quantity', p_quantity, 'reason', p_reason)
  );

  return v_lot.quantity_remaining - p_quantity;
end;
$$;


-- --- Notes privees ---------------------------------------------------------
-- Ces quatre fonctions existent parce que la RLS ignore les colonnes : le
-- SELECT de table est revoque sur profiles et courses (0004), et admin_notes
-- n'est reaccorde a personne. Voici le seul chemin vers ces colonnes.

create or replace function public.admin_client_notes(p_user_id uuid)
returns text
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare v_notes text;
begin
  if not public.is_admin() then
    raise exception 'Action reservee a l''administratrice.' using errcode = 'SB009';
  end if;
  select admin_notes into v_notes from public.profiles where id = p_user_id;
  return v_notes;
end;
$$;

create or replace function public.admin_set_client_notes(p_user_id uuid, p_notes text)
returns void
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  if not public.is_admin() then
    raise exception 'Action reservee a l''administratrice.' using errcode = 'SB009';
  end if;
  update public.profiles set admin_notes = p_notes where id = p_user_id;
end;
$$;

create or replace function public.admin_course_notes(p_course_id uuid)
returns text
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare v_notes text;
begin
  if not public.is_admin() then
    raise exception 'Action reservee a l''administratrice.' using errcode = 'SB009';
  end if;
  select admin_notes into v_notes from public.courses where id = p_course_id;
  return v_notes;
end;
$$;

create or replace function public.admin_set_course_notes(p_course_id uuid, p_notes text)
returns void
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  if not public.is_admin() then
    raise exception 'Action reservee a l''administratrice.' using errcode = 'SB009';
  end if;
  update public.courses set admin_notes = p_notes where id = p_course_id;
end;
$$;


-- --- RGPD : anonymisation --------------------------------------------------

create or replace function public.anonymize_profile(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  if not public.is_admin() then
    raise exception 'Action reservee a l''administratrice.' using errcode = 'SB009';
  end if;

  update public.profiles
     set first_name  = 'Compte',
         last_name   = 'anonymise',
         phone       = null,
         admin_notes = null,
         email       = 'anonyme+' || p_user_id::text || '@invalide.local'
   where id = p_user_id;

  -- Le journal enregistre QUE l'anonymisation a eu lieu, jamais ce qui a ete
  -- efface : y recopier l'ancien etat annulerait l'effacement.
  perform public.log_audit(
    'profile.anonymized', 'profiles', p_user_id,
    null, jsonb_build_object('anonymized_at', now())
  );
end;
$$;

comment on function public.anonymize_profile(uuid) is
  'La ligne profiles reste, avec son id : orders.user_id est en ON DELETE '
  'RESTRICT et une commande payee ne s''efface pas (conservation comptable). '
  'CETTE FONCTION NE SUFFIT PAS : auth.users porte encore l''email. La route '
  'serveur doit ensuite appeler l''Admin API Supabase pour y ecrire la meme '
  'adresse de substitution et bannir le compte. Ecrire dans auth.users depuis '
  'une fonction publique serait fragile a chaque montee de version Supabase.';


-- --- Miroir d'un code promo ------------------------------------------------

create or replace function public.admin_mirror_promo_code(
  p_code                     text,
  p_description              text,
  p_stripe_coupon_id         text,
  p_stripe_promotion_code_id text,
  p_discount_type            public.promo_discount_type,
  p_percent_off              numeric,
  p_amount_off_cents         integer,
  p_currency                 text,
  p_duration                 public.promo_duration,
  p_duration_in_months       integer,
  p_max_redemptions          integer,
  p_restricted_plan_ids      uuid[],
  p_expires_at               timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_id      uuid;
  v_inconnu uuid;
begin
  if not public.is_admin() then
    raise exception 'Action reservee a l''administratrice.' using errcode = 'SB009';
  end if;

  -- Aucune FK n'est possible sur les elements d'un tableau : on valide ici.
  if p_restricted_plan_ids is not null then
    select x into v_inconnu
      from unnest(p_restricted_plan_ids) as x
     where not exists (select 1 from public.plans where id = x)
     limit 1;
    if v_inconnu is not null then
      raise exception 'La formule % n''existe pas.', v_inconnu using errcode = 'SB008';
    end if;
  end if;

  insert into public.promo_codes (
    code, description, stripe_coupon_id, stripe_promotion_code_id,
    discount_type, percent_off, amount_off_cents, currency,
    duration, duration_in_months, max_redemptions,
    restricted_plan_ids, expires_at, created_by
  )
  values (
    p_code, p_description, p_stripe_coupon_id, p_stripe_promotion_code_id,
    p_discount_type, p_percent_off, p_amount_off_cents, p_currency,
    p_duration, p_duration_in_months, p_max_redemptions,
    p_restricted_plan_ids, p_expires_at, auth.uid()
  )
  returning id into v_id;

  perform public.log_audit('promo_code.created', 'promo_codes', v_id,
                           null, jsonb_build_object('code', p_code));
  return v_id;
end;
$$;

comment on function public.admin_mirror_promo_code is
  'Appelee par une route serveur Next.js APRES que Stripe a cree le coupon et '
  'le promotion code. Cette fonction ne fait que valider et ecrire : Postgres '
  'ne peut pas appeler Stripe. La route doit s''authentifier avec le jeton '
  'd''Oriane, pas avec service_role, sinon auth.uid() est nul et is_admin() '
  'refuse.';

-- Correction du commentaire pose en 0002, qui attribuait a tort l'appel Stripe
-- a cette fonction.
comment on column public.promo_codes.restricted_plan_ids is
  'Aucune FK possible sur les elements d''un tableau : admin_mirror_promo_code() '
  'valide l''existence des formules avant d''ecrire. La restriction reelle est '
  'posee cote Stripe (coupon.applies_to) par la route serveur qui cree le code.';


-- ===========================================================================
-- BLOC 5 — STRIPE ET JOBS
-- ===========================================================================
-- Ces fonctions n'ont pas de garde is_admin() : elles sont appelees par les
-- webhooks et les crons, ou auth.uid() est nul. Leur controle d'acces est le
-- GRANT EXECUTE, accorde a service_role seul, tout en bas de ce fichier.

-- --- Crediter une commande payee -------------------------------------------

create or replace function public.credit_order(p_order_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_order   public.orders%rowtype;
  v_plan    public.plans%rowtype;
  v_lot_id  uuid;
  v_expires timestamptz;
  v_old     record;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'Commande introuvable.' using errcode = 'SB008';
  end if;
  if v_order.status <> 'paid' then
    raise exception 'Commande non payee : rien a crediter.' using errcode = 'SB011';
  end if;

  -- Idempotence. Stripe rejoue ses webhooks ; un double credit serait invisible.
  select id into v_lot_id from public.credit_lots where order_id = p_order_id limit 1;
  if v_lot_id is not null then
    return v_lot_id;
  end if;

  select * into v_plan from public.plans where id = v_order.plan_id;

  if v_order.kind = 'subscription_cycle' then
    -- Regle 2 : reset, pas cumul. Le reliquat est annule et trace, il ne
    -- s'additionne pas. Les reservations deja posees avec l'ancien lot restent
    -- valides : la seance a ete consommee au moment de la reservation.
    for v_old in
      select id, user_id, quantity_remaining
        from public.credit_lots
       where subscription_id = v_order.subscription_id
         and closed_at is null
       for update
    loop
      if v_old.quantity_remaining > 0 then
        insert into public.credit_movements (user_id, credit_lot_id, delta, reason, order_id)
        values (v_old.user_id, v_old.id, -v_old.quantity_remaining, 'subscription_reset', p_order_id);
      end if;
      update public.credit_lots
         set quantity_remaining = 0, closed_at = now(), close_reason = 'superseded'
       where id = v_old.id;
    end loop;

    select current_period_end into v_expires
      from public.subscriptions where id = v_order.subscription_id;
    -- Garde-fou si Stripe n'a pas encore pose la periode sur cette ligne.
    v_expires := coalesce(v_expires, now() + v_plan.validity_interval);

    insert into public.credit_lots (
      user_id, plan_id, origin, order_id, subscription_id,
      quantity_initial, quantity_remaining, expires_at
    )
    values (
      v_order.user_id, v_order.plan_id, 'subscription_cycle', p_order_id, v_order.subscription_id,
      v_plan.sessions_count, v_plan.sessions_count, v_expires
    )
    returning id into v_lot_id;

    -- Un prelevement reussi solde toute relance en cours.
    update public.subscriptions
       set payment_failed_at = null, dunning_exhausted_at = null
     where id = v_order.subscription_id;

  else
    insert into public.credit_lots (
      user_id, plan_id, origin, order_id,
      quantity_initial, quantity_remaining, expires_at
    )
    values (
      v_order.user_id, v_order.plan_id, 'order', p_order_id,
      v_plan.sessions_count, v_plan.sessions_count, now() + v_plan.validity_interval
    )
    returning id into v_lot_id;
  end if;

  insert into public.credit_movements (user_id, credit_lot_id, delta, reason, order_id)
  values (v_order.user_id, v_lot_id, v_plan.sessions_count, 'grant', p_order_id);

  return v_lot_id;
end;
$$;


-- --- Revoquer sur remboursement --------------------------------------------

create or replace function public.revoke_order_credits(
  p_order_id uuid,
  p_reason   text default 'Remboursement Stripe'
)
returns integer
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_total integer := 0;
  v_lot   record;
begin
  for v_lot in
    select id, user_id, quantity_remaining
      from public.credit_lots
     where order_id = p_order_id and closed_at is null
     for update
  loop
    if v_lot.quantity_remaining > 0 then
      insert into public.credit_movements (user_id, credit_lot_id, delta, reason, order_id, note)
      values (v_lot.user_id, v_lot.id, -v_lot.quantity_remaining, 'refund_revoked', p_order_id, p_reason);
      v_total := v_total + v_lot.quantity_remaining;
    end if;

    update public.credit_lots
       set quantity_remaining = 0, closed_at = now(), close_reason = 'revoked'
     where id = v_lot.id;
  end loop;

  return v_total;
end;
$$;

comment on function public.revoke_order_credits(uuid, text) is
  'Ne revoque que le solde ENCORE disponible. Les seances deja consommees le '
  'restent et les reservations posees avec elles tiennent : un cours suivi ne '
  'se defait pas parce qu''un paiement est rembourse. Un remboursement partiel '
  'ne declenche rien automatiquement — Oriane arbitre avec admin_revoke_credits.';


-- --- Echec de prelevement --------------------------------------------------

create or replace function public.apply_subscription_payment_failed(
  p_subscription_id uuid,
  p_invoice_id      text,
  p_is_final        boolean
)
returns boolean
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_deja boolean;
begin
  select dunning_exhausted_at is not null into v_deja
    from public.subscriptions where id = p_subscription_id for update;
  if not found then
    raise exception 'Abonnement introuvable.' using errcode = 'SB008';
  end if;

  update public.subscriptions
     set payment_failed_at    = coalesce(payment_failed_at, now()),
         dunning_exhausted_at = case when p_is_final
                                     then coalesce(dunning_exhausted_at, now())
                                     else dunning_exhausted_at end,
         latest_invoice_id    = p_invoice_id
   where id = p_subscription_id;

  -- Vrai une seule fois : au passage a l'echec definitif. C'est le signal
  -- d'envoi de l'email. Rien ne part pendant les Smart Retries, et aucune
  -- seance n'est retiree : le lot en cours vit jusqu'a son expires_at, et
  -- c'est l'absence de nouveau lot au cycle suivant qui fait effet.
  return p_is_final and not v_deja;
end;
$$;


-- --- Job nocturne : expiration ---------------------------------------------

create or replace function public.expire_credit_lots()
returns integer
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_n   integer := 0;
  v_lot record;
begin
  for v_lot in
    select id, user_id, quantity_remaining
      from public.credit_lots
     where expires_at <= now()
       and quantity_remaining > 0
       and closed_at is null
     for update
  loop
    insert into public.credit_movements (user_id, credit_lot_id, delta, reason)
    values (v_lot.user_id, v_lot.id, -v_lot.quantity_remaining, 'expired');

    update public.credit_lots set quantity_remaining = 0 where id = v_lot.id;
    v_n := v_n + 1;
  end loop;

  return v_n;
end;
$$;

comment on function public.expire_credit_lots() is
  'PURE COMPTABILITE. L''expiration est deja appliquee par le WHERE de toute '
  'requete de solde et de reservation : meme si ce job ne tourne jamais, une '
  'seance echue est inutilisable. Ce balayage sert a equilibrer le grand livre '
  '(SUM(delta) = quantity_remaining) et a alimenter l''historique. closed_at '
  'reste nul : un lot expire n''est pas un lot ferme, et l''interface doit '
  'pouvoir distinguer « expire » de « remplace » ou « rembourse ».';


-- --- Job nocturne : alerte de fin de validite ------------------------------

create or replace function public.lots_expiring_soon(p_days integer)
returns table (
  user_id            uuid,
  email              text,
  first_name         text,
  credit_lot_id      uuid,
  quantity_remaining integer,
  expires_at         timestamptz
)
language sql
security definer
set search_path = public, extensions, pg_temp
as $$
  select l.user_id,
         (p.email)::text,
         p.first_name,
         l.id,
         l.quantity_remaining,
         l.expires_at
    from public.credit_lots l
    join public.profiles p on p.id = l.user_id
   where l.quantity_remaining > 0
     and l.closed_at is null
     and l.expires_at > now()
     and l.expires_at <= now() + make_interval(days => p_days)
     and not exists (
       select 1 from public.email_log e
        where e.credit_lot_id = l.id and e.template = 'expiry_warning'
     )
   order by l.expires_at;
$$;

comment on function public.lots_expiring_soon(integer) is
  'Le NOT EXISTS evite de recalculer un envoi deja fait ; l''index unique '
  'partiel email_log_one_expiry_warning_per_lot est le vrai garde-fou si deux '
  'crons se chevauchent.';


-- ===========================================================================
-- GRANT EXECUTE
-- ===========================================================================
-- Postgres accorde EXECUTE a PUBLIC par defaut sur toute fonction creee. Sans
-- ces revocations, n'importe qui pourrait appeler credit_order() et se
-- crediter des seances. On ferme tout, puis on rouvre nommement.

revoke execute on all functions in schema public from public;
revoke execute on all functions in schema public from anon;
revoke execute on all functions in schema public from authenticated;
revoke execute on all functions in schema public from service_role;

-- service_role est dans cette liste pour une raison qui n'a rien d'evident :
-- revoquer a PUBLIC ne suffit pas. Supabase configure le schema public avec
--   alter default privileges in schema public
--     grant all on functions to postgres, anon, authenticated, service_role;
-- Chaque fonction creee recoit donc un GRANT NOMINATIF a ces trois roles, qui
-- survit a la revocation faite a PUBLIC. Sans la ligne ci-dessus, service_role
-- se retrouve avec EXECUTE sur la totalite des fonctions du schema.
--
-- Ce n'etait pas une faille : service_role contourne deja la RLS et ecrit
-- directement dans toutes les tables, il ne gagnait rien. Mais un fichier qui
-- annonce « on ferme tout, puis on rouvre nommement » doit le faire vraiment,
-- sinon la prochaine fonction sensible passera au travers sans que personne
-- ne le remarque.

-- Lisible par tous : les policies de 0004 l'appellent, y compris pour anon.
grant execute on function public.is_admin() to anon, authenticated;

-- Parcours cliente.
grant execute on function public.book_course(uuid)    to authenticated;
grant execute on function public.cancel_booking(uuid) to authenticated;

-- Gestes d'Oriane. Le garde is_admin() est DANS chaque fonction : le GRANT a
-- authenticated ne suffit pas a s'en servir.
grant execute on function public.cancel_course(uuid, text)                            to authenticated;
grant execute on function public.admin_unbook(uuid, boolean, text)                    to authenticated;
grant execute on function public.admin_grant_credits(uuid, integer, timestamptz, text) to authenticated;
grant execute on function public.admin_revoke_credits(uuid, integer, text)            to authenticated;
grant execute on function public.admin_revoke_credits_from_lot(uuid, integer, text)   to authenticated;
grant execute on function public.admin_client_notes(uuid)                             to authenticated;
grant execute on function public.admin_set_client_notes(uuid, text)                   to authenticated;
grant execute on function public.admin_course_notes(uuid)                             to authenticated;
grant execute on function public.admin_set_course_notes(uuid, text)                   to authenticated;
grant execute on function public.anonymize_profile(uuid)                              to authenticated;
grant execute on function public.admin_mirror_promo_code(
  text, text, text, text, public.promo_discount_type, numeric, integer, text,
  public.promo_duration, integer, integer, uuid[], timestamptz
) to authenticated;

-- Webhooks Stripe et crons. JAMAIS a authenticated : ces fonctions creditent
-- des seances sans verifier de paiement, c'est l'appelant qui en repond.
grant execute on function public.credit_order(uuid)                                    to service_role;
grant execute on function public.revoke_order_credits(uuid, text)                      to service_role;
grant execute on function public.apply_subscription_payment_failed(uuid, text, boolean) to service_role;
grant execute on function public.expire_credit_lots()                                  to service_role;
grant execute on function public.lots_expiring_soon(integer)                           to service_role;

-- log_audit() et set_updated_at() ne sont accordees a personne : la premiere
-- n'est appelee que depuis d'autres fonctions SECURITY DEFINER, la seconde
-- n'est qu'un trigger. Les fonctions de trigger ne passent pas par EXECUTE.
