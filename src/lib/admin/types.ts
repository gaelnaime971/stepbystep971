export type ClienteResume = {
  id: string;
  prenom: string;
  nom: string;
  email: string;
  telephone: string | null;
  solde: number;
  prochaineEcheance: string | null;
  formule: string | null;
  inscriteLe: string;
};

export type LotDetail = {
  id: string;
  quantite: number;
  quantiteInitiale: number;
  expire: string;
  origine: string;
  ferme: string | null;
  motifFermeture: string | null;
  formule: string | null;
  motif: string | null;
};

export type ReservationDetail = {
  id: string;
  statut: string;
  debut: string;
  fin: string;
  lieu: string;
  reserveLe: string;
  recreditee: boolean;
  coursId: string;
  coursAnnule: boolean;
};

export type AchatDetail = {
  id: string;
  type: string;
  statut: string;
  montant: number;
  rembourse: number;
  date: string;
  formule: string | null;
  stripePaymentIntent: string | null;
  stripeInvoice: string | null;
  stripeSession: string | null;
  /** Ce qu'un remboursement de cet achat emporterait. Calcule pour l'affichage. */
  impact: ImpactRemboursement;
};

/**
 * L'etat des lieux montre a Oriane AVANT qu'elle valide.
 *
 * Deux gisements distincts, jamais additionnes : le solde encore disponible se
 * revoque, les inscriptions a venir s'annulent. Les cours deja suivis ne
 * bougent pas — un cours suivi ne se defait pas parce qu'un paiement est
 * rembourse.
 */
export type ImpactRemboursement = {
  /** Ce qu'il reste a rembourser sur cet achat, en centimes. */
  remboursable: number;
  /** Seances encore au solde, finances par cet achat. */
  soldeRevocable: number;
  /** Seances de cet achat deja consommees sur des cours PASSES. */
  consommeesPassees: number;
  /** Inscriptions a venir financees par cet achat, de la plus lointaine d'abord. */
  coursAVenir: { bookingId: string; debut: string; fin: string; lieu: string }[];
  /** Prix d'une seance sur cet achat, en centimes. Null si indeterminable. */
  prixSeance: number | null;
};

export type AbonnementDetail = {
  id: string;
  statut: string;
  finPeriode: string | null;
  resilieALaFin: boolean;
  echecDepuis: string | null;
  echecDefinitif: string | null;
  formule: string | null;
  stripeId: string;
};

export type EmailEnvoye = {
  id: string;
  modele: string;
  destinataire: string;
  envoyeLe: string;
  erreur: string | null;
};

export type Attention =
  | { type: "formule_non_publiee"; nombre: number }
  | { type: "paiement_en_echec"; nombre: number }
  | { type: "webhook_non_traite"; nombre: number }
  | { type: "seances_expirent"; nombre: number; clientes: number }
  | { type: "cours_complet"; nombre: number }
  | { type: "cours_vide"; nombre: number };
