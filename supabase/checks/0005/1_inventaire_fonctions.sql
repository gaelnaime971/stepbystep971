-- =============================================================================
-- Verification apres 0005.
--   1. inventaire des 26 fonctions  -> toutes « ok »
--   2. inventaire des 10 triggers   -> tous « ok »
--   3. assertions de securite       -> 9 lignes « ok », echecs en tete
--   4. d'ou viennent les droits     -> diagnostic, si une assertion tombe
--
-- La colonne qui compte vraiment est la matrice d'execution : qui peut appeler
-- quoi. Une erreur la-dessus est plus grave qu'une fonction manquante — une
-- fonction absente casse bruyamment, un GRANT de trop credite des seances en
-- silence.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- 1. Fonctions. Attendu : 26 lignes « ok ».
--    Le rapprochement se fait sur le nom et le NOMBRE d'arguments, pas sur leur
--    rendu textuel, qui depend du search_path de la session.
-- ---------------------------------------------------------------------------

with attendu (fname, nargs, secdef, ex_anon, ex_auth, ex_service) as (values
  -- nom                                nb  secdef anon  auth  service
  ('is_admin',                           0, true,  true,  true,  false),
  ('set_updated_at',                     0, false, false, false, false),
  ('log_audit',                          5, true,  false, false, false),
  ('handle_new_user',                    0, true,  false, false, false),
  ('sync_profile_email',                 0, true,  false, false, false),
  ('plans_guard_immutable',              0, true,  false, false, false),
  ('courses_guard_capacity',             0, true,  false, false, false),
  ('bookings_sync_seats',                0, true,  false, false, false),
  ('book_course',                        1, true,  false, true,  false),
  ('cancel_booking',                     1, true,  false, true,  false),
  ('cancel_course',                      2, true,  false, true,  false),
  ('admin_unbook',                       3, true,  false, true,  false),
  ('admin_grant_credits',                4, true,  false, true,  false),
  ('admin_revoke_credits',               3, true,  false, true,  false),
  ('admin_revoke_credits_from_lot',      3, true,  false, true,  false),
  ('admin_client_notes',                 1, true,  false, true,  false),
  ('admin_set_client_notes',             2, true,  false, true,  false),
  ('admin_course_notes',                 1, true,  false, true,  false),
  ('admin_set_course_notes',             2, true,  false, true,  false),
  ('anonymize_profile',                  1, true,  false, true,  false),
  ('admin_mirror_promo_code',           13, true,  false, true,  false),
  ('credit_order',                       1, true,  false, false, true),
  ('revoke_order_credits',               2, true,  false, false, true),
  ('apply_subscription_payment_failed',  3, true,  false, false, true),
  ('expire_credit_lots',                 0, true,  false, false, true),
  ('lots_expiring_soon',                 1, true,  false, false, true)
),
reel as (
  select
    p.proname::text as fname,
    p.pronargs::int as nargs,
    p.prosecdef     as secdef,
    (p.proconfig is not null and exists (
       select 1 from unnest(p.proconfig) cfg where left(cfg, 12) = 'search_path='
    )) as searchpath_fige,
    has_function_privilege('anon',         p.oid, 'execute') as ex_anon,
    has_function_privilege('authenticated', p.oid, 'execute') as ex_auth,
    has_function_privilege('service_role',  p.oid, 'execute') as ex_service,
    pg_get_function_identity_arguments(p.oid) as args
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
),
juge as (
  select
    coalesce(a.fname, r.fname) as fonction,
    r.args,
    case
      when r.fname is null           then 'MANQUANTE'
      when a.fname is null           then 'INATTENDUE'
      when r.nargs      <> a.nargs   then 'ARGS ' || r.nargs || ' au lieu de ' || a.nargs
      when r.secdef     <> a.secdef  then 'SECURITY DEFINER ' || r.secdef || ' au lieu de ' || a.secdef
      when a.secdef and not r.searchpath_fige
                                     then 'search_path NON FIGE sur une SECURITY DEFINER'
      when r.ex_anon    <> a.ex_anon then 'EXEC anon ' || r.ex_anon || ' au lieu de ' || a.ex_anon
      when r.ex_auth    <> a.ex_auth then 'EXEC authenticated ' || r.ex_auth || ' au lieu de ' || a.ex_auth
      when r.ex_service <> a.ex_service then 'EXEC service_role ' || r.ex_service || ' au lieu de ' || a.ex_service
      else 'ok'
    end as verdict,
    r.ex_anon, r.ex_auth, r.ex_service
  from attendu a
  full join reel r on r.fname = a.fname
)
select * from juge order by (verdict = 'ok'), fonction;
