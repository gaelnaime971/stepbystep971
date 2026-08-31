import { type NextRequest } from "next/server";
import { rafraichirSession } from "@/lib/supabase/middleware";

export async function middleware(requete: NextRequest) {
  return rafraichirSession(requete);
}

export const config = {
  matcher: [
    /*
     * Tout sauf les fichiers statiques et les images.
     * /auth/confirm est volontairement inclus : le lien recu par email doit
     * pouvoir poser les cookies de session.
     *
     * /api/stripe/webhook est EXCLU : Stripe n'a pas de session, et le
     * middleware n'a rien a y rafraichir. Surtout, il ne doit rien pouvoir
     * faire au corps de la requete — la signature se verifie sur le corps brut.
     */
    "/((?!_next/static|_next/image|favicon.ico|api/stripe/webhook|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico)$).*)",
  ],
};
