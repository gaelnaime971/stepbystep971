-- 0014 — rien n'a bougé. À comparer avec ce que tu vois AVANT.

select 'formules'              as quoi, count(*)::text as combien from public.plans
union all
select 'commandes payées',     count(*)::text from public.orders where status = 'paid'
union all
select 'commandes gratuites',  count(*)::text from public.orders where kind = 'free'
union all
select 'lots de séances',      count(*)::text from public.credit_lots
union all
select 'lots offerts',         count(*)::text from public.credit_lots where origin = 'offert'
union all
select 'mouvements',           count(*)::text from public.credit_movements;

-- Attendu : les mêmes nombres qu'avant, et 0 sur les deux lignes « gratuites »
-- et « offerts » — le code n'est pas déployé, personne n'a rien pris.
