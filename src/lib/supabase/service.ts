import { createClient } from "@supabase/supabase-js";

/**
 * Client Supabase en service_role.
 *
 * CONTOURNE LA RLS. Reserve a deux usages, et a aucun autre :
 *   * les webhooks Stripe, qui n'ont pas de session utilisatrice ;
 *   * les jobs planifies.
 *
 * Ne jamais l'importer depuis un composant client, ni depuis une action qui
 * agit au nom d'une cliente : la RLS est la protection, s'en passer par
 * commodite revient a l'eteindre.
 */
export function clientService() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const cle = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !cle) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont necessaires cote serveur.",
    );
  }

  return createClient(url, cle, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
