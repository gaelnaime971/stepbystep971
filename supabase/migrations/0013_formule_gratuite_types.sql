-- =============================================================================
-- 0013 — Une formule peut etre gratuite
-- Step by Step Coaching
--
-- Jouee sur une base VIVANTE. Additive : une contrainte assouplie, une
-- contrainte ajoutee, deux valeurs d'enum. Aucune ligne existante ne devient
-- invalide — les neuf formules en base ont toutes un prix strictement positif
-- et aucune n'est concernee.
--
-- POURQUOI DEUX FICHIERS. `alter type ... add value` s'execute dans une
-- transaction depuis PostgreSQL 12, mais la valeur ajoutee n'y est PAS
-- utilisable avant la validation. Or 0014 cree un index partiel dont le
-- `where` compare `kind` a 'free', et etend un CHECK qui nomme 'offert'. Dans
-- la meme execution, Postgres refuserait avec « unsafe use of new value of
-- enum type ». Il faut donc les passer l'un APRES l'autre.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- Un prix peut valoir zero
-- ---------------------------------------------------------------------------
--
-- Oriane veut une semaine portes ouvertes : les participantes s'inscrivent sur
-- le site, recoivent une seance offerte, et reservent leur cours normalement.
--
-- CE QUE CETTE LIGNE NE FAIT PAS : elle n'ouvre PAS le paiement a 0 EUR.
-- Stripe Checkout refuse une session a zero. Une formule gratuite ne passe pas
-- du tout par Stripe — ni produit, ni prix, ni session — et c'est 0014 qui
-- pose le chemin separe.

alter table public.plans
  drop constraint plans_price_positive;

alter table public.plans
  add constraint plans_price_non_negative check (price_cents >= 0);


-- ---------------------------------------------------------------------------
-- Mais un abonnement gratuit, jamais
-- ---------------------------------------------------------------------------
--
-- Un abonnement a 0 EUR serait un piege durable, et silencieux. Sans
-- prelevement Stripe il n'y a pas d'`invoice.paid`, donc pas de `credit_order`
-- au cycle suivant : le solde ne se rechargerait JAMAIS, alors que l'interface
-- promet « rechargé toutes les 4 semaines ». La cliente le decouvrirait au
-- bout de 28 jours, sans rien a reclamer.
--
-- Une formule gratuite est donc forcement `single` ou `pack`. L'interface le
-- dira aussi, mais c'est ici que ca se refuse.

alter table public.plans
  add constraint plans_gratuite_non_recurrente
  check (price_cents > 0 or kind <> 'subscription');


-- ---------------------------------------------------------------------------
-- Les deux valeurs d'enum
-- ---------------------------------------------------------------------------

-- La NATURE de la commande, et non son montant. Le discriminant ne peut pas
-- etre `amount_cents = 0` : une formule payante achetee avec un code promo a
-- 100 % tombe aussi a zero, et serait confondue avec une inscription offerte —
-- l'index d'unicite de 0014 la refuserait a tort.
--
-- Stripe ne produit jamais cette valeur : aucun webhook n'ecrit 'free'. C'est
-- ce qui rend la branche gratuite de `credit_order` inatteignable depuis le
-- chemin qui encaisse.
alter type public.order_kind add value if not exists 'free';

-- Pour que le grand livre se lise SANS JOINTURE. Un lot `order` dont il
-- faudrait aller lire la commande pour savoir qu'elle etait a zero raconte mal
-- son histoire ; deux ans plus tard, personne ne fera la jointure.
alter type public.lot_origin add value if not exists 'offert';
