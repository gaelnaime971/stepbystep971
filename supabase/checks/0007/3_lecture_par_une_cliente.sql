-- Contre-epreuve : la requete que fait REELLEMENT le site pour le planning,
-- jouee avec les droits d'une cliente connectee.
--
-- Si le GRANT de la colonne manquait, cette requete echouerait ici plutot que
-- devant une cliente.

set local role authenticated;

select id, starts_at, ends_at, capacity, seats_taken, status, location_id, level
  from public.courses
 where status = 'scheduled'
 order by starts_at
 limit 5;

reset role;

-- Attendu : des lignes, ou aucune ligne s'il n'y a pas de cours a venir.
-- Une erreur « permission denied for column level » signifie que le GRANT
-- de 0007 n'est pas passe.
