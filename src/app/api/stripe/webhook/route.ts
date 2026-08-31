import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe/client";
import { clientService } from "@/lib/supabase/service";
import {
  traiterAbonnementSupprime,
  traiterEchecPaiement,
  traiterFacturePayee,
  traiterRemboursement,
  traiterSessionTerminee,
} from "@/lib/paiement/webhook";

/**
 * Point d'entree des webhooks Stripe.
 *
 * Trois garanties, dans cet ordre :
 *   1. la signature est verifiee sur le corps BRUT — un corps deja parse ne
 *      donnerait pas le meme condensat, et sans signature n'importe qui
 *      pourrait se crediter des seances ;
 *   2. l'evenement est enregistre dans stripe_events avant tout traitement,
 *      son id servant de verrou d'idempotence ;
 *   3. un echec de traitement rend un 500 pour que Stripe REESSAIE, et laisse
 *      processed_at a NULL.
 */
export async function POST(requete: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    console.error("STRIPE_WEBHOOK_SECRET absente : webhook refuse");
    return NextResponse.json({ erreur: "webhook non configuré" }, { status: 500 });
  }

  const signature = requete.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ erreur: "signature absente" }, { status: 400 });
  }

  const corps = await requete.text();

  let evenement: Stripe.Event;
  try {
    evenement = stripe().webhooks.constructEvent(corps, signature, secret);
  } catch (erreur) {
    console.error("signature Stripe invalide", erreur);
    return NextResponse.json({ erreur: "signature invalide" }, { status: 400 });
  }

  const base = clientService();

  // L'insertion EST le verrou. Un conflit sur la cle primaire signifie que
  // l'evenement est deja passe : Stripe rejoue, on repond 200 sans rien
  // recrediter. C'est la seule protection contre un double invoice.paid.
  const { error: conflit } = await base.from("stripe_events").insert({
    id: evenement.id,
    type: evenement.type,
    api_version: evenement.api_version,
    payload: evenement as unknown as Record<string, unknown>,
  });

  if (conflit?.code === "23505") {
    return NextResponse.json({ recu: true, rejeu: true });
  }
  if (conflit) {
    console.error("stripe_events non enregistre", conflit);
    return NextResponse.json({ erreur: "journal indisponible" }, { status: 500 });
  }

  try {
    let resultat: string;
    switch (evenement.type) {
      case "checkout.session.completed":
        resultat = await traiterSessionTerminee(evenement.data.object);
        break;
      case "invoice.paid":
        resultat = await traiterFacturePayee(evenement.data.object);
        break;
      case "invoice.payment_failed":
        resultat = await traiterEchecPaiement(evenement.data.object);
        break;
      case "customer.subscription.deleted":
        resultat = await traiterAbonnementSupprime(evenement.data.object);
        break;
      case "charge.refunded":
        resultat = await traiterRemboursement(evenement.data.object);
        break;
      default:
        resultat = "type non traité";
    }

    await base
      .from("stripe_events")
      .update({ processed_at: new Date().toISOString() })
      .eq("id", evenement.id);

    return NextResponse.json({ recu: true, resultat });
  } catch (erreur) {
    const message = erreur instanceof Error ? erreur.message : String(erreur);
    console.error(`webhook ${evenement.type} en echec :`, message);

    // On garde la trace de l'echec et on laisse processed_at a NULL :
    // stripe_events_unprocessed_idx sert precisement a les retrouver.
    await base
      .from("stripe_events")
      .update({ error: message, attempts: 1 })
      .eq("id", evenement.id);

    // 500 volontaire : Stripe reessaiera. Repondre 200 sur un echec ferait
    // disparaitre l'evenement pour toujours.
    return NextResponse.json({ erreur: message }, { status: 500 });
  }
}
