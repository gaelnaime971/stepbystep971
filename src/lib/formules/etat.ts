/**
 * Etat des formulaires de l'espace formules.
 *
 * Dans un fichier separe des actions : un module « use server » ne peut
 * exporter que des fonctions asynchrones.
 */
export type EtatFormule = {
  erreur?: string;
  succes?: string;
  /** Explication longue affichee sous l'erreur, quand il y a quoi expliquer. */
  detail?: string;
  valeurs?: Record<string, string>;
};

export const ETAT_FORMULE_INITIAL: EtatFormule = {};
