/** La Guadeloupe est en UTC−4 toute l'année : aucun changement d'heure. */
export const FUSEAU = "America/Guadeloupe";

const jourLong = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long", day: "numeric", month: "long", timeZone: FUSEAU,
});
const jourCourt = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long", day: "numeric", timeZone: FUSEAU,
});
const heure = new Intl.DateTimeFormat("fr-FR", {
  hour: "2-digit", minute: "2-digit", timeZone: FUSEAU,
});
const dateSeule = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric", month: "long", timeZone: FUSEAU,
});
const dateAvecAnnee = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric", month: "long", year: "numeric", timeZone: FUSEAU,
});

export const enJourLong = (iso: string) => jourLong.format(new Date(iso));
export const enJourCourt = (iso: string) => jourCourt.format(new Date(iso));
export const enDate = (iso: string) => dateSeule.format(new Date(iso));
export const enDateAnnee = (iso: string) => dateAvecAnnee.format(new Date(iso));

/** « 18h30 » plutôt que « 18:30 » : c'est ainsi qu'on écrit une heure ici. */
export function enHeure(iso: string): string {
  return heure.format(new Date(iso)).replace(":", "h");
}

export function enCreneau(debut: string, fin: string): string {
  return `${enHeure(debut)} – ${enHeure(fin)}`;
}

/** Nombre de jours pleins d'ici à une date. Négatif si elle est passée. */
export function joursRestants(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
}

export function joursLisibles(n: number): string {
  if (n <= 0) return "aujourd'hui";
  if (n === 1) return "demain";
  return `dans ${n} jours`;
}
