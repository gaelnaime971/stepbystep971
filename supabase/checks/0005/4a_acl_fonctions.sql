-- ---------------------------------------------------------------------------
-- 4. D'ou viennent les droits. A lancer si une assertion de la section 3 tombe :
--    ces trois requetes disent si un privilege vient d'un GRANT nominatif,
--    d'un heritage de role, ou des privileges par defaut du schema.
-- ---------------------------------------------------------------------------

-- 4a. L'ACL brute de quelques fonctions. Un GRANT nominatif s'y lit
--     « role=X/proprietaire ». Une ligne commencant par « = » est PUBLIC.
select p.proname::text as fonction,
       coalesce(array_to_string(p.proacl, E'\n'), '(aucune ACL : PUBLIC par defaut)') as acl
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('credit_order', 'book_course', 'log_audit', 'is_admin')
order by p.proname;
