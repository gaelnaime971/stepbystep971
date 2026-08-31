import { joursRestants } from "@/lib/dates";
import type { Cours, Lot, Reservation } from "./types";

export type AlerteLot = {
  lot: Lot;
  /** Séances de ce lot qu'aucun cours au planning ne permet de poser. */
  nonPlacables: number;
  joursAvantEcheance: number;
};

/**
 * Simule exactement ce que fera book_course, lot par lot et cours par cours.
 *
 * Les regles 4 et 5 ont une consequence que le solde global masque : une
 * cliente peut avoir « 6 seances » et ne pas pouvoir en poser 2, parce que le
 * lot qui expire le plus tot n'est atteint par aucun cours reservable. Le
 * chiffre en tete de page dirait 6, et elle en perdrait 2 sans comprendre.
 *
 * On rejoue donc l'algorithme du serveur : les cours dans l'ordre chronologique,
 * chacun affecte au lot ACTIF le plus proche de l'echeance qui couvre sa date
 * (regle 4), et seulement s'il la couvre (regle 5). Ce qui reste a la fin est
 * ce qui sera perdu.
 *
 * `lots` doit arriver trie par expires_at croissant — c'est ce que rend
 * lotsActifs(), et c'est ce qui rend `find()` correct ici.
 *
 * LIMITE ASSUMEE : on ne juge un lot que si son echeance tombe DANS la periode
 * couverte par le planning publie. Un lot qui expire dans 30 jours n'a
 * evidemment aucun cours a sa date quand Oriane n'a pose que la semaine a
 * venir — l'annoncer comme perdu serait une fausse alerte, et une fausse
 * alerte repetee finit par etre ignoree, y compris quand elle est vraie.
 * Au-dela du dernier cours connu, on ne dit rien.
 */
export function alertesExpiration(
  lots: Lot[],
  cours: Cours[],
  reservations: Reservation[],
): AlerteLot[] {
  const dejaReserves = new Set(reservations.map((r) => r.course_id));

  const reservables = cours
    .filter((c) => c.status === "scheduled")
    .filter((c) => c.seats_taken < c.capacity)
    .filter((c) => !dejaReserves.has(c.id))
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));

  // Jusqu'ou le planning permet de conclure.
  const horizon = cours
    .filter((c) => c.status === "scheduled")
    .reduce<string | null>((max, c) => (max === null || c.starts_at > max ? c.starts_at : max), null);

  const suivi = lots.map((lot) => ({ lot, restant: lot.quantity_remaining, placees: 0 }));

  for (const c of reservables) {
    const cible = suivi.find((s) => s.restant > 0 && s.lot.expires_at >= c.starts_at);
    if (!cible) continue;
    cible.restant -= 1;
    cible.placees += 1;
  }

  return suivi
    .map(({ lot, placees }) => ({
      lot,
      // Au-dela de l'horizon du planning, l'absence de cours ne prouve rien.
      nonPlacables:
        horizon !== null && lot.expires_at <= horizon
          ? lot.quantity_remaining - placees
          : 0,
      joursAvantEcheance: joursRestants(lot.expires_at),
    }))
    .filter((a) => a.nonPlacables > 0 || a.joursAvantEcheance <= 7);
}

export function totalNonPlacables(alertes: AlerteLot[]): number {
  return alertes.reduce((n, a) => n + a.nonPlacables, 0);
}
