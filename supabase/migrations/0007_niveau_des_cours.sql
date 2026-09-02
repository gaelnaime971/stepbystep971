-- =============================================================================
-- 0007 — Le niveau des cours
-- Step by Step Coaching
--
-- Jouee sur une base VIVANTE, avec des cours et des reservations reels.
-- Rien n'est supprime, rien n'est reecrit : on ajoute un type et une colonne.
--
-- Le niveau est une INFORMATION, pas un filtre. Aucune regle ne s'y rattache :
-- book_course ne le regarde pas, n'importe quelle cliente reserve n'importe
-- quel cours. Le jour ou il faudrait filtrer, ce serait une autre migration et
-- une autre decision.
-- =============================================================================

create type public.course_level as enum (
  'debutante',
  'intermediaire',
  'tous_niveaux'
);

comment on type public.course_level is
  'Indication donnee a la cliente avant qu''elle reserve. Ne conditionne aucun '
  'droit : aucune verification de niveau nulle part.';


-- ---------------------------------------------------------------------------
-- La colonne
-- ---------------------------------------------------------------------------

-- NULLABLE et SANS DEFAUT, volontairement.
--
-- Un DEFAULT ferait plus que fixer la valeur des futures lignes : depuis
-- PostgreSQL 11, ADD COLUMN ... DEFAULT donne aussi cette valeur aux lignes
-- EXISTANTES. Les cours deja au planning se retrouveraient etiquetes
-- « tous niveaux » sans qu'Oriane l'ait decide.
--
-- Les cours anterieurs gardent donc NULL. L'interface les affiche
-- « tous niveaux » — c'est un choix d'affichage, reversible, et non une
-- donnee inventee en base.
alter table public.courses
  add column level public.course_level;

comment on column public.courses.level is
  'NULL = niveau jamais renseigne. Affiche « tous niveaux » cote interface, '
  'sans que la base ne l''affirme. Les nouveaux cours recoivent une valeur '
  'depuis le formulaire d''administration.';


-- ---------------------------------------------------------------------------
-- Le GRANT, sans lequel cette migration casse la production
-- ---------------------------------------------------------------------------
--
-- Le SELECT sur `courses` a ete revoque au niveau table en 0004, puis
-- reaccorde COLONNE PAR COLONNE, pour tenir `admin_notes` hors de portee.
-- Une colonne ajoutee n'herite de rien : sans la ligne ci-dessous, toute
-- lecture du planning renverrait « permission denied for column level » —
-- vitrine et espace cliente compris.
--
-- C'est exactement le piege documente dans CLAUDE.md, section
-- « Contraintes de base de donnees a ne jamais oublier ».
grant select (level) on public.courses to anon, authenticated;

-- Les ecritures n'ont pas besoin d'etre reaccordees : INSERT, UPDATE et DELETE
-- ont ete donnes au niveau TABLE en 0004, ils couvrent donc la nouvelle
-- colonne. Seul le SELECT est portee colonne.
