-- ---------------------------------------------------------------------------
-- 0014 — le même garde-fou, avec une session simulée.
--
-- `auth.uid()` lit une variable de session. On la pose à la main pour
-- atteindre le contrôle du prix, que le fichier 4 ne peut pas franchir.
-- Transaction annulée : rien n'est gardé.
-- ---------------------------------------------------------------------------

begin;

select set_config(
  'request.jwt.claims',
  json_build_object('sub', (select id from public.profiles order by created_at limit 1))::text,
  true
);

-- Le slug de la formule la PLUS CHÈRE. Doit être refusé.
select public.prendre_formule_offerte(
  (select slug from public.plans where price_cents > 0 order by price_cents desc limit 1)
);

rollback;

-- ATTENDU : ERROR SB014 — « Cette formule n'est pas gratuite. »
--
-- Si un identifiant de lot sort, NE DÉPLOIE PAS : n'importe quelle cliente
-- obtiendrait le pack à 400 € sans payer.
