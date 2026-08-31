import { NextResponse, type NextRequest } from "next/server";
import { accueilSelonRole, profilCourant } from "@/lib/auth/session";

/**
 * Aiguillage selon le role.
 *
 * Le middleware ne peut pas trancher lui-meme : il faudrait une requete en base
 * a chaque navigation du site. Il envoie donc ici, et cette route paie la
 * requete une seule fois, au moment ou la question se pose reellement.
 */
export async function GET(requete: NextRequest) {
  const profil = await profilCourant();
  const destination = profil ? accueilSelonRole(profil.role) : "/connexion";
  return NextResponse.redirect(new URL(destination, requete.nextUrl.origin));
}
