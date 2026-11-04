-- =============================================================================
-- 0014 — Le chemin d'une formule gratuite
-- Step by Step Coaching
--
-- A PASSER APRES 0013, jamais dans la meme execution : l'index et le CHECK
-- ci-dessous nomment les valeurs d'enum ajoutees la, et Postgres refuse
-- d'utiliser une valeur creee dans la transaction courante.
--
-- Jouee sur une base VIVANTE. Additive : un CHECK remplace a l'identique plus
-- une branche, un index, une fonction remplacee de trois lignes, un RPC
-- nouveau. Aucune ligne n'est touchee.
--
-- L'IDEE DIRECTRICE. Le chemin gratuit ne duplique AUCUNE logique de credit :
-- il ecrit une commande a zero en `paid`, puis appelle `credit_order()`. Meme
-- lot, meme expiration, meme mouvement `grant`. Deux chemins qui crediteraient
-- chacun de leur cote divergeraient a la premiere correction.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- 1. La forme d'un lot offert
-- ---------------------------------------------------------------------------
--
-- Un lot `offert` se rattache exactement comme un lot `order` : il nait d'une
-- commande, et c'est ce qui rend la revocation possible si Oriane doit revenir
-- dessus. Seule l'origine change, pour que le grand livre le dise lui-meme.
--
-- Le CHECK est remplace, pas complete : Postgres ne sait pas ajouter une
-- branche a un `case` existant. Les lignes en place sont revalidees au passage,
-- et elles passent toutes — aucune n'a l'origine 'offert'.

alter table public.credit_lots
  drop constraint credit_lots_origin_shape;

alter table public.credit_lots
  add constraint credit_lots_origin_shape check (
    case origin
      when 'order' then
        order_id is not null and plan_id is not null and subscription_id is null
      when 'offert' then
        order_id is not null and plan_id is not null and subscription_id is null
      when 'subscription_cycle' then
        subscription_id is not null and plan_id is not null
      when 'admin_grant' then
        granted_by is not null and reason is not null
        and order_id is null and subscription_id is null
    end
  );


-- ---------------------------------------------------------------------------
-- 2. Une formule offerte, une seule fois par personne
-- ---------------------------------------------------------------------------
--
-- EN BASE, et pas dans le code. Deux tapes sur un telephone lent font deux
-- requetes paralleles : un `select` puis `insert` applicatif les laisserait
-- passer toutes les deux, et la cliente repartirait avec deux seances offertes.
-- C'est la meme discipline que les index partiels d'`email_log`.
--
-- LA CLE EST `kind`, PAS LE MONTANT. Une formule payante achetee avec un code
-- promo a 100 % tombe aussi a 0 EUR : indexer sur `amount_cents = 0` lui
-- refuserait son achat, alors que son code etait valable.
--
-- Par (cliente, formule) et non par cliente seule : si Oriane refait des
-- portes ouvertes l'an prochain, elle creera une nouvelle formule et les memes
-- personnes pourront revenir. C'est le but.

create unique index orders_une_seule_gratuite_par_formule
  on public.orders (user_id, plan_id)
  where (kind = 'free');


-- ---------------------------------------------------------------------------
-- 3. credit_order : trois lignes, et pas une de plus
-- ---------------------------------------------------------------------------
--
-- Le reste du corps est celui de 0005, a l'identique. La seule difference est
-- l'origine du lot dans la branche NON recurrente.
--
-- Pourquoi c'est sans risque pour ce qui encaisse : la branche est commandee
-- par `v_order.kind = 'free'`, et AUCUN webhook Stripe n'ecrit cette valeur.
-- `checkout.session.completed` pose 'purchase', `invoice.paid` pose
-- 'subscription_cycle'. Le chemin payant ne peut donc pas l'atteindre — et la
-- contre-epreuve 3_ de ce lot le verifie plutot que de l'affirmer.

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
      v_order.user_id, v_order.plan_id,
      -- LES TROIS LIGNES. Une commande 'free' donne un lot 'offert' ; tout le
      -- reste donne un lot 'order', comme avant.
      case when v_order.kind = 'free' then 'offert'::public.lot_origin
           else 'order'::public.lot_origin end,
      p_order_id,
      v_plan.sessions_count, v_plan.sessions_count, now() + v_plan.validity_interval
    )
    returning id into v_lot_id;
  end if;

  insert into public.credit_movements (user_id, credit_lot_id, delta, reason, order_id)
  values (v_order.user_id, v_lot_id, v_plan.sessions_count, 'grant', p_order_id);

  return v_lot_id;
end;
$$;

-- `create or replace` conserve les droits, mais on les repose : cette fonction
-- credite des seances sans verifier de paiement, c'est l'appelant qui en
-- repond. Elle ne va JAMAIS a `authenticated`.
revoke execute on function public.credit_order(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.credit_order(uuid) to service_role;


-- ---------------------------------------------------------------------------
-- 4. Prendre une formule offerte
-- ---------------------------------------------------------------------------
--
-- LE GARDE QUI COMPTE est `v_plan.price_cents <> 0`, relu EN BASE. Sans lui,
-- une cliente appellerait ce RPC avec l'identifiant du pack a 400 EUR et se
-- crediterait trente seances. Le prix ne vient jamais du formulaire.
--
-- `user_id` vient de auth.uid() et non d'un parametre : personne ne s'inscrit
-- a la place d'une autre.
--
-- Elle appelle `credit_order()` alors que celle-ci n'est accordee qu'a
-- `service_role` : c'est l'effet de SECURITY DEFINER, l'appel interne tourne
-- avec les droits du proprietaire. `authenticated` ne gagne toujours pas le
-- droit de l'appeler directement.

create or replace function public.prendre_formule_offerte(p_slug text)
returns uuid
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_user     uuid := auth.uid();
  v_plan     public.plans%rowtype;
  v_order_id uuid;
begin
  if v_user is null then
    raise exception 'Connecte-toi pour prendre cette formule.' using errcode = 'SB009';
  end if;

  select * into v_plan from public.plans where slug = p_slug;
  if not found then
    raise exception 'Cette formule n''existe pas.' using errcode = 'SB008';
  end if;

  if v_plan.price_cents <> 0 then
    raise exception 'Cette formule n''est pas gratuite.' using errcode = 'SB014';
  end if;
  if v_plan.archived_at is not null or not v_plan.is_active then
    raise exception 'Cette formule n''est plus proposee.' using errcode = 'SB008';
  end if;
  if v_plan.kind = 'subscription' then
    raise exception 'Un abonnement ne peut pas etre gratuit.' using errcode = 'SB014';
  end if;

  begin
    insert into public.orders (user_id, plan_id, kind, status, amount_cents, currency, paid_at)
    values (v_user, v_plan.id, 'free', 'paid', 0, v_plan.currency, now())
    returning id into v_order_id;
  exception when unique_violation then
    raise exception 'Tu as deja pris cette formule offerte.' using errcode = 'SB015';
  end;

  -- Le meme credit qu'apres un paiement Stripe. Aucune logique dupliquee.
  return public.credit_order(v_order_id);
end;
$$;

comment on function public.prendre_formule_offerte(text) is
  'Le seul chemin d''inscription a une formule a 0 EUR. Ne touche jamais '
  'Stripe — ni produit, ni prix, ni session : Checkout refuse une session a '
  'zero. Relit le prix EN BASE avant de crediter, et s''appuie sur l''index '
  'orders_une_seule_gratuite_par_formule pour l''unicite.';

revoke execute on function public.prendre_formule_offerte(text)
  from public, anon, authenticated, service_role;
grant execute on function public.prendre_formule_offerte(text) to authenticated;
