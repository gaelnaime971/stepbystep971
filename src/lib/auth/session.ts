import { cache } from "react";
import { clientServeur } from "@/lib/supabase/server";

export type Role = "cliente" | "admin";

export type Profil = {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  role: Role;
  stripe_customer_id: string | null;
};

/**
 * Colonnes lisibles de `profiles`.
 *
 * `select('*')` est INTERDIT sur cette table : le SELECT de table a ete
 * revoque en 0004 et reaccorde colonne par colonne, pour qu'`admin_notes` reste
 * hors de portee — y compris de la cliente concernee. Une etoile ici produirait
 * un « permission denied for column admin_notes ».
 */
export const COLONNES_PROFIL =
  "id, email, first_name, last_name, phone, role, stripe_customer_id";

/**
 * L'utilisatrice connectee, ou null.
 * getUser() valide le jeton aupres de Supabase ; getSession() se contenterait
 * de lire un cookie.
 */
export const utilisatriceCourante = cache(async () => {
  const supabase = await clientServeur();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

/** Le profil de l'utilisatrice connectee, ou null. */
export const profilCourant = cache(async (): Promise<Profil | null> => {
  const utilisatrice = await utilisatriceCourante();
  if (!utilisatrice) return null;

  const supabase = await clientServeur();
  const { data } = await supabase
    .from("profiles")
    .select(COLONNES_PROFIL)
    .eq("id", utilisatrice.id)
    .single<Profil>();

  return data ?? null;
});

/** Route d'accueil selon le role. */
export function accueilSelonRole(role: Role | undefined | null): string {
  return role === "admin" ? "/admin" : "/compte";
}
