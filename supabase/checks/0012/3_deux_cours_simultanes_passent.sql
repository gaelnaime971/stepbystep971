-- ---------------------------------------------------------------------------
-- 0012 — la contre-épreuve : deux cours au même créneau s'insèrent désormais.
--
-- Tout se fait dans une transaction annulée à la fin : rien n'est gardé.
-- ---------------------------------------------------------------------------

begin;

insert into public.courses (location_id, starts_at, ends_at, capacity)
select id, '2099-01-01T22:00:00Z', '2099-01-01T23:00:00Z', 10
  from public.locations limit 1;

-- Celui-ci chevauche entièrement le précédent. AVANT 0012, il échouait en
-- 23P01 sur courses_no_overlap.
insert into public.courses (location_id, starts_at, ends_at, capacity)
select id, '2099-01-01T22:00:00Z', '2099-01-01T23:00:00Z', 10
  from public.locations limit 1;

select count(*) as cours_simultanes_crees
  from public.courses where starts_at = '2099-01-01T22:00:00Z';

rollback;

-- Attendu : 2, puis le rollback efface tout.
-- Vérifie après coup qu'il ne reste rien en 2099 :
--   select count(*) from public.courses where starts_at > '2098-01-01';
