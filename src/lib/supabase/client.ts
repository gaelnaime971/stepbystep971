import { createBrowserClient } from "@supabase/ssr";
import { envSupabase } from "./env";

/** Client Supabase pour les composants qui tournent dans le navigateur. */
export function clientNavigateur() {
  const { url, cle } = envSupabase();
  return createBrowserClient(url, cle);
}
