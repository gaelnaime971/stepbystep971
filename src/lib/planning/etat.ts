/** Etat des formulaires du planning. Hors du module « use server ». */
export type EtatPlanning = {
  erreur?: string;
  detail?: string;
  valeurs?: Record<string, string>;
};

export const ETAT_PLANNING_INITIAL: EtatPlanning = {};
