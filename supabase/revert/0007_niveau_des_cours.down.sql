-- Revert 0007.
--
-- DESTRUCTIF : supprimer la colonne efface le niveau de tous les cours, sans
-- retour possible. A ne jouer que si la migration vient d'etre passee et
-- qu'aucun niveau n'a encore ete saisi.
--
-- Rien d'autre n'est touche : les cours, leurs reservations et leurs soldes
-- restent intacts.

alter table public.courses drop column if exists level;

drop type if exists public.course_level;
