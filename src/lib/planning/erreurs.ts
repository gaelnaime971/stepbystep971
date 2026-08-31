import type { PostgrestError } from "@supabase/supabase-js";

/**
 * Traduction des refus de la base.
 *
 * Deux d'entre eux ne doivent JAMAIS atteindre Oriane en brut, et ce sont
 * justement les deux qu'elle rencontrera le plus :
 *
 *   * 23P01 sur courses_no_overlap — la contrainte d'exclusion. Son nom est
 *     l'interface : c'est pour ca qu'elle est nommee dans 0002.
 *   * SB013 — le trigger courses_guard_capacity, qui refuse de descendre la
 *     capacite sous le nombre d'inscrites.
 */
export function messagePlanning(
  erreur: PostgrestError | { code?: string; message?: string } | null,
  contexte?: { inscrites?: number },
): string {
  if (!erreur) return "Ça n'a pas fonctionné. Réessaie.";
  const code = erreur.code ?? "";
  const message = erreur.message ?? "";

  if (code === "23P01" || /courses_no_overlap/.test(message)) {
    return "Tu as déjà un cours sur ce créneau. Tu ne peux pas être à deux endroits en même temps : choisis un autre horaire.";
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
