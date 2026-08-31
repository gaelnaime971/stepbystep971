import type Stripe from "stripe";
import { stripe } from "@/lib/stripe/client";
import type { TypeFormule } from "./types";

export type ReferencesStripe = { productId: string; priceId: string };

export type DonneesProduit = {
  slug: string;
  name: string;
  tagline: string | null;
  kind: TypeFormule;
  sessions_count: number;
  price_cents: number;
  currency: string;
};

/**
 * REGLE 3, imposee ici et pas seulement dans l'interface.
 *
 * Un abonnement se preleve toutes les 4 SEMAINES, jamais tous les mois. Cette
 * fonction est le seul endroit du code qui fabrique une recurrence : elle ne
 * sait produire que `week` / 4. Un formulaire mal fichu, un appel direct ou une
 * relecture distraite ne peuvent pas creer un prix mensuel.
 */
function recurrence(kind: TypeFormule): Stripe.PriceCreateParams.Recurring | undefined {
  if (kind !== "subscription") return undefined;
  return { interval: "week", interval_count: 4 };
}

/**
 * Cree le produit puis le prix. Rend les deux identifiants.
 *
 * Si la creation du PRIX echoue apres celle du produit, le produit est archive
 * avant que l'erreur remonte : Stripe ne doit pas garder un produit orphelin
 * qu'aucune formule ne reference.
 */
export async function creerProduitEtPrix(
  donnees: DonneesProduit,
): Promise<ReferencesStripe> {
  const sdk = stripe();

  const produit = await sdk.products.create({
    name: donnees.name,
    description: donnees.tagline ?? undefined,
    metadata: {
      plan_slug: donnees.slug,
      plan_kind: donnees.kind,
      sessions_count: String(donnees.sessions_count),
    },
  });

  try {
    const params: Stripe.PriceCreateParams = {
      product: produit.id,
      currency: donnees.currency.toLowerCase(),
      unit_amount: donnees.price_cents,
      recurring: recurrence(donnees.kind),
      metadata: { plan_slug: donnees.slug },
    };

    // Second verrou sur la regle 3. `recurrence()` ne peut rien produire
    // d'autre ; cette assertion garantit qu'une modification future de cette
    // fonction echoue bruyamment au lieu de creer un prelevement mensuel.
    if (
      params.recurring &&
      (params.recurring.interval !== "week" || params.recurring.interval_count !== 4)
    ) {
      throw new Error(
        "Un abonnement doit etre cree en interval=week, interval_count=4. Refus.",
      );
    }

    const prix = await sdk.prices.create(params);
    return { productId: produit.id, priceId: prix.id };
  } catch (erreur) {
    await archiverProduit(produit.id).catch(() => {
      // Le produit reste actif chez Stripe, sans prix ni formule. Sans
      // consequence pour les clientes, et rattrapable a la main.
    });
    throw erreur;
  }
}

/**
 * Archive un produit Stripe et desactive ses prix.
 *
 * Un prix Stripe est immuable : on ne le modifie jamais, on le desactive et on
 * en cree un nouveau. Meme discipline que la regle 10 cote base.
 */
export async function archiverProduit(
  productId: string,
  priceId?: string | null,
): Promise<void> {
  const sdk = stripe();
  if (priceId) {
    await sdk.prices.update(priceId, { active: false }).catch(() => {});
  }
  await sdk.products.update(productId, { active: false });
}

/** Remet un produit et son prix en service. */
export async function reactiverProduit(
  productId: string,
  priceId?: string | null,
): Promise<void> {
  const sdk = stripe();
  await sdk.products.update(productId, { active: true });
  if (priceId) {
    await sdk.prices.update(priceId, { active: true }).catch(() => {});
  }
}

/**
 * Cree un NOUVEAU prix sur un produit existant et desactive l'ancien.
 *
 * C'est la seule facon de changer un tarif : un prix Stripe est immuable, on
 * ne le modifie jamais. Meme discipline que la regle 10 cote base — sauf qu'ici
 * le produit, lui, survit : c'est la meme formule, au meme nom.
 *
 * Reserve aux formules JAMAIS VENDUES. Des qu'une commande existe, le trigger
 * plans_guard_immutable refuse la mise a jour cote base, et la bonne reponse
 * est de creer une autre formule.
 */
export async function remplacerPrix(
  productId: string,
  ancienPriceId: string | null,
  donnees: Pick<DonneesProduit, "slug" | "kind" | "price_cents" | "currency">,
): Promise<string> {
  const sdk = stripe();

  const params: Stripe.PriceCreateParams = {
    product: productId,
    currency: donnees.currency.toLowerCase(),
    unit_amount: donnees.price_cents,
    recurring: recurrence(donnees.kind),
    metadata: { plan_slug: donnees.slug },
  };
  if (
    params.recurring &&
    (params.recurring.interval !== "week" || params.recurring.interval_count !== 4)
  ) {
    throw new Error(
      "Un abonnement doit etre cree en interval=week, interval_count=4. Refus.",
    );
  }

  const prix = await sdk.prices.create(params);

  // L'ancien prix est desactive APRES la creation du nouveau : si la creation
  // echoue, la formule reste achetable a son tarif actuel.
  if (ancienPriceId) {
    await sdk.prices.update(ancienPriceId, { active: false }).catch(() => {});
  }
  return prix.id;
}

/**
 * Met a jour le nom et la description du produit.
 * Le PRIX n'est jamais touche : il est immuable des deux cotes.
 */
export async function renommerProduit(
  productId: string,
  name: string,
  description: string | null,
): Promise<void> {
  await stripe().products.update(productId, {
    name,
    description: description ?? undefined,
  });
}

/** Traduit une erreur Stripe en une phrase utilisable par Oriane. */
export function messageStripe(erreur: unknown): string {
  const e = erreur as { type?: string; code?: string; message?: string };

  if (e?.type === "StripeAuthenticationError") {
    return "Stripe refuse la clé du site. Vérifie STRIPE_SECRET_KEY dans les variables d'environnement.";
  }
  if (e?.type === "StripeConnectionError") {
    return "Stripe est injoignable. Réessaie dans un instant, rien n'a été créé.";
  }
  if (e?.type === "StripeRateLimitError") {
    return "Trop d'appels à Stripe d'un coup. Attends quelques secondes et réessaie.";
  }
  if (e?.message?.includes("interval")) {
    return "Stripe a refusé la récurrence du prix. L'abonnement doit être en 4 semaines.";
  }
  return "Stripe n'a pas accepté la demande. Rien n'a été créé, tu peux réessayer.";
}
