"use server";

import { redirect } from "next/navigation";
import { profilCourant } from "@/lib/auth/session";
import { clientServeur } from "@/lib/supabase/server";
import { clientService } from "@/lib/supabase/service";
import { stripe } from "@/lib/stripe/client";
import { urlDuSite } from "@/lib/site";
import { COLONNES_FORMULE, type Formule } from "@/lib/formules/types";
import { validiteLisible } from "@/lib/formules/format";
import { estAchetable } from "@/lib/formules/types";

function texte(d: FormData, champ: string): string {
  const v = d.get(champ);
  return typeof v === "string" ? v.trim() : "";
}

function versFormule(message: string): never {
  redirect(`/compte/formule?message=${encodeURIComponent(message)}&ton=erreur`);
}

/**
 * Ouvre Stripe Checkout pour une formule.
 *
 * Le mode depend du type : `subscription` pour un abonnement, `payment` pour
 * une seance a la carte ou un pack. C'est le seul aiguillage — le prix, lui,
 * porte deja sa recurrence, posee a la creation de la formule en week/4.
 */
export async function demarrerPaiement(donnees: FormData): Promise<void> {
  const slug = texte(donnees, "slug");

  const profil = await profilCourant();
  if (!profil) {
    // Elle revient sur sa formule apres connexion : le panier n'existe pas,
    // un clic de plus est plus honnete qu'un etat garde en session.
    redirect(`/connexion?suite=${encodeURIComponent("/compte/formule")}`);
  }

  const supabase = await clientServeur();
  const { data: formule } = await supabase
    .from("plans")
    .select(COLONNES_FORMULE)
    .eq("slug", slug)
    .maybeSingle<Formule>();

  if (!formule) versFormule("Cette formule n'existe pas.");
  if (!estAchetable(formule)) {
    versFormule("Cette formule n'est pas disponible à l'achat pour l'instant.");
  }

  const sdk = stripe();

  // Le client Stripe est cree une fois et reutilise : c'est lui qui porte
  // l'historique de paiement et donne acces au portail. profiles.stripe_customer_id
  // n'est pas accessible en ecriture a `authenticated`, d'ou le passage par
  // service_role, cote serveur uniquement.
  let clientStripe = profil.stripe_customer_id;
  if (!clientStripe) {
    const cree = await sdk.customers.create({
      email: profil.email,
      name: `${profil.first_name} ${profil.last_name}`,
      phone: profil.phone ?? undefined,
      metadata: { user_id: profil.id },
    });
    clientStripe = cree.id;

    const { error } = await clientService()
      .from("profiles")
      .update({ stripe_customer_id: clientStripe })
      .eq("id", profil.id);

    if (error) {
      // Sans cet identifiant en base, le webhook ne saurait pas a qui
      // rattacher le paiement. On s'arrete avant de prendre l'argent.
      versFormule("Le paiement n'a pas pu démarrer. Réessaie dans un instant.");
    }
  }

  const abonnement = formule.kind === "subscription";

  // La regle qui fera reagir la cliente le jour ou elle s'applique, affichee
  // au-dessus du bouton de paiement. Stripe Checkout est la derniere page ou
  // l'on peut encore dire les choses avant que l'argent parte — la dire ici
  // vaut mieux que de l'expliquer apres coup.
  const aSavoir = abonnement
    ? `Prélèvement toutes les 4 semaines. À chaque fois ton solde repart à ${formule.sessions_count} séances : ce qui reste du cycle précédent n'est pas ajouté. Tu peux résilier quand tu veux depuis ton compte, tu gardes tes séances jusqu'à la fin de la période payée. Annulation d'un cours jusqu'à ${formule.cancellation_deadline_hours} h avant.`
    : `${formule.sessions_count} séance${formule.sessions_count > 1 ? "s" : ""} valable${formule.sessions_count > 1 ? "s" : ""} ${validiteLisible(formule.validity_interval)} à partir d'aujourd'hui. Passé cette date, celles que tu n'as pas utilisées sont perdues, sans report. Annulation d'un cours jusqu'à ${formule.cancellation_deadline_hours} h avant.`;

  const session = await sdk.checkout.sessions.create({
    mode: abonnement ? "subscription" : "payment",
    customer: clientStripe,
    line_items: [{ price: formule.stripe_price_id!, quantity: 1 }],
    allow_promotion_codes: true,
    locale: "fr",
    custom_text: { submit: { message: aSavoir.slice(0, 1200) } },
    client_reference_id: profil.id,
    success_url: `${urlDuSite()}/compte/merci?session={CHECKOUT_SESSION_ID}`,
    cancel_url: `${urlDuSite()}/compte/formule?message=${encodeURIComponent("Paiement abandonné. Rien ne t'a été débité.")}&ton=erreur`,
    // Ces metadonnees sont ce que le webhook lira : elles evitent de deviner
    // la formule a partir du prix, et survivent a un archivage de celui-ci.
    metadata: { user_id: profil.id, plan_id: formule.id, plan_slug: formule.slug },
    ...(abonnement
      ? { subscription_data: { metadata: { user_id: profil.id, plan_id: formule.id } } }
      : { payment_intent_data: { metadata: { user_id: profil.id, plan_id: formule.id } } }),
  });

  if (!session.url) versFormule("Le paiement n'a pas pu démarrer. Réessaie dans un instant.");
  redirect(session.url);
}
