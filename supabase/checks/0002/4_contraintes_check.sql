-- Les contraintes CHECK et l'exclusion, en clair. Attendu : 49 lignes (48 + 1).
select
  c.relname::text as table_name,
  k.conname::text as contrainte,
  pg_get_constraintdef(k.oid) as definition
from pg_constraint k
join pg_class c on c.oid = k.conrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and k.contype in ('c', 'x')
order by c.relname, k.conname;
