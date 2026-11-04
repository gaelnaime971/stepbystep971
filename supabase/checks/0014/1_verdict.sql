-- 0014 — l'index, le CHECK, les deux fonctions et leurs droits.
-- Attendu : huit lignes « ok ».

with f as (
  select p.oid, p.proname::text as nom, pg_get_functiondef(p.oid) as src
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname in ('credit_order', 'prendre_formule_offerte')
),
m as (
  select
    (select count(*) from pg_indexes
      where schemaname='public' and indexname='orders_une_seule_gratuite_par_formule') as idx,
    (select indexdef from pg_indexes
      where schemaname='public' and indexname='orders_une_seule_gratuite_par_formule') as idxdef,
    (select pg_get_constraintdef(c.oid) from pg_constraint c
       join pg_class t on t.oid=c.conrelid join pg_namespace n on n.oid=t.relnamespace
      where n.nspname='public' and t.relname='credit_lots'
        and c.conname='credit_lots_origin_shape')                                      as shape,
    (select src from f where nom='credit_order')                                       as src_credit,
    (select count(*) from f where nom='prendre_formule_offerte')                       as rpc,
    (select count(*) from f where nom='prendre_formule_offerte'
       and has_function_privilege('authenticated', oid, 'execute'))                    as rpc_auth,
    (select count(*) from f where nom='prendre_formule_offerte'
       and (has_function_privilege('anon', oid, 'execute')
         or has_function_privilege('service_role', oid, 'execute')))                   as rpc_trop,
    (select count(*) from f where nom='credit_order'
       and (has_function_privilege('authenticated', oid, 'execute')
         or has_function_privilege('anon', oid, 'execute')))                           as credit_expose
)
select 1 as n, 'l''index d''unicité existe' as assertion,
       case when idx = 1 then 'ok' else 'ECHEC — absent' end as verdict from m
union all select 2,
       'il porte sur kind = ''free'', PAS sur le montant',
       case when idxdef like '%kind = ''free''%' and idxdef not like '%amount_cents%' then 'ok'
            else 'ECHEC — un code promo à 100 % serait confondu avec une inscription offerte' end from m
union all select 3, 'le CHECK des lots accepte « offert »',
       case when shape like '%offert%' then 'ok' else 'ECHEC' end from m
union all select 4, 'credit_order sait poser une origine « offert »',
       case when src_credit like '%offert%' then 'ok' else 'ECHEC — 0014 n''est pas passée' end from m
union all select 5,
       'credit_order garde la règle 2 intacte',
       case when src_credit like '%subscription_reset%' and src_credit like '%superseded%'
            then 'ok' else 'ECHEC — la remise à zéro de l''abonnement a sauté' end from m
union all select 6, 'le RPC gratuit existe',
       case when rpc = 1 then 'ok' else 'ECHEC' end from m
union all select 7, 'seul authenticated peut l''appeler',
       case when rpc_auth = 1 and rpc_trop = 0 then 'ok' else 'ECHEC — droits mal posés' end from m
union all select 8,
       'credit_order reste hors de portée d''une cliente',
       case when credit_expose = 0 then 'ok'
            else 'ECHEC — n''importe qui pourrait se créditer des séances' end from m
order by verdict desc, n;
