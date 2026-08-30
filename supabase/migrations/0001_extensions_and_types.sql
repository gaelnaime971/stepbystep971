-- =============================================================================
-- 0001 — Extensions et types
-- Step by Step Coaching
--
-- Aucune table ici : uniquement les briques que 0002 consomme.
--
-- Note search_path : citext est installe dans le schema `extensions`, la
-- convention Supabase. Les operateurs citext (=, ~) ne sont resolus que si
-- `extensions` est dans le search_path. C'est le cas par defaut pour les roles
-- Supabase, mais toute fonction de 0005 fixera son search_path explicitement
-- plutot que de compter dessus.
-- =============================================================================

create extension if not exists citext  with schema extensions;
create extension if not exists pg_trgm with schema extensions;

-- gen_random_uuid() fait partie du coeur de Postgres depuis la 13 : pas besoin
-- de pgcrypto.
--
-- btree_gist n'est pas installe : la contrainte anti-chevauchement de `courses`
-- ne melange pas d'egalite scalaire avec &&, l'opclass gist des ranges du coeur
-- suffit. A installer le jour ou un chevauchement devrait etre teste par lieu.


-- ---------------------------------------------------------------------------
-- Comptes
-- ---------------------------------------------------------------------------

create type public.user_role as enum ('cliente', 'admin');


-- ---------------------------------------------------------------------------
-- Formules
-- ---------------------------------------------------------------------------

create type public.plan_kind as enum ('single', 'subscription', 'pack');

comment on type public.plan_kind is
  'single = a la carte, subscription = abonnement recurrent, pack = achat unique multi-seances. '
  'Ne change que la facon de recharger le solde : la seance consommee est la meme partout.';


-- ---------------------------------------------------------------------------
-- Solde de seances
-- ---------------------------------------------------------------------------

create type public.lot_origin as enum ('order', 'subscription_cycle', 'admin_grant');

create type public.lot_close_reason as enum ('superseded', 'revoked');

comment on type public.lot_close_reason is
  'superseded = remplace par le cycle suivant d''un abonnement (regle 2 : reset, pas cumul). '
  'revoked = annule suite a un remboursement Stripe.';

create type public.credit_reason as enum (
  'grant',                  -- credit initial d'un lot
  'booking',                -- -1 a la reservation
  'booking_refund',         -- +1 annulation cliente dans les delais
  'course_canceled_refund', -- +1 cours annule par Oriane
  'admin_adjust',           -- geste manuel d'Oriane, positif ou negatif
  'expired',                -- solde perdu a l'echeance (regle 1)
  'subscription_reset',     -- reliquat annule au prelevement suivant (regle 2)
  'refund_revoked'          -- lot revoque apres remboursement Stripe
);


-- ---------------------------------------------------------------------------
-- Cours et reservations
-- ---------------------------------------------------------------------------

create type public.course_status as enum ('scheduled', 'canceled');

create type public.booking_status as enum (
  'booked',
  'canceled_by_client',
  'canceled_by_admin',
  'course_canceled'
);


-- ---------------------------------------------------------------------------
-- Ventes
-- ---------------------------------------------------------------------------

create type public.order_kind as enum ('purchase', 'subscription_cycle');

create type public.order_status as enum (
  'pending',
  'paid',
  'failed',
  'refunded',
  'partially_refunded'
);

comment on type public.order_status is
  'partially_refunded n''entraine aucune revocation automatique de lot : '
  'Oriane arbitre a la main via admin_revoke_credit.';

create type public.promo_discount_type as enum ('percent', 'amount');

create type public.promo_duration as enum ('once', 'repeating', 'forever');


-- ---------------------------------------------------------------------------
-- Emails transactionnels (Resend)
-- ---------------------------------------------------------------------------

create type public.email_template as enum (
  'purchase_confirmation',
  'booking_confirmation',
  'course_canceled',
  'expiry_warning',
  'payment_failed',      -- echec FINAL de prelevement, apres Smart Retries
  'subscription_ended'   -- customer.subscription.deleted
);

comment on type public.email_template is
  'payment_failed n''est envoye qu''une fois les tentatives Stripe epuisees '
  '(invoice.next_payment_attempt is null). Rien ne part pendant les Smart Retries.';
