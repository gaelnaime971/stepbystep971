-- Les cles etrangeres, en clair. Attendu : 31 lignes.
select
  src.relname::text  as depuis,
  a.attname::text    as colonne,
  tgt.relname::text  as vers,
  case k.confdeltype
    when 'a' then 'no action' when 'r' then 'restrict'
    when 'c' then 'cascade'   when 'n' then 'set null'
    when 'd' then 'set default'
  end as on_delete
from pg_constraint k
join pg_class src on src.oid = k.conrelid
join pg_class tgt on tgt.oid = k.confrelid
join pg_namespace n on n.oid = src.relnamespace
join unnest(k.conkey) with ordinality as ck(attnum, ord) on true
join pg_attribute a on a.attrelid = k.conrelid and a.attnum = ck.attnum
where n.nspname = 'public' and k.contype = 'f'
order by src.relname, a.attname;
