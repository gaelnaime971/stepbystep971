-- =============================================================================
-- 0002 — Tables
-- Step by Step Coaching
--
-- Contenu : structures, contraintes d'integrite, et activation de la RLS.
--
-- Pourquoi la RLS est activee ici et pas en 0004 : dans le schema `public`,
-- une table Supabase sans RLS est immediatement exposee a `anon` par PostgREST.
-- RLS activee sans aucune policy refuse tout. 0004 ouvrira les acces un par un.
-- La base est donc fermee par defaut entre 0002 et 0004, jamais ouverte.
--
-- Les index de performance sont en 0003. Les index presents ici sont des
-- contraintes d'integrite qui ne peuvent pas s'ecrire autrement qu'en index
-- (unicite partielle) : ils appartiennent a la structure, pas au reglage.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- profiles — extension de auth.users
-- ---------------------------------------------------------------------------

create table public.profiles (
  id                  uuid primary key references auth.users (id) on delete cascade,
  email               extensions.citext not null,
  first_name          text not null,
  last_name           text not null,
  phone               text,
  role                public.user_role not null default 'cliente',
  stripe_customer_id  text unique,
  admin_notes         text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint profiles_first_name_not_blank check (btrim(first_name) <> ''),
  constraint profiles_last_name_not_blank  check (btrim(last_name)  <> '')
);

comment on table public.profiles is
  'Une ligne par compte. `email` est denormalise depuis auth.users par un trigger '
  '(0005) : la recherche cliente de l''admin ne peut pas taper dans auth.users.';
comment on column public.profiles.role is
  'Protege par un trigger en 0005 : une cliente ne peut pas se promouvoir admin.';
comment on column public.profiles.admin_notes is
  'Notes privees d''Oriane. Jamais lisible par la cliente (voir policies 0004).';

alter table public.profiles enable row level security;


-- ---------------------------------------------------------------------------
-- locations — les lieux (table, pas enum : Oriane en ouvrira d'autres)
-- ---------------------------------------------------------------------------

create table public.locations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  address     text,
  city        text,
  is_active   boolean not null default true,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),

  constraint locations_name_not_blank check (btrim(name) <> '')
);

comment on column public.locations.is_active is
  'On desactive, on ne supprime jamais : les cours passes doivent garder leur lieu.';

alter table public.locations enable row level security;


-- ---------------------------------------------------------------------------
-- plans — les six formules
-- ---------------------------------------------------------------------------

create table public.plans (
  id                           uuid primary key default gen_random_uuid(),
  slug                         text not null unique,
  name                         text not null,
  tagline                      text,
  kind                         public.plan_kind not null,
  sessions_count               integer not null,
  validity_interval            interval not null,
  price_cents                  integer not null,
  compare_at_price_cents       integer,
  currency                     text not null default 'EUR',
  stripe_product_id            text,
  stripe_price_id              text unique,
  cancellation_deadline_hours  integer not null default 24,
  is_active                    boolean not null default true,
  is_highlighted               boolean not null default false,
  features                     text[] not null default '{}',
  sort_order                   integer not null default 0,
  created_at                   timestamptz not null default now(),
  updated_at                   timestamptz not null default now(),
  archived_at                  timestamptz,

  constraint plans_slug_format             check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint plans_name_not_blank          check (btrim(name) <> ''),
  constraint plans_sessions_count_positive check (sessions_count > 0),
  constraint plans_price_positive          check (price_cents > 0),
  constraint plans_validity_positive       check (validity_interval > interval '0'),
  constraint plans_deadline_non_negative   check (cancellation_deadline_hours >= 0),
  constraint plans_currency_iso            check (currency ~ '^[A-Z]{3}$'),

  -- Le prix barre doit etre superieur au prix reel, sinon ce n'est pas une remise.
  constraint plans_compare_at_higher check (
    compare_at_price_cents is null or compare_at_price_cents > price_cents),

  -- Regle 3 : l'abonnement est en 4 semaines, jamais en mois. Verrouille dans la
  -- base et pas seulement dans le code Stripe.
  constraint plans_subscription_is_four_weeks check (
    kind <> 'subscription' or validity_interval = interval '4 weeks'),

  -- Regle 10 : archiver, c'est d'abord desactiver.
  constraint plans_archived_is_inactive check (
    archived_at is null or is_active = false)
);

comment on table public.plans is
  'Regle 10 : le prix d''une formule vendue est immuable. Un trigger en 0005 '
  'refuse toute modification de price_cents / sessions_count / validity_interval / kind '
  'des qu''une commande reference le plan. Le seul geste autorise est is_active = false.';
comment on column public.plans.cancellation_deadline_hours is
  'Regle 6 : delai d''annulation cliente, parametrable par formule. 24 h par defaut, '
  'jamais une constante en dur cote applicatif.';
comment on column public.plans.validity_interval is
  'Duree de validite des seances creditees. expires_at d''un lot = issued_at + cet '
  'intervalle, sauf abonnement ou Stripe fait autorite (current_period_end).';

alter table public.plans enable row level security;


-- ---------------------------------------------------------------------------
-- promo_codes — miroir leger de Stripe, pilote depuis l'admin
-- ---------------------------------------------------------------------------

create table public.promo_codes (
  id                        uuid primary key default gen_random_uuid(),
  code                      extensions.citext not null unique,
  description               text,
  stripe_coupon_id          text,
  stripe_promotion_code_id  text unique,
  discount_type             public.promo_discount_type not null,
  percent_off               numeric(5,2),
  amount_off_cents          integer,
  currency                  text,
  duration                  public.promo_duration not null default 'once',
  duration_in_months        integer,
  max_redemptions           integer,
  times_redeemed            integer not null default 0,
  restricted_plan_ids       uuid[],
  is_active                 boolean not null default true,
  expires_at                timestamptz,
  created_by                uuid references public.profiles (id) on delete set null,
  created_at                timestamptz not null default now(),
  archived_at               timestamptz,

  constraint promo_codes_code_format check (code ~ '^[A-Za-z0-9_-]{3,40}$'),

  constraint promo_codes_percent_shape check (
    discount_type <> 'percent' or (
      percent_off is not null and percent_off > 0 and percent_off <= 100
      and amount_off_cents is null)),

  constraint promo_codes_amount_shape check (
    discount_type <> 'amount' or (
      amount_off_cents is not null and amount_off_cents > 0
      and percent_off is null and currency is not null)),

  constraint promo_codes_repeating_shape check (
    (duration = 'repeating') = (duration_in_months is not null)),

  constraint promo_codes_duration_months_positive check (
    duration_in_months is null or duration_in_months > 0),

  constraint promo_codes_max_redemptions_positive check (
    max_redemptions is null or max_redemptions > 0),

  constraint promo_codes_times_redeemed_non_negative check (times_redeemed >= 0),

  constraint promo_codes_archived_is_inactive check (
    archived_at is null or is_active = false)
);

comment on table public.promo_codes is
  'Miroir d''affichage. Stripe reste maitre du calcul de la remise : ces colonnes '
  'servent l''admin et l''historique, jamais a recalculer un montant.';
comment on column public.promo_codes.restricted_plan_ids is
  'Aucune FK possible sur les elements d''un tableau. Le RPC admin de 0005 valide '
  'l''existence des plans avant d''ecrire, et pose coupon.applies_to cote Stripe.';
comment on column public.promo_codes.times_redeemed is
  'Recopie depuis Stripe au webhook. Ne sert pas a bloquer une utilisation.';

alter table public.promo_codes enable row level security;


-- ---------------------------------------------------------------------------
-- subscriptions — abonnements Stripe
-- ---------------------------------------------------------------------------

create table public.subscriptions (
  id                      uuid primary key default gen_random_uuid(),
  user_id                 uuid not null references public.profiles (id) on delete cascade,
  plan_id                 uuid not null references public.plans (id) on delete restrict,
  stripe_subscription_id  text not null unique,
  status                  text not null,
  current_period_start    timestamptz,
  current_period_end      timestamptz,
  cancel_at_period_end    boolean not null default false,

  -- Point 2 : relances Stripe. On n'agit qu'a l'echec final.
  payment_failed_at       timestamptz,
  dunning_exhausted_at    timestamptz,
  latest_invoice_id       text,

  canceled_at             timestamptz,
  ended_at                timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),

  -- text + CHECK plutot qu'un enum : Stripe fait evoluer ses statuts, et une
  -- valeur inconnue doit pouvoir etre ajoutee sans ALTER TYPE bloquant.
  constraint subscriptions_status_known check (status in (
    'incomplete', 'incomplete_expired', 'trialing', 'active',
    'past_due', 'canceled', 'unpaid', 'paused')),

  constraint subscriptions_period_order check (
    current_period_start is null or current_period_end is null
    or current_period_end > current_period_start),

  constraint subscriptions_dunning_needs_failure check (
    dunning_exhausted_at is null or payment_failed_at is not null)
);

comment on column public.subscriptions.payment_failed_at is
  'Premier invoice.payment_failed de la relance en cours. Remis a NULL des qu''une '
  'facture est payee. Alimente l''etat « paiement en attente » de l''espace cliente.';
comment on column public.subscriptions.dunning_exhausted_at is
  'Pose quand invoice.payment_failed arrive avec next_payment_attempt = null : '
  'Stripe a epuise ses Smart Retries. C''est le seul moment ou l''on parle d''echec '
  'a la cliente et ou l''email payment_failed part. Rien n''est coupe avant.';
comment on table public.subscriptions is
  'Un echec de paiement ne retire aucune seance : le lot en cours vit jusqu''a son '
  'expires_at, et c''est l''absence de nouveau lot au cycle suivant qui fait effet.';

alter table public.subscriptions enable row level security;


-- ---------------------------------------------------------------------------
-- orders — achats et cycles d'abonnement payes
-- ---------------------------------------------------------------------------

create table public.orders (
  id                          uuid primary key default gen_random_uuid(),
  user_id                     uuid not null references public.profiles (id) on delete restrict,
  plan_id                     uuid not null references public.plans (id) on delete restrict,
  subscription_id             uuid references public.subscriptions (id) on delete set null,
  kind                        public.order_kind not null,
  status                      public.order_status not null default 'pending',
  amount_cents                integer not null,
  discount_cents              integer not null default 0,
  currency                    text not null default 'EUR',
  promo_code_id               uuid references public.promo_codes (id) on delete set null,
  stripe_checkout_session_id  text unique,
  stripe_payment_intent_id    text unique,
  stripe_invoice_id           text unique,
  stripe_charge_id            text unique,
  refunded_amount_cents       integer not null default 0,
  paid_at                     timestamptz,
  refunded_at                 timestamptz,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),

  constraint orders_amount_non_negative   check (amount_cents >= 0),
  constraint orders_discount_non_negative check (discount_cents >= 0),
  constraint orders_currency_iso          check (currency ~ '^[A-Z]{3}$'),

  constraint orders_refund_within_amount check (
    refunded_amount_cents between 0 and amount_cents),

  constraint orders_paid_has_timestamp check (
    status <> 'paid' or paid_at is not null),

  constraint orders_refund_has_timestamp check (
    status not in ('refunded', 'partially_refunded') or refunded_at is not null),

  constraint orders_full_refund_is_total check (
    status <> 'refunded' or refunded_amount_cents = amount_cents),

  constraint orders_subscription_kind check (
    (kind = 'subscription_cycle') = (subscription_id is not null))
);

comment on column public.orders.amount_cents is
  'Montant reellement encaisse, net de remise. discount_cents est informatif : '
  'le calcul appartient a Stripe.';
comment on column public.orders.stripe_invoice_id is
  'Unique : c''est la cle d''idempotence des webhooks invoice.paid. Stripe rejoue '
  'ses evenements, un double credit serait invisible sans cette contrainte.';

alter table public.orders enable row level security;


-- ---------------------------------------------------------------------------
-- credit_lots — le solde de seances
-- ---------------------------------------------------------------------------

create table public.credit_lots (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references public.profiles (id) on delete cascade,
  plan_id             uuid references public.plans (id) on delete restrict,
  origin              public.lot_origin not null,
  order_id            uuid references public.orders (id) on delete restrict,
  subscription_id     uuid references public.subscriptions (id) on delete set null,
  quantity_initial    integer not null,
  quantity_remaining  integer not null,
  issued_at           timestamptz not null default now(),
  expires_at          timestamptz not null,
  closed_at           timestamptz,
  close_reason        public.lot_close_reason,
  granted_by          uuid references public.profiles (id) on delete set null,
  reason              text,
  created_at          timestamptz not null default now(),

  constraint credit_lots_initial_positive check (quantity_initial > 0),

  constraint credit_lots_remaining_range check (
    quantity_remaining between 0 and quantity_initial),

  constraint credit_lots_expiry_after_issue check (expires_at > issued_at),

  constraint credit_lots_close_pair check (
    (closed_at is null) = (close_reason is null)),

  -- Chaque origine impose ses rattachements. Un lot ne peut pas etre orphelin
  -- de sa cause : c'est ce qui rend la revocation sur remboursement possible.
  constraint credit_lots_origin_shape check (
    case origin
      when 'order' then
        order_id is not null and plan_id is not null and subscription_id is null
      when 'subscription_cycle' then
        subscription_id is not null and plan_id is not null
      when 'admin_grant' then
        granted_by is not null and reason is not null
        and order_id is null and subscription_id is null
    end
  )
);

comment on table public.credit_lots is
  'Le solde n''est pas un compteur, c''est cette collection de lots dates. '
  'Un lot est ACTIF si : quantity_remaining > 0 AND closed_at IS NULL AND expires_at > now(). '
  'Solde affiche = SUM(quantity_remaining) sur les lots actifs. '
  'Date affichee = MIN(expires_at) sur les memes.';

comment on column public.credit_lots.expires_at is
  'Regle 1 : l''expiration n''est pas un job, elle est dans le WHERE de toute '
  'requete de solde et de reservation. Meme si aucun cron ne tourne, une seance '
  'echue est inutilisable.';

comment on column public.credit_lots.closed_at is
  'Ferme le lot avant son echeance. superseded = nouveau cycle d''abonnement '
  '(regle 2 : le reliquat est annule, pas cumule). revoked = remboursement Stripe. '
  'Dans les deux cas quantity_remaining tombe a 0 et le grand livre enregistre '
  'le mouvement negatif correspondant.';

comment on column public.credit_lots.reason is
  'Obligatoire pour un admin_grant : un geste de rattrapage sans motif n''est pas '
  'un geste trace.';

-- Regle 4 et regle 5 : la consommation prend le lot actif dont expires_at est le
-- plus proche, PARMI ceux qui couvrent la date du cours (expires_at >= starts_at).
-- Consequence a porter dans l'interface (point 6) : des seances a echeance courte
-- peuvent rester non consommables si aucun cours reservable ne tombe avant leur
-- echeance. L'espace cliente doit nommer ces seances menacees explicitement,
-- avec la date butoir, plutot que d'afficher un solde global rassurant.

alter table public.credit_lots enable row level security;


-- ---------------------------------------------------------------------------
-- courses — les cours au planning
-- ---------------------------------------------------------------------------

create table public.courses (
  id                   uuid primary key default gen_random_uuid(),
  location_id          uuid not null references public.locations (id) on delete restrict,
  starts_at            timestamptz not null,
  ends_at              timestamptz not null,
  capacity             integer not null,
  seats_taken          integer not null default 0,
  status               public.course_status not null default 'scheduled',
  canceled_at          timestamptz,
  cancellation_reason  text,
  recurrence_group_id  uuid,
  admin_notes          text,
  created_by           uuid references public.profiles (id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),

  constraint courses_time_order        check (ends_at > starts_at),
  constraint courses_capacity_positive check (capacity > 0),
  constraint courses_seats_range       check (seats_taken between 0 and capacity),

  constraint courses_canceled_pair check (
    (status = 'canceled') = (canceled_at is not null)),

  -- Une seule intervenante : elle ne peut pas etre a Jarry et aux Abymes en meme
  -- temps. L'exclusion est donc globale et non par lieu.
  -- Point 5 : ce nom est l'interface d'erreur. Le code admin intercepte
  -- SQLSTATE 23P01 + « courses_no_overlap » et rend « Tu as deja un cours sur ce
  -- creneau. Choisis un autre horaire. » Jamais l'exception Postgres brute.
  constraint courses_no_overlap exclude using gist (
    tstzrange(starts_at, ends_at, '[)') with &&
  ) where (status = 'scheduled')
);

comment on column public.courses.seats_taken is
  'Denormalise, maintenu par trigger sur bookings (0005). C''est ce qui permet '
  'd''afficher « 7 places » sur la vitrine publique sans jamais exposer bookings '
  'a un visiteur anonyme.';
comment on column public.courses.capacity is
  'Regle 8 : fixee par Oriane a la creation. Au-dela, le cours est complet. '
  'Pas de liste d''attente.';
comment on table public.courses is
  'Tout en timestamptz. Affichage en America/Guadeloupe (UTC-4, sans changement '
  'd''heure). Aucune colonne de presence : regle 9, Oriane voit qui est inscrit, '
  'c''est tout.';

alter table public.courses enable row level security;


-- ---------------------------------------------------------------------------
-- bookings — les reservations
-- ---------------------------------------------------------------------------

create table public.bookings (
  id                  uuid primary key default gen_random_uuid(),
  course_id           uuid not null references public.courses (id) on delete restrict,
  user_id             uuid not null references public.profiles (id) on delete cascade,
  credit_lot_id       uuid not null references public.credit_lots (id) on delete restrict,
  status              public.booking_status not null default 'booked',
  booked_at           timestamptz not null default now(),
  canceled_at         timestamptz,
  canceled_by         uuid references public.profiles (id) on delete set null,
  credit_refunded_at  timestamptz,

  constraint bookings_canceled_pair check (
    (status = 'booked') = (canceled_at is null)),

  constraint bookings_refund_requires_cancel check (
    credit_refunded_at is null or canceled_at is not null)
);

comment on column public.bookings.credit_lot_id is
  'Quel lot a paye cette seance. NOT NULL et ON DELETE RESTRICT : une reservation '
  'sans financement identifiable rendrait le recredit impossible.';
comment on column public.bookings.credit_refunded_at is
  'NULL apres annulation = la seance est perdue (hors delai, ou lot ferme). '
  'Option A retenue : aucun report sur un autre lot, jamais.';

-- Contrainte d'integrite, pas de performance : une unicite partielle ne peut
-- s'exprimer qu'en index. Une cliente ne s'inscrit pas deux fois au meme cours,
-- mais peut se reinscrire apres avoir annule.
create unique index bookings_one_active_per_course
  on public.bookings (course_id, user_id)
  where (status = 'booked');

alter table public.bookings enable row level security;


-- ---------------------------------------------------------------------------
-- credit_movements — le grand livre, en ajout seul
-- ---------------------------------------------------------------------------

create table public.credit_movements (
  id             bigint generated always as identity primary key,
  user_id        uuid not null references public.profiles (id) on delete cascade,
  credit_lot_id  uuid not null references public.credit_lots (id) on delete restrict,
  delta          integer not null,
  reason         public.credit_reason not null,
  booking_id     uuid references public.bookings (id) on delete set null,
  order_id       uuid references public.orders (id) on delete set null,
  actor_id       uuid references public.profiles (id) on delete set null,
  note           text,
  created_at     timestamptz not null default now(),

  constraint credit_movements_delta_not_zero check (delta <> 0),

  -- Un geste de rattrapage sans auteur ni motif n'est pas trace.
  constraint credit_movements_admin_adjust_traced check (
    reason <> 'admin_adjust' or (actor_id is not null and note is not null))
);

comment on table public.credit_movements is
  'Ajout seul : aucune policy UPDATE ni DELETE ne sera creee en 0004, pas meme '
  'pour Oriane. Invariant de controle : pour un lot donne, SUM(delta) doit toujours '
  'egaler quantity_remaining. C''est ce qui permet de reconstruire un solde en cas '
  'de doute et de tracer les gestes de rattrapage.';

alter table public.credit_movements enable row level security;


-- ---------------------------------------------------------------------------
-- stripe_events — idempotence des webhooks
-- ---------------------------------------------------------------------------

create table public.stripe_events (
  id           text primary key,
  type         text not null,
  api_version  text,
  payload      jsonb not null,
  received_at  timestamptz not null default now(),
  processed_at timestamptz,
  attempts     integer not null default 0,
  error        text,

  constraint stripe_events_id_format       check (id ~ '^evt_'),
  constraint stripe_events_attempts_non_negative check (attempts >= 0)
);

comment on table public.stripe_events is
  'Stripe rejoue ses evenements. L''id sert de verrou d''idempotence : un INSERT '
  'en conflit signale un rejeu et le handler sort sans rien crediter.';

alter table public.stripe_events enable row level security;


-- ---------------------------------------------------------------------------
-- email_log — envois Resend
-- ---------------------------------------------------------------------------

create table public.email_log (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references public.profiles (id) on delete cascade,
  template           public.email_template not null,
  to_email           extensions.citext not null,
  resend_message_id  text unique,
  order_id           uuid references public.orders (id) on delete set null,
  booking_id         uuid references public.bookings (id) on delete set null,
  course_id          uuid references public.courses (id) on delete set null,
  credit_lot_id      uuid references public.credit_lots (id) on delete set null,
  subscription_id    uuid references public.subscriptions (id) on delete set null,
  stripe_invoice_id  text,
  sent_at            timestamptz not null default now(),
  error              text
);

comment on table public.email_log is
  'Trace d''envoi et surtout garde d''idempotence : les trois index partiels '
  'ci-dessous empechent qu''un cron rejoue ou un webhook duplique n''envoie deux '
  'fois le meme message a la meme cliente.';

-- L'alerte de fin de validite ne part qu'une fois par lot.
create unique index email_log_one_expiry_warning_per_lot
  on public.email_log (credit_lot_id)
  where (template = 'expiry_warning');

-- Un seul email d'echec final par facture.
create unique index email_log_one_payment_failed_per_invoice
  on public.email_log (stripe_invoice_id)
  where (template = 'payment_failed');

-- Une seule fin d'abonnement annoncee par abonnement.
create unique index email_log_one_ended_per_subscription
  on public.email_log (subscription_id)
  where (template = 'subscription_ended');

alter table public.email_log enable row level security;


-- ---------------------------------------------------------------------------
-- audit_log — ce que le grand livre ne couvre pas
-- ---------------------------------------------------------------------------

create table public.audit_log (
  id            bigint generated always as identity primary key,
  actor_id      uuid references public.profiles (id) on delete set null,
  action        text not null,
  entity_table  text not null,
  entity_id     uuid,
  before        jsonb,
  after         jsonb,
  created_at    timestamptz not null default now(),

  constraint audit_log_action_not_blank check (btrim(action) <> '')
);

comment on table public.audit_log is
  'Annulation d''un cours, desinscription forcee, archivage d''une formule, '
  'creation d''un code promo. Les mouvements de seances vivent dans '
  'credit_movements, pas ici.';

alter table public.audit_log enable row level security;
