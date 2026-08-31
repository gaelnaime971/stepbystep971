import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { clientServeur } from "@/lib/supabase/server";
import { accueilSelonRole, COLONNES_PROFIL, type Role } from "@/lib/auth/session";

/**
 * Point d'arrivee des liens envoyes par email : confirmation d'inscription,
 * recuperation de mot de passe, changement d'email.
 *
 * Supabase envoie soit `token_hash` + `type` (liens classiques), soit `code`
 * (flux PKCE). Les deux sont traites : la forme depend de la configuration du
 * projet, et elle peut changer sans prevenir.
 */
export async function GET(requete: NextRequest) {
  const { searchParams, origin } = requete.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");
  const suite = searchParams.get("suite");

  const supabase = await clientServeur();
  let echec: string | null = null;

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    echec = error?.message ?? null;
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    echec = error?.message ?? null;
  } else {
    echec = "Lien incomplet.";
  }

  if (echec) {
    // On ne renvoie pas le message brut de Supabase dans l'URL : la page de
    // destination dit deja quoi faire, et un lien expire est le cas courant.
    return NextResponse.redirect(new URL("/lien-expire", origin));
  }

  // Une destination explicite prime : c'est ainsi que la recuperation de mot de
  // passe arrive sur /nouveau-mot-de-passe. Sinon, le role decide.
  if (suite && suite.startsWith("/") && !suite.startsWith("//")) {
    return NextResponse.redirect(new URL(suite, origin));
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.redirect(new URL("/connexion", origin));

  const { data: profil } = await supabase
    .from("profiles")
    .select(COLONNES_PROFIL)
    .eq("id", user.id)
    .single<{ role: Role }>();

  return NextResponse.redirect(new URL(accueilSelonRole(profil?.role), origin));
}
