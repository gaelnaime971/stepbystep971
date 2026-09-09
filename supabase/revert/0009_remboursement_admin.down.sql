-- =============================================================================
-- REVERT 0009 — DESTRUCTIF
-- =============================================================================
--
-- Supprime la fonction de retrait et l'index d'unicite de l'email.
--
-- Les mouvements `refund_revoked` deja ecrits NE SONT PAS defaits : le grand
-- livre est immuable, et un remboursement qui a eu lieu a eu lieu. Les lots
-- fermes en 'revoked' restent fermes.
--
-- A jouer AVANT 0008.down si tu defais les deux.

drop function if exists public.admin_refund_revoke_from_lot(uuid, integer, uuid, text);

drop index if exists public.email_log_one_refund_per_order;
