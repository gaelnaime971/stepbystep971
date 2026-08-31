-- 4b. Les privileges par defaut du schema. C'est la que se voit la ligne
--     Supabase qui accorde EXECUTE a anon, authenticated ET service_role sur
--     toute fonction creee. defaclobjtype : 'f' = fonctions, 'r' = tables.
select pg_get_userbyid(d.defaclrole) as pose_par,
       coalesce(n.nspname, '(tous schemas)') as schema,
       case d.defaclobjtype when 'f' then 'fonctions' when 'r' then 'tables'
                            when 'S' then 'sequences' else d.defaclobjtype::text end as objets,
       array_to_string(d.defaclacl, E'\n') as privileges_par_defaut
from pg_default_acl d
left join pg_namespace n on n.oid = d.defaclnamespace
order by schema, objets;
