import type Stripe from "stripe";
import { clientService } from "@/lib/supabase/service";
import { stripe } from "@/lib/stripe/client";

/**
 * Le `payment_intent` d'une commande, quitte a aller le chercher chez Stripe.
 *
 * UNE COMMANDE D'ABONNEMENT N'EN A PAS EN BASE. Elle nait d'`invoice.paid`, qui
 * n'ecrit que `stripe_invoice_id`. Or le webhook `charge.refunded` cherche la
 * commande par `stripe_payment_intent_id` : sans cette colonne, un
 * remboursement de prelevement ne serait rattache a RIEN. L'argent partirait,
 * la cliente garderait ses seances, et rien ne le signalerait.
 *
 * On resout donc l'identifiant depuis la facture et on l'ECRIT sur la commande
 * AVANT de rembourser. Le webhook retrouve alors son chemin sans avoir ete
 * modifie : c'est l'appelant qui se met en etat d'etre compris, pas le code qui
 * encaisse qui change.
 */
export async function paymentIntentDeLaCommande(commande: {
  id: string;
  stripe_payment_intent_id: string | null;
  stripe_invoice_id: string | null;
}): Promise<string> {
  if (commande.stripe_payment_intent_id) return commande.stripe_payment_intent_id;
  if (!commande.stripe_invoice_id) {
    throw new Error("Cet achat ne porte ni paiement ni facture Stripe.");
  }

  const facture = await stripe().invoices.retrieve(commande.stripe_invoice_id);
  const intent = intentDeLaFacture(facture);
  if (!intent) {
    throw new Error(`Aucun paiement rattache a la facture ${commande.stripe_invoice_id}.`);
  }

  // `authenticated` n'a que le SELECT sur `orders` — aucune policy d'ecriture,
  // volontairement : une commande ne se retouche pas depuis l'application.
  // Cette colonne-ci est de la comptabilite Stripe, pas une donnee metier, et
  // c'est le meme cas de figure que `profiles.stripe_customer_id` au premier
  // paiement. Seule cette colonne est ecrite, et seulement si elle est vide.
  const { error } = await clientService()
    .from("orders")
    .update({ stripe_payment_intent_id: intent })
    .eq("id", commande.id)
    .is("stripe_payment_intent_id", null);

  if (error) {
    throw new Error(`Paiement Stripe non rattache a la commande : ${error.message}`);
  }

  return intent;
}

/**
 * Ou lire le paiement d'une facture, selon la version d'API.
 *
 * `2026-08-26.dahlia` a deplace le champ vers la liste `payments`. On lit les
 * deux formes, pour survivre a un changement de version epinglee — meme
 * precaution que dans le webhook pour `subscription` et `current_period_end`.
 */
function intentDeLaFacture(facture: Stripe.Invoice): string | null {
  const brut = facture as unknown as {
    payment_intent?: string | { id: string } | null;
    payments?: { data?: { payment?: { payment_intent?: string | { id: string } | null } }[] };
  };

  const ancien = brut.payment_intent;
  if (ancien) return typeof ancien === "string" ? ancien : ancien.id;

  const nouveau = brut.payments?.data?.[0]?.payment?.payment_intent;
  if (nouveau) return typeof nouveau === "string" ? nouveau : nouveau.id;

  return null;
}
