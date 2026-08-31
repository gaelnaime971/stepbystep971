-- 2. Les 12 enums et leur nombre de valeurs.
select t.typname as type_name, count(l.enumlabel)::int as valeurs
from pg_type t
join pg_namespace n on n.oid = t.typnamespace
left join pg_enum l on l.enumtypid = t.oid
where n.nspname = 'public' and t.typtype = 'e'
group by t.typname
order by t.typname;
