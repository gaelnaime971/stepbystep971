import type Stripe from "stripe";
import { clientService } from "@/lib/supabase/service";
import { stripe } from "@/lib/stripe/client";

/**
 * Un refus qui n'est PAS une panne, et dont la phrase est deja ecrite.
 *
 * Une facture a 0 EUR ou encaissee hors Stripe n'a rien de casse : il n'y a
 * simplement rien a rembourser par ce chemin. Le dire en francais vaut mieux
 * qu'un code technique qui laisse croire a un incident.
 */
export class RemboursementImpossible extends Error {
  constructor(readonly messageOriane: string) {
    super(messageOriane);
    this.name = "RemboursementImpossible";
  }
}

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
    throw new RemboursementImpossible(
      "Cet achat ne porte ni paiement ni facture Stripe. Il n'y a rien à rembourser depuis ici.",
    );
  }

  // `expand: ["payments"]` N'EST PAS FACULTATIF.
  //
  // Depuis l'API 2026-08-26, la facture ne porte plus son paiement : ni
  // `payment_intent`, ni meme `payments`, qui n'est rendu QUE s'il est demande.
  // Sans cette expansion, la facture revient complete, sans erreur, et le
  // paiement est simplement absent — on conclut a tort qu'il n'y en a pas.
  const facture = await stripe().invoices.retrieve(commande.stripe_invoice_id, {
    expand: ["payments"],
  });

  const intent = intentDeLaFacture(facture);

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
 * Ou lire le paiement d'une facture, et quoi repondre quand il n'y en a pas.
 *
 * Le paiement est devenu un objet a part, `invoice_payment`, et son champ
 * `payment` est une union : `type` dit de quoi il s'agit.
 *
 *   payment_intent  → encaisse par carte, remboursable ;
 *   payment_record  → marque paye hors Stripe, rien a rembourser ici.
 *
 * Et une facture peut etre `paid` sans qu'un centime ait circule : remise de
 * 100 %, solde client, facture a 0 EUR. Les trois se reconnaissent a
 * `amount_paid = 0` et ne portent aucun paiement.
 */
export function intentDeLaFacture(facture: Stripe.Invoice): string {
  const brut = facture as unknown as {
    amount_paid?: number;
    /** Forme d'avant 2026-08-26. Lue au cas ou la version epinglee reculerait. */
    payment_intent?: string | { id: string } | null;
    payments?: {
      data?: {
        payment?: {
          type?: string;
          payment_intent?: string | { id: string } | null;
        };
      }[];
    };
  };

  const ancien = brut.payment_intent;
  if (ancien) return typeof ancien === "string" ? ancien : ancien.id;

  if ((brut.amount_paid ?? 0) === 0) {
    throw new RemboursementImpossible(
      "Ce prélèvement n'a rien encaissé : la facture était à 0 € — remise de 100 %, " +
        "ou réglée sur son solde client. Il n'y a rien à rembourser.",
    );
  }

  const paiements = brut.payments?.data ?? [];
  const parCarte = paiements.find((p) => p.payment?.type === "payment_intent");

  if (!parCarte) {
    throw new RemboursementImpossible(
      paiements.length > 0
        ? "Ce prélèvement a été encaissé hors Stripe. Le remboursement doit se faire " +
          "par le même moyen : Stripe ne peut pas le rendre."
        : "Aucun paiement n'est rattaché à cette facture chez Stripe. Ouvre-la dans " +
          "le tableau de bord pour voir comment elle a été réglée.",
    );
  }

  const ref = parCarte.payment!.payment_intent!;
  return typeof ref === "string" ? ref : ref.id;
}
