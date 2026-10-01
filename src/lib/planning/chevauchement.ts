import { enDate, enHeure } from "@/lib/dates";
import type { CoursAdmin } from "./types";

export type Conflit = {
  /** Le creneau qu'on est en train de poser. */
  debut: string;
  fin: string;
  /** Le cours deja au planning qui l'empiete. */
  existant: CoursAdmin;
};

/**
 * Deux instants, compares comme des INSTANTS et non comme du texte.
 *
 * C'est le bug qui a bloque Oriane. PostgREST rend « …T23:00:00+00:00 » et
 * `toISOString()` rend « …T23:00:00.000Z » : le meme instant, deux textes
 * differents. Compares caractere par caractere, le « + » (43) passe avant le
 * « . » (46), donc une borne EGALE paraissait STRICTEMENT INFERIEURE — et deux
 * cours qui se suivent, 18h-19h puis 19h-20h, se voyaient declares en conflit.
 *
 * Le piege ne tient pas a un `<=` de trop : il tient a comparer des dates sous
 * forme de chaines. On passe donc par des nombres, ou l'egalite est l'egalite.
 */
const instant = (iso: string): number => new Date(iso).getTime();

/**
 * Les creneaux qui en empietent un autre, en bornes SEMI-OUVERTES [debut, fin).
 *
 * 18h-19h et 19h-20h ne se chevauchent pas : la fin de l'un est le debut de
 * l'autre, et un cours ne dure pas sa derniere seconde.
 */
export function chevauchements(
  poses: { starts_at: string; ends_at: string }[],
  existants: CoursAdmin[],
): Conflit[] {
  const conflits: Conflit[] = [];
  for (const p of poses) {
    const debut = instant(p.starts_at);
    const fin = instant(p.ends_at);
    const existant = existants.find(
      (e) => instant(e.starts_at) < fin && instant(e.ends_at) > debut,
    );
    if (existant) conflits.push({ debut: p.starts_at, fin: p.ends_at, existant });
  }
  return conflits;
}

/**
 * Ce qu'Oriane lit quand elle a cree par-dessus quelque chose.
 *
 * Elle a deja valide : la phrase ne demande rien, elle CONSTATE, et nomme le
 * cours concerne pour qu'elle puisse verifier d'un coup d'oeil si c'etait
 * voulu. Sur une repetition, elle nomme les dates — c'est precisement ce
 * qu'un refus de la base ne savait pas dire.
 */
export function phraseConflits(conflits: Conflit[], nomLieu: Map<string, string>): string {
  const lieu = (c: Conflit) => nomLieu.get(c.existant.location_id) ?? "un autre lieu";

  if (conflits.length === 1) {
    const c = conflits[0];
    return (
      `À savoir : un cours existe déjà le ${enDate(c.existant.starts_at)} ` +
      `de ${enHeure(c.existant.starts_at)} à ${enHeure(c.existant.ends_at)} ` +
      `à ${lieu(c)}. Les deux se tiennent en même temps — c'est possible, ` +
      `vérifie juste que c'est bien ce que tu voulais.`
    );
  }

  const dates = conflits.map((c) => enDate(c.debut)).join(", ");
  return (
    `À savoir : ${conflits.length} de ces séances tombent sur un créneau déjà ` +
    `occupé — ${dates}. Elles ont toutes été créées. Ouvre ces dates si tu veux ` +
    `annuler les doublons.`
  );
}

/**
 * Le ton d'un bandeau, depuis le parametre d'URL.
 *
 * Les pages collapsaient tout ce qui n'etait pas « erreur » en « succes ». Un
 * avertissement ambre s'y serait affiche en vert, ce qui dirait le contraire
 * de ce qu'il raconte.
 */
export function tonBandeau(ton: string | undefined): "succes" | "erreur" | "attention" {
  return ton === "erreur" ? "erreur" : ton === "attention" ? "attention" : "succes";
}
