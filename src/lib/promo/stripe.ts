import type Stripe from "stripe";
import { stripe } from "@/lib/stripe/client";

export type Remise =
  | { type: "percent"; pourcentage: number }
  | { type: "amount"; centimes: number };

export type ReferencesPromo = { couponId: string; promotionCodeId: string };

/**
 * Cree le coupon puis le code promotionnel chez Stripe.
 *
 * Meme discipline que les formules : Stripe d'abord, la base ensuite. Si le
 * CODE echoue apres le COUPON, le coupon est supprime avant que l'erreur
 * remonte — Stripe ne doit pas garder un coupon qu'aucun code n'utilise.
 */
export async function creerCodePromo(a: {
  code: string;
  remise: Remise;
  duree: "once" | "repeating" | "forever";
  dureeEnMois: number | null;
  utilisationsMax: number | null;
  expireLe: string | null;
  produitsAutorises: string[];
}): Promise<ReferencesPromo> {
  const sdk = stripe();

  const coupon = await sdk.coupons.create({
    name: a.code,
    ...(a.remise.type === "percent"
      ? { percent_off: a.remise.pourcentage }
      : { amount_off: a.remise.centimes, currency: "eur" }),
    duration: a.duree,
    ...(a.duree === "repeating" && a.dureeEnMois
      ? { duration_in_months: a.dureeEnMois }
      : {}),
    // La restriction par produit vit chez Stripe : c'est lui qui refusera le
    // code sur une formule non concernee, au moment du paiement.
    ...(a.produitsAutorises.length
      ? { applies_to: { products: a.produitsAutorises } }
      : {}),
  });

  try {
    // Sur l'API 2026-08, le coupon n'est plus passe a plat : il vit sous
    // `promotion`. Troisieme champ Stripe deplace que ce projet rencontre,
    // apres invoice.subscription et subscription.current_period_end.
    const params: Stripe.PromotionCodeCreateParams = {
      promotion: { type: "coupon", coupon: coupon.id },
      code: a.code,
      ...(a.utilisationsMax ? { max_redemptions: a.utilisationsMax } : {}),
      ...(a.expireLe ? { expires_at: Math.floor(new Date(a.expireLe).getTime() / 1000) } : {}),
    };
    const promo = await sdk.promotionCodes.create(params);
    return { couponId: coupon.id, promotionCodeId: promo.id };
  } catch (erreur) {
    await sdk.coupons.del(coupon.id).catch(() => {});
    throw erreur;
  }
}

/** Un code promo ne se supprime pas : il se desactive, des deux cotes. */
export async function desactiverCodePromo(promotionCodeId: string): Promise<void> {
  await stripe().promotionCodes.update(promotionCodeId, { active: false });
}

export async function reactiverCodePromo(promotionCodeId: string): Promise<void> {
  await stripe().promotionCodes.update(promotionCodeId, { active: true });
}

export function messagePromoStripe(erreur: unknown): string {
  const e = erreur as { code?: string; message?: string; type?: string };
  if (e?.code === "resource_already_exists" || /already exists/i.test(e?.message ?? "")) {
    return "Ce code existe déjà chez Stripe. Choisis-en un autre.";
  }
  if (e?.type === "StripeAuthenticationError") {
    return "Stripe refuse la clé du site. Préviens Gaël.";
  }
  if (e?.type === "StripeConnectionError") {
    return "Stripe est injoignable. Réessaie dans un instant, rien n'a été créé.";
  }
  return "Stripe n'a pas accepté ce code. Rien n'a été créé, tu peux réessayer.";
}
