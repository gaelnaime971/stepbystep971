import { FUSEAU } from "@/lib/dates";

/**
 * La Guadeloupe est a UTC−4 toute l'annee, sans changement d'heure. On peut
 * donc composer un instant exact en collant l'offset au texte saisi, plutot
 * que de passer par un Date construit dans le fuseau du serveur — qui serait
 * celui de Vercel, pas celui d'Oriane.
 */
const OFFSET = "-04:00";

/** « 2026-09-09 » + « 18:30 » -> instant UTC exact. */
export function instantGuadeloupe(date: string, heure: string): string {
  return new Date(`${date}T${heure}:00${OFFSET}`).toISOString();
}

const enISOLocale = new Intl.DateTimeFormat("en-CA", {
  year: "numeric", month: "2-digit", day: "2-digit", timeZone: FUSEAU,
});

/** La date calendaire d'un instant, vue de Guadeloupe : « 2026-09-09 ». */
export function dateLocale(iso: string): string {
  return enISOLocale.format(new Date(iso));
}

export function aujourdHui(): string {
  return dateLocale(new Date().toISOString());
}

/**
 * Ajoute des jours a une date calendaire, sans jamais fabriquer d'instant.
 * C'est ce qui garantit qu'une repetition hebdomadaire tombe bien le meme jour
 * a la meme heure locale, semaine apres semaine.
 */
export function ajouterJours(date: string, n: number): string {
  const [a, m, j] = date.split("-").map(Number);
  const d = new Date(Date.UTC(a, m - 1, j));
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function moisDe(date: string): string {
  return date.slice(0, 7);
}

export function moisSuivant(mois: string, pas: number): string {
  const [a, m] = mois.split("-").map(Number);
  const d = new Date(Date.UTC(a, m - 1 + pas, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export type Case = { date: string; horsMois: boolean };

/** La grille du mois, du lundi au dimanche, cases voisines comprises. */
export function grilleMois(mois: string): Case[] {
  const [a, m] = mois.split("-").map(Number);
  const premier = new Date(Date.UTC(a, m - 1, 1));
  // getUTCDay : 0 = dimanche. On veut lundi en tete.
  const decalage = (premier.getUTCDay() + 6) % 7;
  const debut = new Date(premier);
  debut.setUTCDate(debut.getUTCDate() - decalage);

  const cases: Case[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(debut);
    d.setUTCDate(d.getUTCDate() + i);
    const iso = d.toISOString().slice(0, 10);
    cases.push({ date: iso, horsMois: iso.slice(0, 7) !== mois });
    // On s'arrete apres la semaine qui contient le dernier jour du mois.
    if (i >= 27 && i % 7 === 6 && iso.slice(0, 7) !== mois) break;
  }
  return cases;
}

const nomMois = new Intl.DateTimeFormat("fr-FR", {
  month: "long", year: "numeric", timeZone: "UTC",
});

export function moisLisible(mois: string): string {
  const [a, m] = mois.split("-").map(Number);
  return nomMois.format(new Date(Date.UTC(a, m - 1, 1)));
}

/** Le lundi de la semaine d'une date, et les 7 jours qui suivent. */
export function semaineDe(date: string): string[] {
  const [a, m, j] = date.split("-").map(Number);
  const d = new Date(Date.UTC(a, m - 1, j));
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  const lundi = d.toISOString().slice(0, 10);
  return Array.from({ length: 7 }, (_, i) => ajouterJours(lundi, i));
}

export const JOURS_COURTS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
