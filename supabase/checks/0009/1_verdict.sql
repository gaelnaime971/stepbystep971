-- ---------------------------------------------------------------------------
-- 0009 — l'index, la fonction, et surtout ses droits.
-- Attendu : six lignes « ok ».
--
-- On interroge has_function_privilege() plutot que de lire proacl a la main :
-- c'est ce qui a servi en 0005, et cela repond a la question qui compte —
-- « ce role peut-il appeler cette fonction ? » — sans dependre de la forme
-- textuelle de l'ACL ni du cas NULL, qui veut dire « ouvert a PUBLIC ».
-- ---------------------------------------------------------------------------

with f as (
  select p.oid
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname = 'admin_refund_revoke_from_lot'
),
m as (
  select
    (select count(*) from f)                                             as presente,
    (select count(*) from pg_indexes
      where schemaname = 'public'
        and indexname = 'email_log_one_refund_per_order')                as index_email,
    (select p.prosecdef from pg_proc p, f where p.oid = f.oid)           as secdef,
    (select exists (select 1 from unnest(p.proconfig) cfg, f
                     where p.oid = f.oid and left(cfg, 12) = 'search_path=')
       from pg_proc p, f where p.oid = f.oid)                            as searchpath,
    (select count(*) from f where has_function_privilege('authenticated', oid, 'execute'))
                                                                          as par_authenticated,
    (select count(*) from f where has_function_privilege('anon', oid, 'execute'))
                                                                          as par_anon,
    (select count(*) from f where has_function_privilege('service_role', oid, 'execute'))
                                                                          as par_service
)
select 1 as n, 'la fonction existe' as assertion,
       case when presente = 1 then 'ok' else 'ECHEC — absente' end as verdict from m
union all select 2, 'l''index d''unicite de l''email existe',
       case when index_email = 1 then 'ok' else 'ECHEC — index absent' end from m
union all select 3, 'elle est SECURITY DEFINER',
       case when secdef then 'ok' else 'ECHEC' end from m
union all select 4, 'son search_path est fige',
       case when searchpath then 'ok' else 'ECHEC — search_path libre' end from m
union all select 5, 'authenticated peut l''appeler',
       case when par_authenticated = 1 then 'ok' else 'ECHEC — GRANT manquant' end from m
union all select 6,
       'ni anon ni service_role ne peuvent l''appeler',
       case when par_anon = 0 and par_service = 0 then 'ok'
            else 'ECHEC — ' ||
                 case when par_anon > 0 then 'anon ' else '' end ||
                 case when par_service > 0 then 'service_role ' else '' end ||
                 '(revocation aux quatre roles oubliee : les privileges par defaut ' ||
                 'de Supabase accordent EXECUTE nominativement, revoquer a PUBLIC ne suffit pas)'
       end from m
order by verdict desc, n;

-- NOTE — les comptes de supabase/checks/0005/3_assertions.sql bougent apres
-- cette migration : 27 fonctions au lieu de 26, et authenticated en execute 15
-- au lieu de 14. C'est attendu, et c'est la seule facon de le savoir sans
-- relire le fichier. Ne le corrige pas : 0005 dit ce qui etait vrai le jour de
-- son passage.
