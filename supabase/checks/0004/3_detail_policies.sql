-- ---------------------------------------------------------------------------
-- 3. Detail lisible : chaque policy et son expression.
-- ---------------------------------------------------------------------------

select
  c.relname::text as table_name,
  p.polname::text as policy_name,
  case p.polcmd
    when 'r' then 'select' when 'a' then 'insert'
    when 'w' then 'update' when 'd' then 'delete' when '*' then 'ALL'
  end as cmd,
  coalesce(
    (select string_agg(r.rolname::text, ',' order by r.rolname)
       from pg_roles r where r.oid = any(p.polroles)),
    'public') as roles,
  pg_get_expr(p.polqual,      p.polrelid) as using_expr,
  pg_get_expr(p.polwithcheck, p.polrelid) as with_check_expr
from pg_policy p
join pg_class c on c.oid = p.polrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
order by c.relname, p.polname;
