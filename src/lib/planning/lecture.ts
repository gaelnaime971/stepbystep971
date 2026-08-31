import { clientServeur } from "@/lib/supabase/server";
import { COLONNES_LIEU, COLONNES_COURS_ADMIN, type CoursAdmin, type Inscrite, type LieuAdmin } from "./types";
import { ajouterJours, instantGuadeloupe } from "./dates";

/** Les cours d'une plage de dates calendaires, bornes comprises. */
export async function coursEntre(debut: string, fin: string): Promise<CoursAdmin[]> {
  const supabase = await clientServeur();
  const { data } = await supabase
    .from("courses")
    .select(COLONNES_COURS_ADMIN)
    .gte("starts_at", instantGuadeloupe(debut, "00:00"))
    .lt("starts_at", instantGuadeloupe(ajouterJours(fin, 1), "00:00"))
    .order("starts_at", { ascending: true })
    .returns<CoursAdmin[]>();

  return data ?? [];
}

export async function coursParId(id: string): Promise<CoursAdmin | null> {
  const supabase = await clientServeur();
  const { data } = await supabase
    .from("courses")
    .select(COLONNES_COURS_ADMIN)
    .eq("id", id)
    .single<CoursAdmin>();

  return data ?? null;
}

/** Tous les lieux, actifs ou non : l'admin doit voir ce qu'elle a fermé. */
export async function tousLesLieux(): Promise<LieuAdmin[]> {
  const supabase = await clientServeur();
  const { data } = await supabase
    .from("locations")
    .select(COLONNES_LIEU)
    .order("is_active", { ascending: false })
    .order("sort_order", { ascending: true })
    .returns<LieuAdmin[]>();

  return data ?? [];
}

/**
 * Les inscrites d'un cours.
 *
 * Deux requetes plutot qu'une jointure imbriquee : `profiles` a un SELECT
 * accorde colonne par colonne, et enumerer les colonnes d'une table embarquee
 * est plus fragile que de faire deux appels lisibles.
 */
export async function inscritesDuCours(coursId: string): Promise<Inscrite[]> {
  const supabase = await clientServeur();

  const { data: reservations } = await supabase
    .from("bookings")
    .select("id, user_id, booked_at")
    .eq("course_id", coursId)
    .eq("status", "booked")
    .order("booked_at", { ascending: true })
    .returns<{ id: string; user_id: string; booked_at: string }[]>();

  if (!reservations?.length) return [];

  const { data: profils } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, email, phone")
    .in("id", reservations.map((r) => r.user_id))
    .returns<{ id: string; first_name: string; last_name: string; email: string; phone: string | null }[]>();

  const parId = new Map((profils ?? []).map((p) => [p.id, p]));

  return reservations.map((r) => {
    const p = parId.get(r.user_id);
    return {
      bookingId: r.id,
      userId: r.user_id,
      prenom: p?.first_name ?? "—",
      nom: p?.last_name ?? "",
      email: p?.email ?? "",
      telephone: p?.phone ?? null,
      reserveLe: r.booked_at,
    };
  });
}

/**
 * Les cours qui chevauchent une plage. Sert au pre-controle avant creation :
 * la contrainte courses_no_overlap reste le juge, mais elle ne sait pas dire
 * QUELLE date pose probleme dans une repetition de douze semaines.
 */
export async function coursQuiChevauchent(
  debutISO: string,
  finISO: string,
  sauf?: string,
): Promise<CoursAdmin[]> {
  const supabase = await clientServeur();
  let requete = supabase
    .from("courses")
    .select(COLONNES_COURS_ADMIN)
    .eq("status", "scheduled")
    .lt("starts_at", finISO)
    .gt("ends_at", debutISO);

  if (sauf) requete = requete.neq("id", sauf);

  const { data } = await requete.returns<CoursAdmin[]>();
  return data ?? [];
}
