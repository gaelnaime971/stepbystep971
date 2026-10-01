-- 0012 — la contrainte est partie, et rien d'autre n'a bougé. Attendu : cinq « ok ».

with m as (
  select
    (select count(*) from pg_constraint c
       join pg_class t on t.oid = c.conrelid
       join pg_namespace n on n.oid = t.relnamespace
      where n.nspname = 'public' and t.relname = 'courses'
        and c.conname = 'courses_no_overlap')                      as contrainte,
    (select count(*) from pg_indexes
      where schemaname = 'public' and tablename = 'courses'
        and indexdef ilike '%gist%')                               as index_gist,
    (select count(*) from pg_constraint c
       join pg_class t on t.oid = c.conrelid
       join pg_namespace n on n.oid = t.relnamespace
      where n.nspname = 'public' and t.relname = 'courses'
        and c.contype = 'c')                                       as checks_restants,
    (select c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = 'courses')         as rls,
    (select count(*) from public.courses)                           as cours
)
select 1 as n, 'courses_no_overlap a disparu' as assertion,
       case when contrainte = 0 then 'ok' else 'ECHEC — toujours là' end as verdict from m
union all select 2, 'son index GiST a disparu avec elle',
       case when index_gist = 0 then 'ok'
            else 'ECHEC — ' || index_gist || ' index GiST restant(s) sur courses' end from m
union all select 3, 'les autres CHECK de courses sont intacts',
       case when checks_restants >= 3 then 'ok'
            else 'ECHEC — ' || checks_restants || ' CHECK, la table a perdu autre chose' end from m
union all select 4, 'la RLS est toujours active',
       case when rls then 'ok' else 'ECHEC — table exposée' end from m
union all select 5, 'aucun cours n''a été supprimé',
       case when cours > 0 then 'ok — ' || cours || ' cours en base'
            else 'ECHEC — la table est vide' end from m
order by verdict desc, n;
