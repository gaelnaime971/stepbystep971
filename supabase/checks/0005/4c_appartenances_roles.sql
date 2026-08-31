-- 4c. Appartenances de roles : verifie qu'aucun des trois roles PostgREST
--     n'herite d'un role proprietaire. Attendu : aucune ligne surprenante.
select r.rolname::text as role, g.rolname::text as membre_de
from pg_auth_members m
join pg_roles r on r.oid = m.member
join pg_roles g on g.oid = m.roleid
where r.rolname in ('anon', 'authenticated', 'service_role')
order by r.rolname, g.rolname;
