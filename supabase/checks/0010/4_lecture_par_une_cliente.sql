-- 0010 — la lecture que fera le site à chaque ouverture de /compte,
-- jouée avec les droits d'une cliente connectée.
--
-- Sans session, auth.uid() est NULL : la policy ne laisse donc rien passer, et
-- c'est le bon résultat. Ce qu'on vérifie ici, c'est que la requête est
-- ACCEPTÉE — pas qu'elle rend des lignes.

set local role authenticated;

select id, version, accepted_at, autorisation_image, origine
  from public.charte_acceptations
 where user_id = auth.uid()
 order by accepted_at desc
 limit 1;

reset role;

-- Attendu : aucune ligne, sans erreur.
-- Une erreur « permission denied for table charte_acceptations » signifierait
-- que la policy de lecture n'est pas passée.
