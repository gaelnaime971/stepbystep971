export type TypeFormule = "single" | "subscription" | "pack";

export type Formule = {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  kind: TypeFormule;
  sessions_count: number;
  validity_interval: string;
  price_cents: number;
  compare_at_price_cents: number | null;
  currency: string;
  stripe_product_id: string | null;
  stripe_price_id: string | null;
  cancellation_deadline_hours: number;
  is_active: boolean;
  is_highlighted: boolean;
  features: string[];
  sort_order: number;
  archived_at: string | null;
};

/**
 * Colonnes lues sur `plans`. Enumerees et non `*` : c'est la regle de la
 * maison, et elle vaut meme la ou aucun GRANT de colonne ne l'impose — une
 * colonne privee ajoutee demain ne doit pas fuir par une etoile oubliee.
 */
export const COLONNES_FORMULE =
  "id, slug, name, tagline, kind, sessions_count, validity_interval, " +
  "price_cents, compare_at_price_cents, currency, stripe_product_id, " +
  "stripe_price_id, cancellation_deadline_hours, is_active, is_highlighted, " +
  "features, sort_order, archived_at";

export type EtatPublication =
  | "publiee"
  | "gratuite"
  | "non_publiee"
  | "desactivee"
  | "archivee";

/** Une formule a 0 EUR. Elle ne passe par Stripe a aucun moment. */
export function estGratuite(f: Pick<Formule, "price_cents">): boolean {
  return f.price_cents === 0;
}

/**
 * Une formule active sans stripe_price_id n'est PAS achetable : le paiement
 * n'aurait aucun prix a presenter. C'est le seul etat qui demande une action,
 * et il doit se voir avant qu'une cliente le decouvre.
 *
 * SAUF SI ELLE EST GRATUITE. Stripe Checkout refuse une session a zero : une
 * formule offerte n'a donc ni produit, ni prix, ni session — et n'aura jamais
 * de `stripe_price_id`. Sans ce cas, elle serait rangee « non publiee », donc
 * non achetable, donc INVISIBLE SUR LA VITRINE — sans le moindre message.
 * Oriane aurait cru a une panne.
 */
export function etatPublication(f: Formule): EtatPublication {
  if (f.archived_at) return "archivee";
  if (!f.is_active) return "desactivee";
  if (estGratuite(f)) return "gratuite";
  return f.stripe_price_id ? "publiee" : "non_publiee";
}

export function estAchetable(f: Formule): boolean {
  const etat = etatPublication(f);
  return etat === "publiee" || etat === "gratuite";
}
