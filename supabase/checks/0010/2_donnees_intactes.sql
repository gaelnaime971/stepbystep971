-- 0010 — rien n'a bougé ailleurs. À comparer avec ce que tu vois AVANT.

select 'comptes'                as quoi, count(*)::text as combien from public.profiles
union all
select 'cours',                 count(*)::text from public.courses
union all
select 'réservations actives',  count(*)::text from public.bookings where status = 'booked'
union all
select 'commandes payées',      count(*)::text from public.orders  where status = 'paid'
union all
select 'consentements',         count(*)::text from public.charte_acceptations;

-- Attendu : les mêmes nombres qu'avant, et 0 consentement — personne n'a encore
-- rien signé, le code n'est pas déployé.
