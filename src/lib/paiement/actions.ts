"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";
import { profilCourant, type Profil } from "@/lib/auth/session";
import { clientServeur } from "@/lib/supabase/server";
import { clientService } from "@/lib/supabase/service";
import { stripe } from "@/lib/stripe/client";
import { urlDuSite } from "@/lib/site";
import { detailTechnique } from "@/lib/erreur-technique";
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

async function formuleParSlug(slug: string): Promise<Formule | null> {
  const supabase = await clientServeur();
  const { data } = await supabase
    .from("plans")
    .select(COLONNES_FORMULE)
    .eq("slug", slug)
    .maybeSingle<Formule>();
  return data;
}

/**
 * Le texte affiche au-dessus du bouton de paiement, chez Stripe.
 *
 * C'est la derniere page ou l'on peut encore dire les choses avant que
 * l'argent parte — la dire ici vaut mieux que de l'expliquer apres coup.
 */
function aSavoir(formule: Formule): string {
  const texte =
    formule.kind === "subscription"
      ? `Prélèvement toutes les 4 semaines. À chaque fois ton solde repart à ${formule.sessions_count} séances : ce qui reste du cycle précédent n'est pas ajouté. Tu peux résilier quand tu veux depuis ton compte, tu gardes tes séances jusqu'à la fin de la période payée. Annulation d'un cours jusqu'à ${formule.cancellation_deadline_hours} h avant.`
      : `${formule.sessions_count} séance${formule.sessions_count > 1 ? "s" : ""} valable${formule.sessions_count > 1 ? "s" : ""} ${validiteLisible(formule.validity_interval)} à partir d'aujourd'hui. Passé cette date, celles que tu n'as pas utilisées sont perdues, sans report. Annulation d'un cours jusqu'à ${formule.cancellation_deadline_hours} h avant.`;
  return texte.slice(0, 1200);
}

/**
 * Tout ce qui parle a Stripe, isole pour que l'appelant puisse rattraper.
 *
 * Rend l'URL de paiement, ou leve. Aucun `redirect()` ici : `redirect()`
 * fonctionne en levant une erreur interne a Next, et un `catch` qui l'avalerait
 * transformerait une redirection en panne.
 */
async function urlDePaiement(
  profil: Profil,
  formule: Formule,
): Promise<{ url: string; clientACreer: string | null }> {
  const sdk = stripe();
  const abonnement = formule.kind === "subscription";

  // Le client Stripe est cree une fois et reutilise : c'est lui qui porte
  // l'historique de paiement et donne acces au portail.
  const clientStripe = profil.stripe_customer_id ?? (await sdk.customers.create({
    email: profil.email,
    name: `${profil.first_name} ${profil.last_name}`,
    phone: profil.phone ?? undefined,
    metadata: { user_id: profil.id },
  })).id;

  const session = await sdk.checkout.sessions.create({
    mode: abonnement ? "subscription" : "payment",
    customer: clientStripe,
    line_items: [{ price: formule.stripe_price_id!, quantity: 1 }],
    allow_promotion_codes: true,
    locale: "fr",
    custom_text: { submit: { message: aSavoir(formule) } },
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

  if (!session.url) throw new Error("Stripe n'a pas rendu d'URL de paiement.");

  return {
    url: session.url,
    clientACreer: profil.stripe_customer_id ? null : clientStripe,
  };
}

/**
 * Ouvre Stripe Checkout pour une formule.
 *
 * Le mode depend du type : `subscription` pour un abonnement, `payment` pour
 * une seance a la carte ou un pack. C'est le seul aiguillage — le prix, lui,
 * porte deja sa recurrence, posee a la creation de la formule en week/4.
 *
 * CE CHEMIN EST CRITIQUE ET DOIT RESTER COURT. Il s'execute pendant que la
 * cliente attend, requete POST ouverte. Sur un reseau mobile fragile, chaque
 * aller-retour supplementaire elargit la fenetre pendant laquelle la connexion
 * peut tomber — et une connexion qui tombe affiche la page « Quelque chose
 * s'est casse », alors que rien n'est casse. D'ou :
 *   * les deux lectures en parallele, elles ne dependent pas l'une de l'autre ;
 *   * l'ecriture de stripe_customer_id renvoyee APRES la reponse, par after() ;
 *   * un echec Stripe qui redirige avec une phrase, au lieu de laisser
 *     l'exception produire la page de panne.
 */
export async function demarrerPaiement(donnees: FormData): Promise<void> {
  const slug = texte(donnees, "slug");

  // Independantes : la formule ne depend pas du profil. En serie, c'etait un
  // aller-retour de plus a attendre.
  const [profil, formule] = await Promise.all([profilCourant(), formuleParSlug(slug)]);

  if (!profil) {
    // Elle revient sur sa formule apres connexion : le panier n'existe pas,
    // un clic de plus est plus honnete qu'un etat garde en session.
    redirect(`/connexion?suite=${encodeURIComponent("/compte/formule")}`);
  }
  if (!formule) versFormule("Cette formule n'existe pas.");
  if (!estAchetable(formule)) {
    versFormule("Cette formule n'est pas disponible à l'achat pour l'instant.");
  }

  let paiement: { url: string; clientACreer: string | null };
  try {
    paiement = await urlDePaiement(profil, formule);
  } catch (erreur) {
    versFormule(
      "Le paiement n'a pas pu démarrer. Rien ne t'a été débité, tu peux réessayer. " +
        detailTechnique("checkout", erreur as { code?: string; message?: string }),
    );
  }

  // Hors du chemin critique : la cliente est deja partie chez Stripe. Sans cet
  // identifiant, elle aurait un second client Stripe au prochain achat et le
  // portail ne la retrouverait pas — mais rien de cela ne justifie de la faire
  // patienter un aller-retour de plus maintenant.
  if (paiement.clientACreer) {
    const clientStripe = paiement.clientACreer;
    const utilisatrice = profil.id;
    after(async () => {
      const { error } = await clientService()
        .from("profiles")
        .update({ stripe_customer_id: clientStripe })
        .eq("id", utilisatrice);
      if (error) {
        console.error("[checkout] stripe_customer_id non enregistré", utilisatrice, clientStripe, error.message);
      }
    });
  }

  redirect(paiement.url);
}
