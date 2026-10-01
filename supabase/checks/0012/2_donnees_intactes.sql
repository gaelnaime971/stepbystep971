-- 0012 — rien n'a bougé. À comparer avec ce que tu vois AVANT.

select 'cours au total'        as quoi, count(*)::text as combien from public.courses
union all
select 'cours à venir',        count(*)::text from public.courses
 where status = 'scheduled' and starts_at > now()
union all
select 'réservations actives', count(*)::text from public.bookings where status = 'booked'
union all
select 'places prises',        coalesce(sum(seats_taken), 0)::text from public.courses;

-- Attendu : les mêmes nombres qu'avant.
