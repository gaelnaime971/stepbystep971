/**
 * Etat partage des formulaires d'authentification.
 *
 * Dans un fichier separe et non dans actions.ts : un module « use server » ne
 * peut exporter que des fonctions asynchrones, chacune devenant un point
 * d'entree appelable depuis le navigateur. Une constante ou un type y provoque
 * une erreur de compilation.
 */
export type EtatFormulaire = {
  erreur?: string;
  succes?: string;
  /** Valeurs a reafficher pour ne pas obliger a tout retaper. */
  valeurs?: Record<string, string>;
};

export const ETAT_INITIAL: EtatFormulaire = {};
