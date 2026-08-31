import { clientServeur } from "@/lib/supabase/server";
import type {
  Abonnement, Achat, Cours, FormuleLisible, Lieu, Lot, Reservation,
} from "./types";

const COLONNES_LOT = "id, quantity_remaining, expires_at, plan_id";
const COLONNES_COURS = "id, starts_at, ends_at, capacity, seats_taken, status, location_id";
const COLONNES_FORMULE_LISIBLE = "id, name, price_cents, cancellation_deadline_hours, kind";

/**
 * Les lots ACTIFS, du plus proche au plus lointain.
 *
 * Actif = quantity_remaining > 0 ET closed_at IS NULL ET expires_at > now().
 * Ce dernier filtre est ce qui applique la regle 1 : meme si le balayage
 * nocturne n'a pas tourne, une seance echue est invisible.
 *
 * L'ordre est celui de la consommation (regle 4) : le premier lot de cette
 * liste est celui que book_course debitera.
 */
export async function lotsActifs(): Promise<Lot[]> {
  const supabase = await clientServeur();
  const { data } = await supabase
    .from("credit_lots")
    .select(COLONNES_LOT)
    .gt("quantity_remaining", 0)
    .is("closed_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("expires_at", { ascending: true })
    .order("issued_at", { ascending: true })
    .returns<Lot[]>();

  return data ?? [];
}

/**
 * Des lots par identifiant, quel que soit leur etat.
 *
 * Sert aux reservations en cours : la seance a ete financee par un lot qui peut
 * etre vide, expire ou ferme depuis. Son delai d'annulation reste pourtant
 * celui qui s'applique (regle 6), et la cliente doit pouvoir le lire.
 */
export async function lotsParIds(ids: string[]): Promise<Lot[]> {
  const uniques = [...new Set(ids.filter(Boolean))];
  if (uniques.length === 0) return [];

  const supabase = await clientServeur();
  const { data } = await supabase
    .from("credit_lots")
    .select(COLONNES_LOT)
    .in("id", uniques)
    .returns<Lot[]>();

  return data ?? [];
}

export function soldeTotal(lots: Lot[]): number {
  return lots.reduce((n, l) => n + l.quantity_remaining, 0);
}

/** Les cours a venir, tous lieux confondus. Lecture publique. */
export async function coursAVenir(limite = 40): Promise<Cours[]> {
  const supabase = await clientServeur();
  const { data } = await supabase
    .from("courses")
    .select(COLONNES_COURS)
    .eq("status", "scheduled")
    .gt("starts_at", new Date().toISOString())
    .order("starts_at", { ascending: true })
    .limit(limite)
    .returns<Cours[]>();

  return data ?? [];
}

export async function lieux(): Promise<Map<string, string>> {
  const supabase = await clientServeur();
  const { data } = await supabase.from("locations").select("id, name").returns<Lieu[]>();
  return new Map((data ?? []).map((l) => [l.id, l.name]));
}

/** Mes reservations en cours, sur des cours a venir. */
export async function mesReservations(): Promise<Reservation[]> {
  const supabase = await clientServeur();
  const { data } = await supabase
    .from("bookings")
    .select("id, course_id, booked_at, credit_lot_id")
    .eq("status", "booked")
    .order("booked_at", { ascending: true })
    .returns<Reservation[]>();

  return data ?? [];
}

export async function monAbonnement(): Promise<Abonnement | null> {
  const supabase = await clientServeur();
  const { data } = await supabase
    .from("subscriptions")
    .select(
      "id, status, current_period_end, cancel_at_period_end, payment_failed_at, dunning_exhausted_at, plan_id",
    )
    .order("created_at", { ascending: false })
    .limit(1)
    .returns<Abonnement[]>();

  return data?.[0] ?? null;
}

export async function mesAchats(): Promise<Achat[]> {
  const supabase = await clientServeur();
  const { data } = await supabase
    .from("orders")
    .select("id, kind, status, amount_cents, paid_at, created_at, plan_id")
    .order("created_at", { ascending: false })
    .returns<Achat[]>();

  return data ?? [];
}

/**
 * Les formules citees par mes lots, mon abonnement et mes achats.
 *
 * La policy plans_select_own_history me les rend lisibles meme archivees :
 * regle 10, une abonnee ne migre pas et doit continuer a voir ce qu'elle a
 * achete.
 */
export async function formulesLisibles(ids: string[]): Promise<Map<string, FormuleLisible>> {
  const uniques = [...new Set(ids.filter(Boolean))];
  if (uniques.length === 0) return new Map();

  const supabase = await clientServeur();
  const { data } = await supabase
    .from("plans")
    .select(COLONNES_FORMULE_LISIBLE)
    .in("id", uniques)
    .returns<FormuleLisible[]>();

  return new Map((data ?? []).map((f) => [f.id, f]));
}

/** Les formules encore en vente, pour proposer de recharger. */
export async function formulesEnVente(): Promise<FormuleLisible[]> {
  const supabase = await clientServeur();
  const { data } = await supabase
    .from("plans")
    .select(COLONNES_FORMULE_LISIBLE)
    .eq("is_active", true)
    .not("stripe_price_id", "is", null)
    .order("sort_order", { ascending: true })
    .returns<FormuleLisible[]>();

  return data ?? [];
}
