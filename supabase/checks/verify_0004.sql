-- =============================================================================
-- Verification apres 0004.
--   1. inventaire des policies       -> 24 lignes, toutes « ok »
--   2. assertions de securite        -> 18 lignes, toutes « ok », echecs en tete
--   3. detail des policies           -> pour l'oeil
--   4. privileges effectifs          -> pour l'oeil
-- =============================================================================


-- ---------------------------------------------------------------------------
-- 1. Inventaire des policies. Attendu : 24 lignes « ok ».
-- ---------------------------------------------------------------------------

with attendu (table_name, policy_name, cmd, roles) as (values
  ('profiles',         'profiles_select_self_or_admin',        'select', 'authenticated'),
  ('profiles',         'profiles_update_self',                 'update', 'authenticated'),
  ('profiles',         'profiles_update_admin',                'update', 'authenticated'),
  ('locations',        'locations_select_all',                 'select', 'anon,authenticated'),
  ('locations',        'locations_admin_insert',               'insert', 'authenticated'),
  ('locations',        'locations_admin_update',               'update', 'authenticated'),
  ('plans',            'plans_select_active',                  'select', 'anon,authenticated'),
  ('plans',            'plans_select_own_history',             'select', 'authenticated'),
  ('plans',            'plans_admin_insert',                   'insert', 'authenticated'),
  ('plans',            'plans_admin_update',                   'update', 'authenticated'),
  ('courses',          'courses_select_all',                   'select', 'anon,authenticated'),
  ('courses',          'courses_admin_insert',                 'insert', 'authenticated'),
  ('courses',          'courses_admin_update',                 'update', 'authenticated'),
  ('courses',          'courses_admin_delete',                 'delete', 'authenticated'),
  ('bookings',         'bookings_select_own_or_admin',         'select', 'authenticated'),
  ('credit_lots',      'credit_lots_select_own_or_admin',      'select', 'authenticated'),
  ('credit_movements', 'credit_movements_select_own_or_admin', 'select', 'authenticated'),
  ('orders',           'orders_select_own_or_admin',           'select', 'authenticated'),
  ('subscriptions',    'subscriptions_select_own_or_admin',    'select', 'authenticated'),
  ('promo_codes',      'promo_codes_admin_select',             'select', 'authenticated'),
  ('promo_codes',      'promo_codes_admin_update',             'update', 'authenticated'),
  ('stripe_events',    'stripe_events_admin_select',           'select', 'authenticated'),
  ('email_log',        'email_log_admin_select',               'select', 'authenticated'),
  ('audit_log',        'audit_log_admin_select',               'select', 'authenticated')
),
reel as (
  select
    c.relname::text as table_name,
    p.polname::text as policy_name,
    case p.polcmd
      when 'r' then 'select' when 'a' then 'insert'
      when 'w' then 'update' when 'd' then 'delete'
      when '*' then 'ALL'
    end as cmd,
    coalesce(
      (select string_agg(r.rolname::text, ',' order by r.rolname)
         from pg_roles r where r.oid = any(p.polroles)),
      'public'
    ) as roles,
    p.polpermissive as permissive
  from pg_policy p
  join pg_class c on c.oid = p.polrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
),
juge as (
  select
    coalesce(a.table_name, r.table_name)   as table_name,
    coalesce(a.policy_name, r.policy_name) as policy_name,
    r.cmd, r.roles,
    case
      when r.policy_name is null then 'MANQUANTE'
      when a.policy_name is null then 'INATTENDUE — ' || r.cmd || ' pour ' || r.roles
      when r.cmd   <> a.cmd      then 'VERBE ' || r.cmd || ' au lieu de ' || a.cmd
      when r.roles <> a.roles    then 'ROLES ' || r.roles || ' au lieu de ' || a.roles
      when not r.permissive      then 'RESTRICTIVE (attendue permissive)'
      else 'ok'
    end as verdict
  from attendu a
  full join reel r on r.policy_name = a.policy_name
)
select * from juge order by (verdict = 'ok'), table_name, policy_name;


-- ---------------------------------------------------------------------------
-- 2. Assertions de securite. Attendu : 18 lignes « ok », echecs en tete.
-- ---------------------------------------------------------------------------

with pol as (
  select c.relname::text as t, p.polcmd
  from pg_policy p
  join pg_class c on c.oid = p.polrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
),
tbl as (
  select c.oid, c.relname::text as t, c.relrowsecurity, c.relforcerowsecurity
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
),
fn as (
  select p.prosecdef, p.provolatile, p.proconfig
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'is_admin'
),
m as (
  select
    (select count(*) from pol where t = 'bookings'
       and polcmd in ('a','w','d','*'))                              as bookings_write_pol,
    (select count(*) from pol where t = 'credit_movements'
       and polcmd in ('w','d','*'))                                  as cm_wd_pol,
    (select count(*) from pol where t = 'credit_movements'
       and polcmd in ('a','*'))                                      as cm_ins_pol,
    (select count(*) from pol where t = 'credit_lots'
       and polcmd in ('a','w','d','*'))                              as cl_write_pol,
    (select count(*) from pol
      where t in ('orders','subscriptions','stripe_events','email_log','audit_log')
        and polcmd in ('a','w','d','*'))                             as journaux_write_pol,
    (select count(*) from tbl
      where has_table_privilege('anon', oid, 'insert')
         or has_table_privilege('anon', oid, 'update')
         or has_table_privilege('anon', oid, 'delete'))              as anon_write_tables,
    (select count(*) from tbl)                                       as nb_tables,
    (select count(*) from tbl where not relrowsecurity)              as rls_off,
    (select count(*) from tbl where relforcerowsecurity)             as rls_forced,
    (select count(*) from fn)                                        as fn_count,
    (select bool_and(prosecdef) from fn)                             as fn_secdef,
    (select bool_and(provolatile = 's') from fn)                     as fn_stable,
    (select bool_and(proconfig is not null and exists (
        select 1 from unnest(proconfig) cfg where left(cfg, 12) = 'search_path='))
       from fn)                                                      as fn_searchpath
),
a as (
  select 1 as n,
    'bookings : aucune policy INSERT / UPDATE / DELETE' as assertion,
    case when bookings_write_pol = 0 then 'ok'
         else 'ECHEC — ' || bookings_write_pol || ' policy d''ecriture' end as verdict
  from m
  union all select 2,
    'bookings : authenticated sans privilege INSERT',
    case when not has_table_privilege('authenticated','public.bookings','insert')
         then 'ok' else 'ECHEC — privilege INSERT accorde' end from m
  union all select 3,
    'bookings : authenticated sans privilege DELETE',
    case when not has_table_privilege('authenticated','public.bookings','delete')
         then 'ok' else 'ECHEC — privilege DELETE accorde' end from m
  union all select 4,
    'bookings : authenticated sans privilege UPDATE',
    case when not has_table_privilege('authenticated','public.bookings','update')
         then 'ok' else 'ECHEC — privilege UPDATE accorde' end from m
  union all select 5,
    'credit_movements : aucune policy UPDATE ni DELETE, pour personne',
    case when cm_wd_pol = 0 then 'ok'
         else 'ECHEC — ' || cm_wd_pol || ' policy UPDATE/DELETE' end from m
  union all select 6,
    'credit_movements : aucun privilege UPDATE / DELETE pour anon ni authenticated',
    case when not (has_table_privilege('anon','public.credit_movements','update')
                or has_table_privilege('anon','public.credit_movements','delete')
                or has_table_privilege('authenticated','public.credit_movements','update')
                or has_table_privilege('authenticated','public.credit_movements','delete'))
         then 'ok' else 'ECHEC — le grand livre est modifiable' end from m
  union all select 7,
    'credit_movements : aucune policy INSERT (les mouvements naissent dans les RPC)',
    case when cm_ins_pol = 0 then 'ok' else 'ECHEC' end from m
  union all select 8,
    'credit_lots : aucune policy d''ecriture',
    case when cl_write_pol = 0 then 'ok'
         else 'ECHEC — ' || cl_write_pol || ' policy d''ecriture' end from m
  union all select 9,
    'orders / subscriptions / stripe_events / email_log / audit_log : lecture seule',
    case when journaux_write_pol = 0 then 'ok'
         else 'ECHEC — ' || journaux_write_pol || ' policy d''ecriture' end from m
  union all select 10,
    'anon : aucun privilege d''ecriture sur aucune table',
    case when anon_write_tables = 0 then 'ok'
         else 'ECHEC — ' || anon_write_tables || ' table(s) ecrivables par anon' end from m
  union all select 11,
    'profiles : anon ne lit rien',
    case when not has_table_privilege('anon','public.profiles','select')
          and not has_column_privilege('anon','public.profiles','email','select')
         then 'ok' else 'ECHEC — anon lit profiles' end from m
  union all select 12,
    'profiles.admin_notes : illisible par anon et par authenticated',
    case when not has_column_privilege('anon','public.profiles','admin_notes','select')
          and not has_column_privilege('authenticated','public.profiles','admin_notes','select')
         then 'ok' else 'ECHEC — les notes privees fuient' end from m
  union all select 13,
    'courses.admin_notes : illisible par anon et par authenticated',
    case when not has_column_privilege('anon','public.courses','admin_notes','select')
          and not has_column_privilege('authenticated','public.courses','admin_notes','select')
         then 'ok' else 'ECHEC — les notes privees fuient' end from m
  union all select 14,
    'profiles.role : non modifiable par authenticated',
    case when not has_column_privilege('authenticated','public.profiles','role','update')
         then 'ok' else 'ECHEC — une cliente peut se promouvoir admin' end from m
  union all select 15,
    'plans et locations : aucun DELETE possible (regle 10, historique des lieux)',
    case when not (has_table_privilege('authenticated','public.plans','delete')
                or has_table_privilege('authenticated','public.locations','delete')
                or has_table_privilege('anon','public.plans','delete')
                or has_table_privilege('anon','public.locations','delete'))
         then 'ok' else 'ECHEC — suppression possible' end from m
  union all select 16,
    'RLS active sur les 13 tables, FORCE sur aucune',
    case when rls_off > 0
           then 'ECHEC — RLS absente sur ' || rls_off || ' table(s)'
         when rls_forced > 0
           then 'ECHEC — FORCE RLS active : is_admin() et les RPC sont casses'
         when nb_tables <> 13
           then 'ECHEC — ' || nb_tables || ' tables au lieu de 13'
         else 'ok' end from m
  union all select 17,
    'is_admin() : SECURITY DEFINER, STABLE, search_path fige',
    case when fn_count = 0        then 'ECHEC — fonction absente'
         when not fn_secdef       then 'ECHEC — pas SECURITY DEFINER'
         when not fn_stable       then 'ECHEC — pas STABLE'
         when not fn_searchpath   then 'ECHEC — search_path non fige'
         else 'ok' end from m
  union all select 18,
    'contre-epreuve : la cliente lit son profil et modifie son prenom, anon voit les places',
    case when has_column_privilege('authenticated','public.profiles','first_name','select')
          and has_column_privilege('authenticated','public.profiles','first_name','update')
          and has_column_privilege('anon','public.courses','seats_taken','select')
          and has_table_privilege('anon','public.locations','select')
         then 'ok'
         else 'ECHEC — l''application ne peut plus lire ce dont elle a besoin' end from m
)
select * from a order by (verdict = 'ok'), n;


-- ---------------------------------------------------------------------------
-- 3. Detail lisible : chaque policy et son expression.
-- ---------------------------------------------------------------------------

select
  c.relname::text as table_name,
  p.polname::text as policy_name,
  case p.polcmd
    when 'r' then 'select' when 'a' then 'insert'
    when 'w' then 'update' when 'd' then 'delete' when '*' then 'ALL'
  end as cmd,
  coalesce(
    (select string_agg(r.rolname::text, ',' order by r.rolname)
       from pg_roles r where r.oid = any(p.polroles)),
    'public') as roles,
  pg_get_expr(p.polqual,      p.polrelid) as using_expr,
  pg_get_expr(p.polwithcheck, p.polrelid) as with_check_expr
from pg_policy p
join pg_class c on c.oid = p.polrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
order by c.relname, p.polname;


-- ---------------------------------------------------------------------------
-- 4. Privileges effectifs, table par table.
-- ---------------------------------------------------------------------------

select
  c.relname::text as table_name,
  r.rolname::text as role,
  has_table_privilege(r.oid, c.oid, 'select') as sel,
  has_table_privilege(r.oid, c.oid, 'insert') as ins,
  has_table_privilege(r.oid, c.oid, 'update') as upd,
  has_table_privilege(r.oid, c.oid, 'delete') as del
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
cross join pg_roles r
where n.nspname = 'public' and c.relkind = 'r'
  and r.rolname in ('anon', 'authenticated')
order by c.relname, r.rolname;
-- Rappel : sur profiles et courses, `sel` vaut false parce que le SELECT est
-- accorde colonne par colonne. Ce n'est pas une erreur, c'est le mecanisme qui
-- protege admin_notes.
