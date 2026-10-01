-- =============================================================================
-- 0012 — Deux cours peuvent se tenir en meme temps
-- Step by Step Coaching
--
-- Jouee sur une base VIVANTE. Elle SUPPRIME une contrainte : rien n'est efface,
-- et aucune ligne existante ne devient invalide — retirer une restriction ne
-- peut pas invalider des donnees qui la respectaient.
--
-- POURQUOI.
--
-- `courses_no_overlap` partait d'une evidence : une seule intervenante, donc un
-- seul cours a la fois. L'evidence a tenu jusqu'a ce qu'Oriane ait besoin de
-- faire autrement — une remplacante, deux salles ouvertes le meme soir, ou
-- simplement corriger un creneau sans devoir supprimer l'ancien d'abord.
--
-- Une regle metier qui vit dans une contrainte Postgres ne se discute pas avec
-- l'interface : elle refuse, et il faut une migration pour changer d'avis.
-- Celle-ci n'avait pas lieu d'etre gravee si bas. Le chevauchement devient un
-- AVERTISSEMENT applicatif : le site dit quel cours existe deja et a quelle
-- heure, et laisse Oriane decider.
-- =============================================================================

alter table public.courses
  drop constraint if exists courses_no_overlap;

-- L'index GiST qui portait la contrainte disparait avec elle. Rien a nettoyer.

comment on table public.courses is
  'Deux cours peuvent se chevaucher, depuis 0012. L''ancienne contrainte '
  'd''exclusion `courses_no_overlap` supposait une intervenante unique ; c''est '
  'desormais une decision d''Oriane, avertie par l''interface et non refusee par '
  'la base. Aucune regle de reservation ne depend de cette unicite : book_course '
  'ne regarde que la capacite et l''expiration du solde.';
