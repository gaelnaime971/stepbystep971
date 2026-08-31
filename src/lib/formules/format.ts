import type { Formule, TypeFormule } from "./types";

export const UNITES = ["days", "weeks", "months"] as const;
export type Unite = (typeof UNITES)[number];

/** L'abonnement est en 4 semaines. Regle 3, verrouillee ici comme en base. */
export const VALIDITE_ABONNEMENT = "4 weeks";

/**
 * Convertit une saisie en euros vers des centimes.
 * Accepte « 15 », « 15,50 », « 15.50 », « 1 200 ». Rend null si ce n'est pas
 * un montant : jamais NaN, jamais un arrondi silencieux.
 */
export function eurosEnCentimes(saisie: string): number | null {
  const nettoye = saisie.replace(/\s| /g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(nettoye)) return null;

  const [entiers, decimales = ""] = nettoye.split(".");
  return Number(entiers) * 100 + Number(decimales.padEnd(2, "0"));
}

export function centimesEnEuros(centimes: number): string {
  return (centimes / 100).toLocaleString("fr-FR", {
    minimumFractionDigits: centimes % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

export function prixLisible(centimes: number): string {
  return `${centimesEnEuros(centimes)} €`;
}

/** Construit l'intervalle Postgres a partir de la saisie du formulaire. */
export function intervalle(nombre: number, unite: Unite): string {
  return `${nombre} ${unite}`;
}

/**
 * Rend lisible un intervalle Postgres tel qu'il revient de la base :
 * « 3 mons », « 28 days », « 1 mon ».
 */
export function validiteLisible(brut: string): string {
  const m = /^(\d+)\s*(day|days|week|weeks|mon|mons|month|months|year|years)/.exec(
    brut.trim(),
  );
  if (!m) return brut;

  const n = Number(m[1]);
  const unite = m[2];
  if (unite.startsWith("day")) {
    // 28 jours, c'est 4 semaines : c'est ainsi qu'Oriane et Stripe en parlent.
    if (n % 7 === 0) {
      const s = n / 7;
      return s === 1 ? "1 semaine" : `${s} semaines`;
    }
    return n === 1 ? "1 jour" : `${n} jours`;
  }
  if (unite.startsWith("week")) return n === 1 ? "1 semaine" : `${n} semaines`;
  if (unite.startsWith("year")) return n === 1 ? "1 an" : `${n} ans`;
  return n === 1 ? "1 mois" : `${n} mois`;
}

export const LIBELLE_TYPE: Record<TypeFormule, string> = {
  single: "À la carte",
  subscription: "Abonnement",
  pack: "Pack",
};

/**
 * Fabrique un slug depuis le nom. Doit satisfaire la contrainte
 * plans_slug_format : ^[a-z0-9]+(-[a-z0-9]+)*$
 */
export function slugDepuis(nom: string): string {
  return nom
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function economie(f: Formule): number | null {
  if (f.compare_at_price_cents === null) return null;
  return f.compare_at_price_cents - f.price_cents;
}
