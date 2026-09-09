-- =============================================================================
-- 0008 — La valeur d'enum de l'email de remboursement
-- Step by Step Coaching
--
-- Jouee sur une base VIVANTE. Additif : une valeur d'enum, rien d'autre.
--
-- POURQUOI CE FICHIER EST SEUL.
--
-- `alter type ... add value` peut s'executer dans une transaction depuis
-- PostgreSQL 12, mais la valeur ajoutee n'y est PAS utilisable avant la
-- validation. Or 0009 cree un index partiel dont la clause `where` compare
-- `template` a cette valeur : dans la meme transaction, Postgres refuserait
-- avec « unsafe use of new value of enum type ».
--
-- D'ou deux fichiers, a passer l'un APRES l'autre. Ce n'est pas une coquetterie
-- de decoupage : c'est la seule facon que les deux passent.
-- =============================================================================

alter type public.email_template add value if not exists 'refund_processed';

comment on type public.email_template is
  'payment_failed n''est envoye qu''une fois les tentatives Stripe epuisees '
  '(invoice.next_payment_attempt is null). Rien ne part pendant les Smart Retries. '
  'refund_processed est envoye par l''administratrice au moment ou elle rembourse, '
  'et dit ce qui a ete retire : montant, seances, cours annules.';
