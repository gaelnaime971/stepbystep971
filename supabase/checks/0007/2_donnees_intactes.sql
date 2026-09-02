-- Les cours existants ne doivent avoir ete ni touches ni etiquetes.
-- Attendu : autant de cours qu'avant la migration, TOUS avec level a NULL,
-- et les reservations inchangees.

select
  count(*)::int                                     as cours_au_total,
  count(*) filter (where level is null)::int        as sans_niveau,
  count(*) filter (where level is not null)::int    as avec_niveau,
  (select count(*)::int from public.bookings
    where status = 'booked')                        as reservations_actives,
  (select coalesce(sum(seats_taken), 0)::int
     from public.courses where status = 'scheduled') as places_prises
from public.courses;

-- Juste apres la migration : avec_niveau doit valoir 0.
-- reservations_actives et places_prises doivent etre identiques a ce que tu
-- lisais avant : la migration n'a touche aucune reservation.
