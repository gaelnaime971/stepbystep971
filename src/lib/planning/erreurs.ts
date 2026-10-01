import type { PostgrestError } from "@supabase/supabase-js";

/**
 * Traduction des refus de la base.
 *
 * Celui-ci ne doit JAMAIS atteindre Oriane en brut, et c'est le plus frequent :
 *
 *   * SB013 — le trigger courses_guard_capacity, qui refuse de descendre la
 *     capacite sous le nombre d'inscrites.
 *
 * La traduction du 23P01 reste, bien qu'aucune contrainte d'exclusion ne
 * subsiste depuis 0012. Elle ne coute rien et couvre le cas ou la base d'un
 * environnement n'aurait pas encore recu la migration : mieux vaut une phrase
 * francaise que l'exception Postgres brute.
 */
export function messagePlanning(
  erreur: PostgrestError | { code?: string; message?: string } | null,
  contexte?: { inscrites?: number },
): string {
  if (!erreur) return "Ça n'a pas fonctionné. Réessaie.";
  const code = erreur.code ?? "";
  const message = erreur.message ?? "";

  if (code === "23P01" || /courses_no_overlap/.test(message)) {
    return "Cette base refuse encore deux cours sur le même créneau. La migration 0012 n'y est pas passée : préviens Gaël.";
  }

  if (code === "SB013") {
    return contexte?.inscrites !== undefined
      ? `Ce cours a déjà ${contexte.inscrites} inscrite${contexte.inscrites > 1 ? "s" : ""} : tu ne peux pas descendre en dessous. Désinscris quelqu'un d'abord, ou garde ${contexte.inscrites} places.`
      : "Ce cours a déjà plus d'inscrites que la capacité que tu demandes. Désinscris quelqu'un d'abord.";
  }

  if (code === "SB009") return "Cette action est réservée à l'administratrice.";
  if (code === "SB008") return "Ce cours n'existe plus. Recharge la page.";
  if (code === "SB004") return "Ce cours est déjà annulé.";

  if (code === "23514") {
    if (/courses_time_order/.test(message)) {
      return "L'heure de fin doit être après l'heure de début.";
    }
    if (/courses_capacity_positive/.test(message)) {
      return "Il faut au moins une place.";
    }
    if (/courses_seats_range/.test(message)) {
      return "Ce cours a déjà plus d'inscrites que la capacité demandée.";
    }
    if (/locations_name_not_blank/.test(message)) {
      return "Donne un nom au lieu.";
    }
    return "Une valeur saisie n'est pas acceptée. Vérifie le formulaire.";
  }

  if (code === "23505") {
    if (/locations_name_key/.test(message)) {
      return "Un lieu porte déjà ce nom.";
    }
    return "Cet enregistrement existe déjà.";
  }

  return "Ça n'a pas fonctionné. Recharge la page et réessaie.";
}
