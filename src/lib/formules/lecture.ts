import { clientServeur } from "@/lib/supabase/server";
import { COLONNES_FORMULE, type Formule } from "./types";

/** Toutes les formules, y compris desactivees et archivees. Reserve a l'admin. */
export async function formulesToutes(): Promise<Formule[]> {
  const supabase = await clientServeur();
  const { data } = await supabase
    .from("plans")
    .select(COLONNES_FORMULE)
    .order("archived_at", { ascending: true, nullsFirst: true })
    .order("sort_order", { ascending: true })
    .returns<Formule[]>();

  return data ?? [];
}

export async function formuleParId(id: string): Promise<Formule | null> {
  const supabase = await clientServeur();
  const { data } = await supabase
    .from("plans")
    .select(COLONNES_FORMULE)
    .eq("id", id)
    .single<Formule>();

  return data ?? null;
}

/**
 * Nombre de commandes portant sur cette formule.
 *
 * C'est ce chiffre qui decide si le prix est encore modifiable : le trigger
 * plans_guard_immutable refuse toute modification des colonnes de prix des
 * qu'une commande existe. L'interface doit le dire AVANT qu'Oriane essaie,
 * pas apres.
 */
export async function nombreDeVentes(planId: string): Promise<number> {
  const supabase = await clientServeur();
  const { count } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("plan_id", planId);

  return count ?? 0;
}
