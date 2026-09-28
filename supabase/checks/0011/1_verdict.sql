-- 0011 — la fonction efface bien la trace technique. Attendu : quatre « ok ».

with f as (
  select p.oid, pg_get_functiondef(p.oid) as src
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'anonymize_profile'
)
select 1 as n, 'elle touche charte_acceptations' as assertion,
       case when (select src from f) like '%charte_acceptations%' then 'ok'
            else 'ECHEC — 0011 n''est pas passee' end as verdict
union all select 2, 'elle vide ip ET user_agent',
       case when (select src from f) like '%ip = null%'
             and (select src from f) like '%user_agent = null%'
            then 'ok' else 'ECHEC' end
union all select 3,
       'elle ne SUPPRIME pas les consentements',
       case when (select src from f) not like '%delete from public.charte_acceptations%'
            then 'ok' else 'ECHEC — la preuve du refus d''image disparaitrait' end
union all select 4, 'seul authenticated peut l''appeler',
       case when (select count(*) from f where has_function_privilege('authenticated', oid, 'execute')) = 1
             and (select count(*) from f where has_function_privilege('anon', oid, 'execute')) = 0
             and (select count(*) from f where has_function_privilege('service_role', oid, 'execute')) = 0
            then 'ok' else 'ECHEC — droits mal reposes' end
order by verdict desc, n;
