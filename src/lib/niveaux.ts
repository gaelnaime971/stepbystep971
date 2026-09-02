export type Niveau = "debutante" | "intermediaire" | "tous_niveaux";

/**
 * Les libelles affiches. Source unique : le selecteur comme les badges y
 * puisent, il n'y a pas deux listes a tenir d'accord.
 *
 * Les cles sont les valeurs de l'enum `course_level` en base. Ce sont des
 * identifiants techniques : `debutante` s'affiche « Débutant » sans qu'aucune
 * migration soit necessaire, et renommer un libelle ne les touche jamais.
 */
const LIBELLES: Record<Niveau, string> = {
  debutante: "Débutant",
  intermediaire: "Intermédiaire",
  tous_niveaux: "Tous niveaux",
};

/** L'ordre du selecteur : le cas le plus courant en premier. */
const ORDRE: readonly Niveau[] = ["tous_niveaux", "debutante", "intermediaire"];

export const NIVEAUX: ReadonlyArray<{ valeur: Niveau; libelle: string }> =
  ORDRE.map((valeur) => ({ valeur, libelle: LIBELLES[valeur] }));

/**
 * Un cours sans niveau s'affiche « Tous niveaux ».
 *
 * C'est un choix d'AFFICHAGE, pas une donnee : la colonne reste NULL en base.
 * Les cours crees avant la migration ne sont pas etiquetes a leur insu, et le
 * jour ou Oriane leur donne un niveau, rien n'est a defaire.
 */
export function libelleNiveau(niveau: Niveau | null | undefined): string {
  return niveau ? LIBELLES[niveau] : LIBELLES.tous_niveaux;
}

/** Vrai quand le niveau n'a jamais ete renseigne. Utile a l'admin seule. */
export function niveauImplicite(niveau: Niveau | null | undefined): boolean {
  return !niveau;
}
