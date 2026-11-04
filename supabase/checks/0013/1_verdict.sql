-- 0013 — les contraintes et les deux valeurs d'enum. Attendu : six « ok ».

with m as (
  select
    (select count(*) from pg_constraint c join pg_class t on t.oid = c.conrelid
       join pg_namespace n on n.oid = t.relnamespace
      where n.nspname='public' and t.relname='plans'
        and c.conname='plans_price_positive')                        as ancienne,
    (select pg_get_constraintdef(c.oid) from pg_constraint c
       join pg_class t on t.oid = c.conrelid
       join pg_namespace n on n.oid = t.relnamespace
      where n.nspname='public' and t.relname='plans'
        and c.conname='plans_price_non_negative')                    as nouvelle,
    (select pg_get_constraintdef(c.oid) from pg_constraint c
       join pg_class t on t.oid = c.conrelid
       join pg_namespace n on n.oid = t.relnamespace
      where n.nspname='public' and t.relname='plans'
        and c.conname='plans_gratuite_non_recurrente')               as recurrente,
    (select count(*) from unnest(enum_range(null::public.order_kind)) v
      where v::text = 'free')                                        as kind_free,
    (select count(*) from unnest(enum_range(null::public.lot_origin)) v
      where v::text = 'offert')                                      as origin_offert,
    (select count(*) from public.plans)                              as formules,
    (select count(*) from public.plans where price_cents <= 0)       as gratuites
)
select 1 as n, 'plans_price_positive a disparu' as assertion,
       case when ancienne = 0 then 'ok' else 'ECHEC — toujours là' end as verdict from m
union all select 2, 'plans_price_non_negative autorise zéro',
       case when nouvelle like '%>= 0%' then 'ok'
            else 'ECHEC — ' || coalesce(nouvelle, 'absente') end from m
union all select 3, 'un abonnement ne peut pas être gratuit',
       case when recurrente is not null then 'ok' else 'ECHEC — contrainte absente' end from m
union all select 4, 'order_kind connaît « free »',
       case when kind_free = 1 then 'ok' else 'ECHEC' end from m
union all select 5, 'lot_origin connaît « offert »',
       case when origin_offert = 1 then 'ok' else 'ECHEC' end from m
union all select 6, 'les formules existantes sont intactes',
       case when formules >= 9 and gratuites = 0
            then 'ok — ' || formules || ' formules, aucune à zéro'
            else 'ECHEC — ' || formules || ' formules, ' || gratuites || ' à zéro' end from m
order by verdict desc, n;
