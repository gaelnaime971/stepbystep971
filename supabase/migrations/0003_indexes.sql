-- =============================================================================
-- 0003 — Index
-- Step by Step Coaching
--
-- Rien ici n'est une contrainte : les unicites partielles sont restees en 0002
-- avec la structure. Ce fichier ne contient que du reglage de lecture, et se
-- revoque sans consequence fonctionnelle.
--
-- Trois criteres pour qu'un index existe :
--   1. il sert un chemin de lecture reellement emprunte par l'application,
--   2. ou il couvre une FK parcourue lors d'un ON DELETE RESTRICT / CASCADE,
--   3. ou il sert un balayage de job planifie.
--
-- Volontairement SANS index : `plans` (6 lignes), `locations` (3 lignes),
-- `promo_codes` (quelques dizaines). Sur ces volumes un parcours sequentiel est
-- plus rapide qu'un aller-retour d'index, et leurs colonnes uniques sont deja
-- indexees par les contraintes de 0002. On en ajoutera le jour ou une mesure le
-- demandera, pas avant.
--
-- Egalement sans index : les FK vers profiles en ON DELETE SET NULL
-- (actor_id, canceled_by, created_by, granted_by). Elles ne sont parcourues
-- qu'a la suppression d'un profil, et un profil ne se supprime pas : la
-- demande RGPD se traite par anonymisation.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- profiles — la recherche cliente de l'admin
-- ---------------------------------------------------------------------------

-- Le champ « Rechercher une cliente » cherche sur le nom ET l'email, en
-- tolerant les fautes de frappe. Trigramme sur la concatenation des trois.
-- Les operandes sont castes en text : l'expression d'un index doit etre
-- immuable, et le cast citext -> text est binaire, donc immuable.
create index profiles_search_trgm_idx
  on public.profiles
  using gin ((first_name || ' ' || last_name || ' ' || (email)::text)
             extensions.gin_trgm_ops);

-- Recherche exacte par email : rapprochement d'un compte a un evenement Stripe.
create index profiles_email_idx on public.profiles (email);


-- ---------------------------------------------------------------------------
-- subscriptions
-- ---------------------------------------------------------------------------

-- Panneau « Ma formule » de l'espace cliente.
create index subscriptions_user_idx
  on public.subscriptions (user_id, created_at desc);


-- ---------------------------------------------------------------------------
-- orders
-- ---------------------------------------------------------------------------

-- Historique d'achats d'une cliente, et fiche cliente cote admin.
create index orders_user_idx on public.orders (user_id, created_at desc);

-- KPI « Encaisse ce mois » du tableau de bord.
create index orders_paid_idx
  on public.orders (paid_at desc)
  where (status = 'paid');

-- Rattachement des cycles a leur abonnement.
create index orders_subscription_idx
  on public.orders (subscription_id)
  where (subscription_id is not null);


-- ---------------------------------------------------------------------------
-- credit_lots — dont l'index le plus important du schema
-- ---------------------------------------------------------------------------

-- LA requete de consommation (regles 4 et 5) :
--   where user_id = ? and quantity_remaining > 0 and closed_at is null
--     and expires_at > now() and expires_at >= <debut du cours>
--   order by expires_at, issued_at
--   limit 1
-- Egalite sur user_id, intervalle sur expires_at, tri servi par l'index
-- jusqu'au departage sur issued_at : aucun tri en memoire, une seule ligne lue.
--
-- Le predicat ne peut pas inclure `expires_at > now()` : un index partiel exige
-- une expression immuable. Les deux conditions immuables suffisent a garder
-- l'index reduit aux lots ouverts, la fraicheur est filtree par la requete.
create index credit_lots_consumption_idx
  on public.credit_lots (user_id, expires_at, issued_at)
  where (quantity_remaining > 0 and closed_at is null);

-- Balayage nocturne d'expiration : ecriture des mouvements `expired` et alerte
-- de fin de validite. Sans user_id en tete, parce que le job traverse toutes
-- les clientes par date.
create index credit_lots_expiry_sweep_idx
  on public.credit_lots (expires_at)
  where (quantity_remaining > 0 and closed_at is null);

-- Regle 2 : au prelevement suivant, retrouver les lots encore ouverts de
-- l'abonnement pour les fermer avant d'en creer un nouveau.
create index credit_lots_subscription_open_idx
  on public.credit_lots (subscription_id)
  where (closed_at is null and subscription_id is not null);

-- Point 4 : remboursement Stripe -> retrouver le lot ne de cette commande.
create index credit_lots_order_idx
  on public.credit_lots (order_id)
  where (order_id is not null);

-- Fiche cliente cote admin : tous les lots, y compris fermes et expires.
-- L'index de consommation ne sert pas cette lecture, il est partiel.
create index credit_lots_user_history_idx
  on public.credit_lots (user_id, issued_at desc);


-- ---------------------------------------------------------------------------
-- courses
-- ---------------------------------------------------------------------------

-- Le planning public et l'espace cliente : les cours a venir, par date.
create index courses_planning_idx
  on public.courses (starts_at)
  where (status = 'scheduled');

-- Filtre par lieu, et calendrier mensuel de l'admin.
create index courses_location_starts_idx
  on public.courses (location_id, starts_at);

-- Modifier ou annuler une serie creee en une fois.
create index courses_recurrence_idx
  on public.courses (recurrence_group_id)
  where (recurrence_group_id is not null);


-- ---------------------------------------------------------------------------
-- bookings
-- ---------------------------------------------------------------------------

-- « Mes reservations », et fiche cliente cote admin.
create index bookings_user_idx on public.bookings (user_id, booked_at desc);

-- Toutes les reservations d'un cours, annulees comprises. La liste des
-- inscrites actives est deja servie par l'unique partiel de 0002
-- (bookings_one_active_per_course), qui commence par course_id.
-- Cet index-ci couvre en plus le RESTRICT de courses -> bookings.
create index bookings_course_idx on public.bookings (course_id);

-- Couvre le RESTRICT de credit_lots -> bookings, et permet de repondre a
-- « quelles seances ce lot a-t-il finance ».
create index bookings_credit_lot_idx on public.bookings (credit_lot_id);


-- ---------------------------------------------------------------------------
-- credit_movements
-- ---------------------------------------------------------------------------

-- Historique de solde d'une cliente, du plus recent au plus ancien.
create index credit_movements_user_idx
  on public.credit_movements (user_id, created_at desc);

-- Verification de l'invariant SUM(delta) = quantity_remaining, lot par lot.
-- Couvre aussi le RESTRICT de credit_lots -> credit_movements.
create index credit_movements_lot_idx
  on public.credit_movements (credit_lot_id);


-- ---------------------------------------------------------------------------
-- stripe_events
-- ---------------------------------------------------------------------------

-- Rejeu des evenements qu'un incident a laisses non traites.
create index stripe_events_unprocessed_idx
  on public.stripe_events (received_at)
  where (processed_at is null);


-- ---------------------------------------------------------------------------
-- email_log
-- ---------------------------------------------------------------------------

-- « Qu'a-t-on envoye a cette cliente », depuis sa fiche.
create index email_log_user_idx on public.email_log (user_id, sent_at desc);


-- ---------------------------------------------------------------------------
-- audit_log
-- ---------------------------------------------------------------------------

-- « Qu'est-il arrive a cet objet » : l'entree naturelle dans le journal.
create index audit_log_entity_idx on public.audit_log (entity_table, entity_id);

-- Le journal en ordre chronologique inverse.
create index audit_log_created_idx on public.audit_log (created_at desc);
