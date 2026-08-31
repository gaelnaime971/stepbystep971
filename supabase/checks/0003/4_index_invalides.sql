-- Aucun index invalide (un CREATE INDEX interrompu en laisse un derriere lui).
-- Attendu : 0 ligne.
select c.relname as index_invalide
from pg_index i
join pg_class c on c.oid = i.indexrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and not i.indisvalid;
