-- =============================================================================
-- 0004 — Privileges et RLS
-- Step by Step Coaching
--
-- Deux couches independantes, qui doivent TOUTES DEUX passer :
--   * les privileges (GRANT) disent quels verbes et quelles COLONNES un role
--     peut toucher ;
--   * la RLS (POLICY) dit quelles LIGNES il voit.
-- La RLS ne sait pas raisonner par colonne : c'est pourquoi les deux champs
-- `admin_notes` sont proteges par des GRANT de colonne, pas par une policy.
--
-- Pourquoi is_admin() est ici et non en 0005 : les policies ne peuvent pas
-- exister sans elle. C'est une piece du controle d'acces, pas une fonction
-- metier.
--
-- Roles Supabase : `anon` (visiteuse), `authenticated` (cliente ET Oriane —
-- c'est le meme role Postgres, seule is_admin() les distingue), `service_role`
-- (webhooks Stripe et jobs cron, en BYPASSRLS, donc aucune policy ne le
-- concerne).
-- =============================================================================


-- ---------------------------------------------------------------------------
-- is_admin()
-- ---------------------------------------------------------------------------

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
  );
$$;

comment on function public.is_admin() is
  'SECURITY DEFINER, donc executee par le proprietaire de la table profiles. '
  'Un proprietaire contourne la RLS : c''est ce qui evite la recursion infinie '
  'quand une policy DE profiles appelle cette fonction. '
  'COROLLAIRE A NE JAMAIS OUBLIER : ne jamais activer FORCE ROW LEVEL SECURITY '
  'sur profiles. Le proprietaire y serait soumis, is_admin() ne verrait plus '
  'rien, et toute l''administration se fermerait d''un coup. Meme raison pour '
  'les RPC de 0005.';

grant execute on function public.is_admin() to anon, authenticated;


-- ===========================================================================
-- COUCHE 1 — PRIVILEGES
-- ===========================================================================

-- Supabase accorde par defaut tous les verbes a anon et authenticated sur le
-- schema public. On repart de zero cote ecriture, puis on rouvre au compte-
-- gouttes. Fermer par defaut, ouvrir explicitement.

revoke insert, update, delete on all tables in schema public from anon;
revoke insert, update, delete on all tables in schema public from authenticated;

-- Les seules ecritures directes autorisees sont celles d'Oriane en CRUD simple.
-- Les lignes restent filtrees par les policies is_admin() plus bas : ces GRANT
-- ne donnent le verbe qu'au role, jamais l'acces aux lignes.
grant insert, update         on public.locations   to authenticated;
grant insert, update         on public.plans       to authenticated;
grant insert, update, delete on public.courses     to authenticated;
grant update                 on public.promo_codes to authenticated;

-- Aucun DELETE sur plans ni locations, pour personne : regle 10 (on archive,
-- on ne supprime pas) et conservation du lieu des cours passes.
-- DELETE sur courses est accorde, mais la FK bookings.course_id est en RESTRICT :
-- seul un cours sans aucune reservation peut disparaitre.

-- Tout le reste (bookings, credit_lots, credit_movements, orders, subscriptions,
-- stripe_events, email_log, audit_log) reste sans aucun verbe d'ecriture. Ces
-- tables ne sont ecrites que par les RPC SECURITY DEFINER de 0005 et par
-- service_role.


-- --- Colonnes privees ------------------------------------------------------
--
-- `admin_notes` ne doit etre lisible ni par une visiteuse, ni par la cliente
-- concernee. Un GRANT de colonne ne peut pas retirer ce qu'un GRANT de table
-- accorde : il faut donc revoquer le SELECT de table puis le reaccorder colonne
-- par colonne.
--
-- CONSEQUENCE A CONNAITRE : `select('*')` echoue desormais sur profiles et sur
-- courses. Toute requete PostgREST doit enumerer ses colonnes. C'est le prix
-- assume : la requete casse bruyamment au lieu de laisser fuir une note.
-- Oriane lira et ecrira ces notes via les RPC dediees de 0005.

revoke select on public.profiles from anon, authenticated;
grant select (
  id, email, first_name, last_name, phone, role,
  stripe_customer_id, created_at, updated_at
) on public.profiles to authenticated;

revoke select on public.courses from anon, authenticated;
grant select (
  id, location_id, starts_at, ends_at, capacity, seats_taken, status,
  canceled_at, cancellation_reason, recurrence_group_id,
  created_by, created_at, updated_at
) on public.courses to anon, authenticated;

-- Sur profiles, l'ecriture est limitee a trois colonnes. C'est ce qui empeche
-- une cliente de se promouvoir admin, de reecrire son email (qui doit rester le
-- reflet de auth.users) ou de se rattacher au client Stripe d'une autre.
grant update (first_name, last_name, phone) on public.profiles to authenticated;

comment on column public.profiles.role is
  'Protege par un GRANT de colonne en 0004 : `authenticated` n''a le droit '
  'd''ecrire que first_name, last_name et phone. Aucun trigger n''est necessaire, '
  'et la protection tient meme si une policy est mal ecrite plus tard.';


-- ===========================================================================
-- COUCHE 2 — POLICIES
-- ===========================================================================
--
-- Aucune policy n'utilise FOR ALL. Une policy par verbe, meme quand cela
-- rallonge le fichier : c'est ce qui rend verifiable l'affirmation « il
-- n'existe aucune policy d'ecriture sur bookings ».


-- --- profiles --------------------------------------------------------------

create policy profiles_select_self_or_admin on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_admin());

create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy profiles_update_admin on public.profiles
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Pas de policy INSERT : la ligne est creee par le trigger sur auth.users (0005).
-- Pas de policy DELETE : une demande RGPD se traite par anonymisation.


-- --- locations -------------------------------------------------------------

-- Les lieux sont de l'information publique : ils figurent sur la vitrine. Les
-- lire tous, y compris inactifs, evite qu'une reservation passee perde son lieu
-- le jour ou Oriane ferme une salle. Le filtre is_active est un choix
-- d'affichage, pas de securite.
create policy locations_select_all on public.locations
  for select to anon, authenticated
  using (true);

create policy locations_admin_insert on public.locations
  for insert to authenticated
  with check (public.is_admin());

create policy locations_admin_update on public.locations
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());


-- --- plans -----------------------------------------------------------------

create policy plans_select_active on public.plans
  for select to anon, authenticated
  using (is_active or public.is_admin());

-- Regle 10 : les abonnees d'une formule archivee ne migrent pas. Elles doivent
-- continuer a voir le nom et le prix de CE qu'elles ont achete, meme retire de
-- la vitrine.
create policy plans_select_own_history on public.plans
  for select to authenticated
  using (
    exists (
      select 1 from public.subscriptions s
      where s.plan_id = plans.id and s.user_id = auth.uid()
    )
    or exists (
      select 1 from public.credit_lots l
      where l.plan_id = plans.id and l.user_id = auth.uid()
    )
  );

create policy plans_admin_insert on public.plans
  for insert to authenticated
  with check (public.is_admin());

create policy plans_admin_update on public.plans
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());


-- --- courses ---------------------------------------------------------------

-- Le planning est visible publiquement : c'est ce qui rend l'offre concrete.
-- Les cours annules restent lisibles pour que la cliente comprenne pourquoi sa
-- reservation a disparu. Ce qui n'est PAS expose ici, c'est qui est inscrit :
-- bookings a ses propres policies, et seul seats_taken sort.
create policy courses_select_all on public.courses
  for select to anon, authenticated
  using (true);

create policy courses_admin_insert on public.courses
  for insert to authenticated
  with check (public.is_admin());

create policy courses_admin_update on public.courses
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy courses_admin_delete on public.courses
  for delete to authenticated
  using (public.is_admin());


-- --- bookings --------------------------------------------------------------

create policy bookings_select_own_or_admin on public.bookings
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- AUCUNE policy INSERT, UPDATE ou DELETE, pour personne. C'est le verrou
-- central du modele : reserver et annuler passent exclusivement par
-- book_course() et cancel_booking() en 0005. Sans cela, une cliente pourrait
-- inserer une reservation sans debiter son solde, ou choisir elle-meme quel lot
-- debiter et contourner la regle 4.


-- --- credit_lots -----------------------------------------------------------

create policy credit_lots_select_own_or_admin on public.credit_lots
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- Aucune policy d'ecriture : un solde ne s'ecrit jamais depuis le navigateur.


-- --- credit_movements ------------------------------------------------------

create policy credit_movements_select_own_or_admin on public.credit_movements
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- AUCUNE policy UPDATE ni DELETE, pour personne, Oriane comprise. Le grand
-- livre est en ajout seul. Une erreur de saisie se corrige par un mouvement
-- compensatoire, jamais par une reecriture.
-- Pas de policy INSERT non plus : les mouvements naissent dans les RPC.


-- --- orders / subscriptions ------------------------------------------------

create policy orders_select_own_or_admin on public.orders
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

create policy subscriptions_select_own_or_admin on public.subscriptions
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- Aucune ecriture : Stripe est la source de verite, les webhooks ecrivent en
-- service_role.


-- --- promo_codes -----------------------------------------------------------

-- Jamais lisible par une cliente : la liste des codes actifs n'a pas a circuler.
-- Le code saisi au paiement est valide par Stripe, pas par une lecture de table.
create policy promo_codes_admin_select on public.promo_codes
  for select to authenticated
  using (public.is_admin());

-- Oriane desactive un code depuis l'admin. La CREATION passe par une route
-- serveur (0005) : creer le coupon chez Stripe puis miroiter en base, ce qu'une
-- fonction Postgres ne peut pas faire.
create policy promo_codes_admin_update on public.promo_codes
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());


-- --- Journaux : lecture admin seule ----------------------------------------

create policy stripe_events_admin_select on public.stripe_events
  for select to authenticated
  using (public.is_admin());

create policy email_log_admin_select on public.email_log
  for select to authenticated
  using (public.is_admin());

create policy audit_log_admin_select on public.audit_log
  for select to authenticated
  using (public.is_admin());
