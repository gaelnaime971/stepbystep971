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
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico)$).*)",
  ],
};
