-- Verification apres 0001. Attendu : 2 lignes extensions, 12 lignes types, 42 valeurs.

-- 1. Les deux extensions doivent etre dans le schema `extensions`.
--    Si citext apparait ailleurs (public, ou un schema pre-existant), 0002
--    echouera sur le type `extensions.citext` : voir la note du runbook.
select e.extname, n.nspname as schema_installe
from pg_extension e
join pg_namespace n on n.oid = e.extnamespace
where e.extname in ('citext', 'pg_trgm')
order by e.extname;
