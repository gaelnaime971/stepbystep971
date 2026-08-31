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
