-- Verification apres 0001. Attendu : 2 lignes extensions, 12 lignes types, 42 valeurs.

-- 1. Les deux extensions doivent etre dans le schema `extensions`.
--    Si citext apparait ailleurs (public, ou un schema pre-existant), 0002
--    echouera sur le type `extensions.citext` : voir la note du runbook.
select e.extname, n.nspname as schema_installe
from pg_extension e
join pg_namespace n on n.oid = e.extnamespace
where e.extname in ('citext', 'pg_trgm')
order by e.extname;

-- 2. Les 12 enums et leur nombre de valeurs.
select t.typname as type_name, count(l.enumlabel)::int as valeurs
from pg_type t
join pg_namespace n on n.oid = t.typnamespace
left join pg_enum l on l.enumtypid = t.oid
where n.nspname = 'public' and t.typtype = 'e'
group by t.typname
order by t.typname;

-- 3. Verdict chiffre.
select
  (select count(*) from pg_extension e
     join pg_namespace n on n.oid = e.extnamespace
    where e.extname in ('citext','pg_trgm') and n.nspname = 'extensions')::int as extensions_ok,
  (select count(*) from pg_type t
     join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typtype = 'e')::int as types,
  (select count(*) from pg_enum l
     join pg_type t on t.oid = l.enumtypid
     join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public')::int as valeurs_totales;
-- Attendu : extensions_ok = 2, types = 12, valeurs_totales = 42.
