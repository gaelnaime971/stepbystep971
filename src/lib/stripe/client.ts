import Stripe from "stripe";

/**
 * Instance Stripe cote serveur.
 *
 * Lue a l'appel et non au chargement du module, comme pour Supabase : `next
 * build` ne doit pas exiger une cle que rien n'utilise a la compilation.
 */
export function stripe(): Stripe {
  const cle = process.env.STRIPE_SECRET_KEY;

  if (!cle) {
    throw new Error(
      "STRIPE_SECRET_KEY est absente. Copie .env.local.example en .env.local et renseigne-la.",
    );
  }
  if (!/^sk_(test|live)_/.test(cle)) {
    throw new Error(
      `STRIPE_SECRET_KEY ne ressemble pas a une cle secrete (recu : « ${cle.slice(0, 8)}… »). ` +
        "Attendu : sk_test_… en developpement, sk_live_… en production. " +
        "Une cle publiable commence par pk_ et n'a pas le droit de creer des produits.",
    );
  }

  return new Stripe(cle);
}

/** Vrai si l'on travaille sur les cles de test. Affiche dans l'admin. */
export function stripeEnModeTest(): boolean {
  return (process.env.STRIPE_SECRET_KEY ?? "").startsWith("sk_test_");
}
