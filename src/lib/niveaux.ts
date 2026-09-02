export type Niveau = "debutante" | "intermediaire" | "tous_niveaux";

export const NIVEAUX: ReadonlyArray<{ valeur: Niveau; libelle: string }> = [
  { valeur: "tous_niveaux", libelle: "Tous niveaux" },
  { valeur: "debutante", libelle: "Débutante" },
  { valeur: "intermediaire", libelle: "Intermédiaire" },
];

const LIBELLES: Record<Niveau, string> = {
  debutante: "Débutante",
  intermediaire: "Intermédiaire",
  tous_niveaux: "Tous niveaux",
};

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
