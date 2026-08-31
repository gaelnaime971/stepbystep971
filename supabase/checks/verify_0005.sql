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


-- ---------------------------------------------------------------------------
-- 2. Triggers. Attendu : 10 lignes « ok ».
-- ---------------------------------------------------------------------------

with attendu (trg, tbl, fonction) as (values
  ('on_auth_user_created',        'users',         'handle_new_user'),
  ('on_auth_user_email_changed',  'users',         'sync_profile_email'),
  ('plans_guard_immutable_trg',   'plans',         'plans_guard_immutable'),
  ('bookings_sync_seats_trg',     'bookings',      'bookings_sync_seats'),
  ('courses_guard_capacity_trg',  'courses',       'courses_guard_capacity'),
  ('profiles_set_updated_at',     'profiles',      'set_updated_at'),
  ('plans_set_updated_at',        'plans',         'set_updated_at'),
  ('subscriptions_set_updated_at','subscriptions', 'set_updated_at'),
  ('orders_set_updated_at',       'orders',        'set_updated_at'),
  ('courses_set_updated_at',      'courses',       'set_updated_at')
),
reel as (
  select t.tgname::text as trg,
         c.relname::text as tbl,
         p.proname::text as fonction,
         n.nspname::text as schema,
         t.tgenabled
  from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
  join pg_namespace n on n.oid = c.relnamespace
  join pg_proc p on p.oid = t.tgfoid
  where not t.tgisinternal
    and n.nspname in ('public', 'auth')
),
juge as (
  select
    coalesce(a.trg, r.trg) as trigger_name,
    r.schema, r.tbl, r.fonction,
    case
      when r.trg is null           then 'MANQUANT'
      when a.trg is null           then 'INATTENDU sur ' || r.schema || '.' || r.tbl
      when r.tbl <> a.tbl          then 'TABLE ' || r.tbl || ' au lieu de ' || a.tbl
      when r.fonction <> a.fonction then 'FONCTION ' || r.fonction || ' au lieu de ' || a.fonction
      when r.tgenabled <> 'O'      then 'DESACTIVE'
      else 'ok'
    end as verdict
  from attendu a
  full join reel r on r.trg = a.trg
)
select * from juge order by (verdict = 'ok'), trigger_name;


-- ---------------------------------------------------------------------------
-- 3. Assertions de securite. Attendu : 9 lignes « ok », echecs en tete.
-- ---------------------------------------------------------------------------

with f as (
  select p.oid, p.proname::text as fname, p.prosecdef, p.proconfig, p.proacl
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
),
m as (
  select
    (select count(*) from f)                                        as nb_fonctions,
    (select count(*) from f where prosecdef
       and (proconfig is null or not exists (
         select 1 from unnest(proconfig) cfg where left(cfg, 12) = 'search_path=')))
                                                                    as secdef_sans_searchpath,
    (select count(*) from f
      where has_function_privilege('anon', oid, 'execute')
        and fname <> 'is_admin')                                    as anon_execute_hors_is_admin,
    (select count(*) from f
      where has_function_privilege('authenticated', oid, 'execute')) as auth_execute,
    (select count(*) from f
      where has_function_privilege('service_role', oid, 'execute'))  as service_execute,
    (select count(*) from f
      where fname in ('credit_order','revoke_order_credits',
                      'apply_subscription_payment_failed','expire_credit_lots',
                      'lots_expiring_soon')
        and (has_function_privilege('authenticated', oid, 'execute')
          or has_function_privilege('anon', oid, 'execute')))        as stripe_exposees,
    (select count(*) from f
      where fname in ('log_audit','set_updated_at')
        and (has_function_privilege('authenticated', oid, 'execute')
          or has_function_privilege('anon', oid, 'execute')))        as internes_exposees,
    (select count(*) from f
      where has_function_privilege('service_role', oid, 'execute')
        and fname not in ('credit_order','revoke_order_credits',
                          'apply_subscription_payment_failed','expire_credit_lots',
                          'lots_expiring_soon'))                     as service_hors_stripe,
    -- Attention au cas NULL : une proacl vide ne signifie pas « aucun droit »
    -- mais « droits par defaut », et le defaut d'une FONCTION inclut EXECUTE
    -- pour PUBLIC. Une fonction sans ACL est donc grande ouverte.
    (select count(*) from f
      where proacl is null
         or exists (select 1 from unnest(proacl) ac where ac::text like '=%'))
                                                                     as executables_par_public
),
a as (
  select 1 as n,
    'les 26 fonctions attendues sont presentes' as assertion,
    case when nb_fonctions = 26 then 'ok'
         else 'ECHEC — ' || nb_fonctions || ' fonctions au lieu de 26' end as verdict
  from m
  union all select 2,
    'toute SECURITY DEFINER a un search_path fige',
    case when secdef_sans_searchpath = 0 then 'ok'
         else 'ECHEC — ' || secdef_sans_searchpath || ' fonction(s) sans search_path' end from m
  union all select 3,
    'anon n''execute que is_admin()',
    case when anon_execute_hors_is_admin = 0 then 'ok'
         else 'ECHEC — anon peut appeler ' || anon_execute_hors_is_admin || ' autre(s) fonction(s)' end from m
  union all select 4,
    'authenticated execute exactement 14 fonctions',
    case when auth_execute = 14 then 'ok'
         else 'ECHEC — ' || auth_execute || ' au lieu de 14' end from m
  union all select 5,
    'service_role n''execute QUE les 5 fonctions Stripe et cron',
    case when service_hors_stripe > 0
           then 'ECHEC — ' || service_hors_stripe || ' fonction(s) hors Stripe/cron (revocation a service_role oubliee : les privileges par defaut de Supabase accordent EXECUTE nominativement, revoquer a PUBLIC ne suffit pas)'
         when service_execute <> 5
           then 'ECHEC — ' || service_execute || ' fonctions Stripe/cron au lieu de 5'
         else 'ok' end from m
  union all select 6,
    'AUCUNE fonction Stripe/cron n''est appelable depuis le navigateur',
    case when stripe_exposees = 0 then 'ok'
         else 'ECHEC — ' || stripe_exposees || ' fonction(s) qui creditent sans verifier de paiement sont exposees' end from m
  union all select 7,
    'log_audit et set_updated_at ne sont appelables par personne',
    case when internes_exposees = 0 then 'ok'
         else 'ECHEC — le journal d''audit est ecrivable directement' end from m
  union all select 8,
    'contre-epreuve : la cliente peut bien appeler book_course et cancel_booking',
    case when has_function_privilege('authenticated', 'public.book_course(uuid)', 'execute')
          and has_function_privilege('authenticated', 'public.cancel_booking(uuid)', 'execute')
         then 'ok' else 'ECHEC — plus personne ne peut reserver' end from m
  union all select 9,
    'aucune fonction n''est executable par PUBLIC',
    case when executables_par_public = 0 then 'ok'
         else 'ECHEC — ' || executables_par_public || ' fonction(s) ouvertes a PUBLIC (ACL vide = droits par defaut = EXECUTE pour PUBLIC)' end from m
)
select * from a order by (verdict = 'ok'), n;


-- ---------------------------------------------------------------------------
-- 4. D'ou viennent les droits. A lancer si une assertion de la section 3 tombe :
--    ces trois requetes disent si un privilege vient d'un GRANT nominatif,
--    d'un heritage de role, ou des privileges par defaut du schema.
-- ---------------------------------------------------------------------------

-- 4a. L'ACL brute de quelques fonctions. Un GRANT nominatif s'y lit
--     « role=X/proprietaire ». Une ligne commencant par « = » est PUBLIC.
select p.proname::text as fonction,
       coalesce(array_to_string(p.proacl, E'\n'), '(aucune ACL : PUBLIC par defaut)') as acl
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('credit_order', 'book_course', 'log_audit', 'is_admin')
order by p.proname;

-- 4b. Les privileges par defaut du schema. C'est la que se voit la ligne
--     Supabase qui accorde EXECUTE a anon, authenticated ET service_role sur
--     toute fonction creee. defaclobjtype : 'f' = fonctions, 'r' = tables.
select pg_get_userbyid(d.defaclrole) as pose_par,
       coalesce(n.nspname, '(tous schemas)') as schema,
       case d.defaclobjtype when 'f' then 'fonctions' when 'r' then 'tables'
                            when 'S' then 'sequences' else d.defaclobjtype::text end as objets,
       array_to_string(d.defaclacl, E'\n') as privileges_par_defaut
from pg_default_acl d
left join pg_namespace n on n.oid = d.defaclnamespace
order by schema, objets;

-- 4c. Appartenances de roles : verifie qu'aucun des trois roles PostgREST
--     n'herite d'un role proprietaire. Attendu : aucune ligne surprenante.
select r.rolname::text as role, g.rolname::text as membre_de
from pg_auth_members m
join pg_roles r on r.oid = m.member
join pg_roles g on g.oid = m.roleid
where r.rolname in ('anon', 'authenticated', 'service_role')
order by r.rolname, g.rolname;
