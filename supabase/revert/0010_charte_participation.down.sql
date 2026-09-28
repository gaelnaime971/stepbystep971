-- =============================================================================
-- REVERT 0010 — DESTRUCTIF
-- =============================================================================
--
-- SUPPRIME TOUS LES CONSENTEMENTS DEJA RECUEILLIS. Ce ne sont pas des donnees
-- techniques : ce sont des preuves. Une cliente qui a refuse la diffusion de
-- son image verrait ce refus disparaitre, et plus rien ne l'opposerait a une
-- publication.
--
-- A ne jouer que si la fonctionnalite est abandonnee AVANT d'avoir ete ouverte
-- aux clientes. Passe ce point, exporte d'abord la table.
--
--   copy (select * from public.charte_acceptations order by accepted_at)
--     to stdout with csv header;

drop function if exists public.accepter_charte(
  text, boolean, public.charte_origine, text, text);

drop table if exists public.charte_acceptations;

drop type if exists public.charte_origine;
