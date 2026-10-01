-- =============================================================================
-- REVERT 0012 — PEUT ECHOUER, ET C'EST NORMAL
-- =============================================================================
--
-- Remet la contrainte d'exclusion. Elle ne se reposera QUE si plus aucun couple
-- de cours `scheduled` ne se chevauche. Si Oriane en a cree depuis, Postgres
-- refusera, et il faudra d'abord choisir lesquels annuler.
--
-- Pour savoir avant d'essayer :
--
--   select a.id, a.starts_at, b.id, b.starts_at
--     from public.courses a
--     join public.courses b
--       on a.id < b.id
--      and a.status = 'scheduled' and b.status = 'scheduled'
--      and tstzrange(a.starts_at, a.ends_at, '[)')
--       && tstzrange(b.starts_at, b.ends_at, '[)');
--
-- Aucune ligne : le revert passera.

alter table public.courses
  add constraint courses_no_overlap exclude using gist (
    tstzrange(starts_at, ends_at, '[)') with &&
  ) where (status = 'scheduled');

comment on table public.courses is
  'seats_taken est denormalise, maintenu par trigger sur bookings (0005).';
