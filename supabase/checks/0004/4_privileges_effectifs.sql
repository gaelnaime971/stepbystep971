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
