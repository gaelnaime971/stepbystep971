import type Stripe from "stripe";
import { clientService } from "@/lib/supabase/service";
import { stripe } from "@/lib/stripe/client";
import { envoyer } from "@/lib/emails/envoyer";
import { confirmationAchat, paiementEchoue } from "@/lib/emails/modeles";

type Base = ReturnType<typeof clientService>;

/**
 * L'abonnement d'une facture.
 *
 * Sur l'API 2026-08, `invoice.subscription` a disparu au profit de
 * `invoice.parent.subscription_details.subscription`. Les deux formes sont
 * lues : le jour ou l'on epingle une version d'API differente, ce handler
 * continue de fonctionner au lieu d'ignorer silencieusement les factures.
 */
function abonnementDeFacture(facture: Stripe.Invoice): string | null {
  const ancienne = (facture as unknown as { subscription?: string | { id: string } }).subscription;
  if (ancienne) return typeof ancienne === "string" ? ancienne : ancienne.id;

  const sous = facture.parent?.subscription_details?.subscription;
  if (!sous) return null;
  return typeof sous === "string" ? sous : sous.id;
}

/**
 * La periode courante d'un abonnement.
 *
 * Meme histoire : sur l'API 2026-08 elle vit sur les ITEMS, plus sur
 * l'abonnement. C'est cette date qui devient l'expiration du lot, donc s'y
 * tromper ferait expirer des seances au mauvais moment.
 */
function periodeDe(abo: Stripe.Subscription): { debut: string | null; fin: string | null } {
  const brut = abo as unknown as { current_period_start?: number; current_period_end?: number };
  const item = abo.items?.data?.[0] as unknown as
    | { current_period_start?: number; current_period_end?: number }
    | undefined;

  const debut = brut.current_period_start ?? item?.current_period_start ?? null;
  const fin = brut.current_period_end ?? item?.current_period_end ?? null;

  return {
    debut: debut ? new Date(debut * 1000).toISOString() : null,
    fin: fin ? new Date(fin * 1000).toISOString() : null,
  };
}

const enISO = (secondes: number | null | undefined) =>
  secondes ? new Date(secondes * 1000).toISOString() : null;

/** Notre miroir d'un code promo Stripe, s'il existe. */
async function promoLocal(base: Base, promotionCodeId: string | null): Promise<string | null> {
  if (!promotionCodeId) return null;
  const { data } = await base
    .from("promo_codes")
    .select("id")
    .eq("stripe_promotion_code_id", promotionCodeId)
    .maybeSingle<{ id: string }>();
  return data?.id ?? null;
}

async function utilisatriceDuClient(base: Base, customerId: string | null): Promise<string | null> {
  if (!customerId) return null;
  const { data } = await base
    .from("profiles")
    .select("id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle<{ id: string }>();
  return data?.id ?? null;
}

const idDe = (v: string | { id: string } | null | undefined): string | null =>
  !v ? null : typeof v === "string" ? v : v.id;

/**
 * Previent la cliente qu'elle a ete creditee.
 *
 * Un echec d'envoi ne doit JAMAIS faire echouer le webhook : le paiement est
 * encaisse, les seances sont creditees, et rejouer l'evenement ne changerait
 * rien a cela. L'erreur est journalisee dans email_log et le webhook rend 200.
 */
async function notifierAchat(
  base: Base,
  a: { userId: string; planId: string; orderId: string; montant: number; recurrent: boolean },
): Promise<void> {
  try {
    const [{ data: profil }, { data: formule }, { data: lot }] = await Promise.all([
      base.from("profiles").select("email, first_name").eq("id", a.userId)
        .maybeSingle<{ email: string; first_name: string }>(),
      base.from("plans").select("name, sessions_count").eq("id", a.planId)
        .maybeSingle<{ name: string; sessions_count: number }>(),
      base.from("credit_lots").select("quantity_remaining, expires_at").eq("order_id", a.orderId)
        .maybeSingle<{ quantity_remaining: number; expires_at: string }>(),
    ]);

    if (!profil || !formule || !lot) return;

    const { objet, contenu } = confirmationAchat({
      prenom: profil.first_name,
      formule: formule.name,
      seances: lot.quantity_remaining,
      expire: lot.expires_at,
      montantCents: a.montant,
      recurrent: a.recurrent,
    });

    await envoyer({
      modele: "purchase_confirmation",
      userId: a.userId,
      destinataire: profil.email,
      objet,
      contenu,
      liens: { order_id: a.orderId },
    });
  } catch (erreur) {
    console.error("confirmation d'achat non envoyée :", erreur);
  }
}

// ---------------------------------------------------------------------------
// checkout.session.completed — achat unique
// ---------------------------------------------------------------------------

export async function traiterSessionTerminee(session: Stripe.Checkout.Session): Promise<string> {
  // Les abonnements sont traites par invoice.paid, qui porte la periode et
  // arrive parfois AVANT cet evenement. Un seul chemin, pas deux qui se
  // marchent dessus.
  if (session.mode !== "payment") return "session d'abonnement ignorée, invoice.paid fait le travail";
  if (session.payment_status !== "paid") return "session non payée, rien à créditer";

  const base = clientService();
  const userId = session.metadata?.user_id ?? session.client_reference_id;
  const planId = session.metadata?.plan_id;
  if (!userId || !planId) return "métadonnées absentes, impossible de rattacher";

  const promoId = await promoLocal(
    base,
    idDe(session.discounts?.[0]?.promotion_code as string | { id: string } | null),
  );

  const { data: commande, error } = await base
    .from("orders")
    .insert({
      user_id: userId,
      plan_id: planId,
      kind: "purchase",
      status: "paid",
      amount_cents: session.amount_total ?? 0,
      discount_cents: session.total_details?.amount_discount ?? 0,
      currency: (session.currency ?? "eur").toUpperCase(),
      promo_code_id: promoId,
      stripe_checkout_session_id: session.id,
      stripe_payment_intent_id: idDe(session.payment_intent),
      paid_at: new Date().toISOString(),
    })
    .select("id")
    .single<{ id: string }>();

  // 23505 : la commande existe deja. Stripe rejoue, on ne recredite pas.
  if (error?.code === "23505") return "commande déjà enregistrée, rejeu ignoré";
  if (error || !commande) throw new Error(`commande non créée : ${error?.message}`);

  const { error: erreurCredit } = await base.rpc("credit_order", { p_order_id: commande.id });
  if (erreurCredit) throw new Error(`crédit refusé : ${erreurCredit.message}`);

  await notifierAchat(base, {
    userId, planId, orderId: commande.id,
    montant: session.amount_total ?? 0, recurrent: false,
  });

  return `commande ${commande.id} créditée`;
}

// ---------------------------------------------------------------------------
// invoice.paid — premier cycle et renouvellements
// ---------------------------------------------------------------------------

export async function traiterFacturePayee(facture: Stripe.Invoice): Promise<string> {
  const abonnementId = abonnementDeFacture(facture);
  if (!abonnementId) return "facture hors abonnement, ignorée";

  const base = clientService();
  const abo = await stripe().subscriptions.retrieve(abonnementId);

  // `facture.id` est optionnel dans les types depuis que les factures brouillon
  // existent. A ce stade elle est payee, donc elle en a un.
  const factureId = facture.id;
  if (!factureId) return "facture sans identifiant, ignorée";

  const userId =
    abo.metadata?.user_id ?? (await utilisatriceDuClient(base, idDe(abo.customer)));
  if (!userId) return "cliente introuvable pour cet abonnement";

  // La formule vient des metadonnees, avec le prix en repli : un prix archive
  // reste rattachable, et une formule renommee ne casse rien.
  let planId: string | null = abo.metadata?.plan_id ?? null;
  const prixId = idDe(abo.items.data[0]?.price as unknown as string | { id: string });
  if (!planId && prixId) {
    const { data } = await base
      .from("plans").select("id").eq("stripe_price_id", prixId).maybeSingle<{ id: string }>();
    planId = data?.id ?? null;
  }
  if (!planId) return "formule introuvable pour cet abonnement";

  const periode = periodeDe(abo);

  const { data: ligne, error: erreurAbo } = await base
    .from("subscriptions")
    .upsert(
      {
        user_id: userId,
        plan_id: planId,
        stripe_subscription_id: abo.id,
        status: abo.status,
        current_period_start: periode.debut,
        current_period_end: periode.fin,
        cancel_at_period_end: abo.cancel_at_period_end,
        latest_invoice_id: factureId,
      },
      { onConflict: "stripe_subscription_id" },
    )
    .select("id")
    .single<{ id: string }>();

  if (erreurAbo || !ligne) throw new Error(`abonnement non enregistré : ${erreurAbo?.message}`);

  const remise = (facture.total_discount_amounts ?? []).reduce((n, d) => n + d.amount, 0);

  const { data: commande, error } = await base
    .from("orders")
    .insert({
      user_id: userId,
      plan_id: planId,
      subscription_id: ligne.id,
      kind: "subscription_cycle",
      status: "paid",
      amount_cents: facture.amount_paid,
      discount_cents: remise,
      currency: (facture.currency ?? "eur").toUpperCase(),
      stripe_invoice_id: factureId,
      paid_at: new Date().toISOString(),
    })
    .select("id")
    .single<{ id: string }>();

  // C'est ICI que l'idempotence se joue vraiment : stripe_invoice_id est
  // unique, et un double invoice.paid crediterait deux fois un cycle.
  if (error?.code === "23505") return "cycle déjà crédité, rejeu ignoré";
  if (error || !commande) throw new Error(`commande non créée : ${error?.message}`);

  // credit_order applique la regle 2 : le reliquat du cycle precedent est
  // annule et trace, le solde repart a N. Il ne s'additionne pas.
  const { error: erreurCredit } = await base.rpc("credit_order", { p_order_id: commande.id });
  if (erreurCredit) throw new Error(`crédit refusé : ${erreurCredit.message}`);

  await notifierAchat(base, {
    userId, planId, orderId: commande.id,
    montant: facture.amount_paid, recurrent: true,
  });

  return `cycle ${commande.id} crédité, solde remis à neuf`;
}

// ---------------------------------------------------------------------------
// invoice.payment_failed — rien pendant les Smart Retries
// ---------------------------------------------------------------------------

export async function traiterEchecPaiement(facture: Stripe.Invoice): Promise<string> {
  const abonnementId = abonnementDeFacture(facture);
  if (!abonnementId) return "échec hors abonnement, ignoré";

  const base = clientService();
  const { data: ligne } = await base
    .from("subscriptions")
    .select("id")
    .eq("stripe_subscription_id", abonnementId)
    .maybeSingle<{ id: string }>();

  if (!ligne) return "abonnement inconnu, ignoré";

  // next_payment_attempt non nul = Stripe reessaiera tout seul. On note
  // l'echec pour que la cliente voie « paiement en attente », et RIEN de plus :
  // pas d'email, pas de retrait de seance. Le lot en cours vit jusqu'a son
  // expiration, c'est l'absence de nouveau lot qui fera effet.
  const definitif = facture.next_payment_attempt == null;

  const { data: doitNotifier, error } = await base.rpc("apply_subscription_payment_failed", {
    p_subscription_id: ligne.id,
    p_invoice_id: facture.id ?? "",
    p_is_final: definitif,
  });

  if (error) throw new Error(`échec non enregistré : ${error.message}`);

  if (doitNotifier === true) {
    // Vrai une SEULE fois, au passage a l'echec definitif. Les tentatives
    // suivantes ne repassent pas ici.
    const { data: details } = await base
      .from("subscriptions")
      .select("user_id, plan_id, current_period_end")
      .eq("id", ligne.id)
      .maybeSingle<{ user_id: string; plan_id: string; current_period_end: string | null }>();

    if (details) {
      const [{ data: profil }, { data: formule }] = await Promise.all([
        base.from("profiles").select("email, first_name").eq("id", details.user_id)
          .maybeSingle<{ email: string; first_name: string }>(),
        base.from("plans").select("name").eq("id", details.plan_id)
          .maybeSingle<{ name: string }>(),
      ]);

      if (profil) {
        const { objet, contenu } = paiementEchoue({
          prenom: profil.first_name,
          formule: formule?.name ?? "abonnement",
          finValidite: details.current_period_end,
        });
        await envoyer({
          modele: "payment_failed",
          userId: details.user_id,
          destinataire: profil.email,
          objet,
          contenu,
          liens: { subscription_id: ligne.id, stripe_invoice_id: facture.id ?? undefined },
        });
      }
    }
    return "échec définitif : cliente prévenue";
  }

  return definitif
    ? "échec définitif déjà connu, rien de plus"
    : "échec en cours de relance, aucun email";
}

// ---------------------------------------------------------------------------
// customer.subscription.deleted
// ---------------------------------------------------------------------------

export async function traiterAbonnementSupprime(abo: Stripe.Subscription): Promise<string> {
  const base = clientService();
  const { error } = await base
    .from("subscriptions")
    .update({
      status: "canceled",
      canceled_at: enISO(abo.canceled_at) ?? new Date().toISOString(),
      ended_at: enISO(abo.ended_at) ?? new Date().toISOString(),
      cancel_at_period_end: false,
    })
    .eq("stripe_subscription_id", abo.id);

  if (error) throw new Error(`fin d'abonnement non enregistrée : ${error.message}`);

  // Aucune seance n'est retiree : celles du cycle en cours restent valables
  // jusqu'a leur expiration. C'est ce que la cliente a paye.
  return "abonnement terminé, les séances du cycle en cours restent valables";
}

// ---------------------------------------------------------------------------
// charge.refunded
// ---------------------------------------------------------------------------

export async function traiterRemboursement(charge: Stripe.Charge): Promise<string> {
  const base = clientService();
  const paymentIntent = idDe(charge.payment_intent);
  if (!paymentIntent) return "remboursement sans paiement rattachable";

  const { data: commande } = await base
    .from("orders")
    .select("id, amount_cents")
    .eq("stripe_payment_intent_id", paymentIntent)
    .maybeSingle<{ id: string; amount_cents: number }>();

  if (!commande) return "commande introuvable pour ce remboursement";

  const total = charge.amount_refunded >= commande.amount_cents;

  const { error } = await base
    .from("orders")
    .update({
      status: total ? "refunded" : "partially_refunded",
      refunded_amount_cents: Math.min(charge.amount_refunded, commande.amount_cents),
      refunded_at: new Date().toISOString(),
      stripe_charge_id: charge.id,
    })
    .eq("id", commande.id);

  if (error) throw new Error(`remboursement non enregistré : ${error.message}`);

  // Remboursement PARTIEL : rien n'est revoque automatiquement. Oriane
  // arbitre avec admin_revoke_credits — la moitie d'un pack n'a pas de
  // traduction evidente en nombre de seances.
  if (!total) return "remboursement partiel enregistré, aucune séance révoquée";

  const { data: revoquees, error: erreurRevoc } = await base.rpc("revoke_order_credits", {
    p_order_id: commande.id,
    p_reason: "Remboursement Stripe",
  });

  if (erreurRevoc) throw new Error(`révocation refusée : ${erreurRevoc.message}`);

  return `remboursement total, ${revoquees ?? 0} séance(s) révoquée(s)`;
}
