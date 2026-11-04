-- =============================================================================
-- 0015 — Le modele d'email d'une formule offerte
-- Step by Step Coaching
--
-- Jouee sur une base VIVANTE. Additive : une valeur d'enum, rien d'autre.
--
-- POURQUOI CA VAUT UNE MIGRATION.
--
-- La confirmation d'une seance offerte partait sous le modele
-- `purchase_confirmation`. Le contenu etait juste — ni montant, ni facture —
-- mais la TRACE l'etait moins : « Ce qu'elle a recu » affichait « Confirmation
-- d'achat » pour une inscription qui n'a rien achete.
--
-- Ce n'est pas un detail cosmetique. Le jour ou une participante des portes
-- ouvertes dit n'avoir rien recu, Oriane ouvre sa fiche, lit « Confirmation
-- d'achat », et cherche une commande payee qui n'existe pas. L'operation se
-- repetera chaque annee ; la confusion aussi.
--
-- Un seul fichier : aucune contrainte ni index ne compare cette valeur, elle
-- n'a donc pas a etre validee avant usage.
-- =============================================================================

alter type public.email_template add value if not exists 'free_confirmation';

comment on type public.email_template is
  'payment_failed n''est envoye qu''une fois les tentatives Stripe epuisees '
  '(invoice.next_payment_attempt is null). Rien ne part pendant les Smart Retries. '
  'refund_processed est envoye par l''administratrice au moment ou elle rembourse. '
  'free_confirmation accompagne une formule a 0 EUR : meme structure qu''un achat, '
  'sans montant ni facture — il n''y a pas eu de paiement.';
