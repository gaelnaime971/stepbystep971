import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { envSupabase } from "./env";

/**
 * Client Supabase pour les composants serveur, les Server Actions et les Route
 * Handlers. Porte la session de l'utilisatrice via les cookies.
 *
 * Ce client passe par le role `authenticated` : la RLS s'applique. Il ne
 * remplace pas service_role, qui reste reserve aux webhooks Stripe et aux crons.
 */
export async function clientServeur() {
  const { url, cle } = envSupabase();
  const magasin = await cookies();

  return createServerClient(url, cle, {
    cookies: {
      getAll() {
        return magasin.getAll();
      },
      setAll(cookiesAEcrire) {
        try {
          for (const { name, value, options } of cookiesAEcrire) {
            magasin.set(name, value, options);
          }
        } catch {
          // Appel depuis un Server Component : les cookies y sont en lecture
          // seule. Le middleware a deja rafraichi la session, il n'y a rien a
          // rattraper ici.
        }
      },
    },
  });
}
