-- Verification apres 0002.
-- La requete principale rend un verdict par table : tout doit dire « ok ».

with attendu (table_name, checks, fks) as (values
  ('profiles',          2, 1),
  ('locations',         1, 0),
  ('plans',            10, 0),
  ('promo_codes',       8, 1),
  ('subscriptions',     3, 2),
  ('orders',            8, 4),
  ('credit_lots',       5, 5),
  ('courses',           4, 2),
  ('bookings',          2, 4),
  ('credit_movements',  2, 5),
  ('stripe_events',     2, 0),
  ('email_log',         0, 6),
  ('audit_log',         1, 1)
),
reel as (
  select
    c.relname::text  as table_name,
    c.relrowsecurity as rls,
    (select count(*)::int from pg_constraint k
      where k.conrelid = c.oid and k.contype = 'c') as checks,
    (select count(*)::int from pg_constraint k
      where k.conrelid = c.oid and k.contype = 'f') as fks,
    (select count(*)::int from pg_constraint k
      where k.conrelid = c.oid and k.contype = 'x') as exclusions,
    (select count(*)::int from pg_policy p
      where p.polrelid = c.oid) as policies
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
),
juge as (
  select
    coalesce(a.table_name, r.table_name) as table_name,
    r.rls, r.policies, r.exclusions,
    r.checks, a.checks as checks_attendus,
    r.fks,    a.fks    as fks_attendus,
    case
      when r.table_name is null  then 'MANQUANTE'
      when a.table_name is null  then 'INATTENDUE (hors schema Step by Step)'
      when r.rls is not true     then 'RLS DESACTIVEE'
      when r.policies <> 0       then 'POLICY INATTENDUE (0004 n''est pas encore joue)'
      when r.checks <> a.checks  then 'CHECK ' || r.checks || ' au lieu de ' || a.checks
      when r.fks    <> a.fks     then 'FK '    || r.fks    || ' au lieu de ' || a.fks
      else 'ok'
    end as verdict
  from attendu a
  full join reel r on r.table_name = a.table_name
)
select * from juge order by (verdict = 'ok'), table_name;
