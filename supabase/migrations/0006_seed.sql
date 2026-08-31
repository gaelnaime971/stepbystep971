-- =============================================================================
-- 0006 — Seed : les 3 lieux et les 6 formules
-- Step by Step Coaching
--
-- Rejouable : ON CONFLICT DO NOTHING sur les cles naturelles (locations.name,
-- plans.slug). Un second passage ne fait rien, volontairement. Corriger une
-- formule deja vendue n'est de toute facon pas possible (regle 10, trigger
-- plans_guard_immutable) : on en cree une nouvelle et on archive l'ancienne.
--
-- stripe_price_id et stripe_product_id restent NULL. Ils seront renseignes
-- depuis l'admin apres creation des prix cote Stripe. C'est ce qui permet de
-- passer en production sans toucher au code : aucune reference Stripe n'est
-- ecrite en dur nulle part.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- Les lieux
-- ---------------------------------------------------------------------------

insert into public.locations (name, city, sort_order) values
  ('Les Abymes', 'Les Abymes', 1),
  ('Le Moule',   'Le Moule',   2),
  ('Jarry',      'Baie-Mahault', 3)
on conflict (name) do nothing;

-- Jarry est une zone de Baie-Mahault : c'est le nom que les clientes emploient,
-- donc c'est celui qui s'affiche. La commune reste dans `city`.
-- `address` est laisse vide : Oriane le renseignera depuis l'admin.


-- ---------------------------------------------------------------------------
-- Les six formules
-- ---------------------------------------------------------------------------
--
-- Les libelles sont accentues, contrairement aux commentaires de ce fichier :
-- ce sont des donnees affichees aux clientes, pas du commentaire technique.
-- Meme regle pour le ton : tutoiement, phrases courtes, pas de majuscule
-- decorative.
--
-- Les prix sont en CENTIMES. 15 € = 1500.
--
-- Validites : interval '4 weeks' est stocke par Postgres comme 28 jours — les
-- semaines sont converties, les mois ne le sont pas. C'est exactement ce que
-- veut la regle 3 : l'abonnement est en 4 semaines, jamais en mois, et la
-- contrainte plans_subscription_is_four_weeks le verrouille.
-- Cote Stripe, ces deux prix doivent etre crees en
-- `interval: week, interval_count: 4`.

insert into public.plans (
  slug, name, tagline, kind, sessions_count, validity_interval,
  price_cents, compare_at_price_cents, cancellation_deadline_hours,
  is_highlighted, features, sort_order
) values

  ('a-la-carte', 'À la carte', 'Pour tester sans t''engager',
   'single', 1, interval '1 month',
   1500, null, 24, false,
   array['1 séance', 'Valable 1 mois', 'Aucun engagement'], 1),

  ('abonnement-4', 'Abonnement 4 séances', 'Une fois par semaine',
   'subscription', 4, interval '4 weeks',
   5000, null, 24, false,
   array['4 séances, soit 1 par semaine', 'Rechargé automatiquement', 'Résiliable quand tu veux'], 2),

  ('abonnement-8', 'Abonnement 8 séances', 'Deux fois par semaine',
   'subscription', 8, interval '4 weeks',
   7000, null, 24, true,
   array['8 séances, soit 2 par semaine', 'Rechargé automatiquement', 'Résiliable quand tu veux'], 3),

  ('pack-5', 'Pack 5 séances', 'Tu viens à ton rythme',
   'pack', 5, interval '3 months',
   7000, 7500, 24, false,
   array['5 séances', 'Valables 3 mois', 'Tu viens quand tu peux'], 4),

  ('pack-15', 'Pack 15 séances', 'Le bon compromis',
   'pack', 15, interval '3 months',
   20000, 22500, 24, false,
   array['15 séances', 'Valables 3 mois', 'Tu viens quand tu peux'], 5),

  ('pack-30', 'Pack 30 séances', 'Le meilleur tarif à la séance',
   'pack', 30, interval '3 months',
   40000, 45000, 24, false,
   array['30 séances', 'Valables 3 mois', 'Moins de 14 € la séance'], 6)

on conflict (slug) do nothing;

-- L'abonnement 8 porte is_highlighted : c'est la pastille « Le plus choisi »
-- de la vitrine. Un seul plan doit la porter a la fois.
