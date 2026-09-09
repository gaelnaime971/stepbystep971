-- 0009 — la meme chose en lisible, si l'assertion 5 dit ECHEC.
-- Attendu : une seule ligne, authenticated.

select p.proname,
       coalesce(a.grantee, '(aucun)') as role_avec_execute
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  left join lateral aclexplode(p.proacl) x on true
  left join lateral (select pg_get_userbyid(x.grantee) as grantee) a on true
 where n.nspname = 'public'
   and p.proname = 'admin_refund_revoke_from_lot'
   and (x.privilege_type = 'EXECUTE' or x.privilege_type is null);
