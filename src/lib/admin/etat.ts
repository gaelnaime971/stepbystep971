export type EtatAdmin = {
  erreur?: string;
  detail?: string;
  succes?: string;
  valeurs?: Record<string, string>;
};
export const ETAT_ADMIN_INITIAL: EtatAdmin = {};
