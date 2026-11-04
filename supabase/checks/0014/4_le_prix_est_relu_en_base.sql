-- ---------------------------------------------------------------------------
-- 0014 — le garde-fou qui compte le plus.
--
-- Une cliente qui appelle le RPC avec le slug d'une formule PAYANTE doit être
-- refusée. Sans ce contrôle, elle se créditerait trente séances avec le slug
-- du pack à 400 €.
-- ---------------------------------------------------------------------------

set local role authenticated;

select public.prendre_formule_offerte(
  (select slug from public.plans where price_cents > 0 order by price_cents desc limit 1)
);

reset role;

-- ATTENDU, dans cet ordre de priorité :
--   * ERROR SB009 « Connecte-toi pour prendre cette formule. » — normal ici,
--     il n'y a pas de session dans le SQL Editor : auth.uid() est NULL.
--     Le contrôle du prix vient juste après, il est vérifié par le fichier 5.
--
-- Ce qu'il ne faut JAMAIS voir : un identifiant de lot en retour.
