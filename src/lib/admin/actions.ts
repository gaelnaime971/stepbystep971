"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { profilCourant } from "@/lib/auth/session";
import { clientServeur } from "@/lib/supabase/server";
import { eurosEnCentimes, prixLisible } from "@/lib/formules/format";
import { enDateAnnee } from "@/lib/dates";
import { stripe } from "@/lib/stripe/client";
import { envoyer } from "@/lib/emails/envoyer";
import { remboursementEffectue } from "@/lib/emails/modeles";
import { paymentIntentDeLaCommande, RemboursementImpossible } from "./remboursement";
import {
  creerCodePromo, desactiverCodePromo, messagePromoStripe, reactiverCodePromo,
} from "@/lib/promo/stripe";
import { detailTechnique } from "@/lib/erreur-technique";
import type { EtatAdmin } from "./etat";

function texte(d: FormData, champ: string): string {
  const v = d.get(champ);
  return typeof v === "string" ? v.trim() : "";
}
function coche(d: FormData, champ: string): boolean {
  return d.get(champ) === "on" || d.get(champ) === "true";
}

async function exigerAdmin(): Promise<void> {
  const profil = await profilCourant();
  if (!profil || profil.role !== "admin") redirect("/connexion?suite=/admin");
}

function retour(chemin: string, message: string, ton: "succes" | "erreur"): never {
  revalidatePath("/admin", "layout");
  redirect(`${chemin}?message=${encodeURIComponent(message)}&ton=${ton}`);
}

/**
 * Traduit un refus de RPC.
 *
 * Les RPC de 0005 levent des messages francais mais ecrits sans accents,
 * comme tout le SQL du projet. Le SQLSTATE route, l'application ecrit.
 */
type Base = Awaited<ReturnType<typeof clientServeur>>;

/**
 * Les inscriptions a venir financees par ces lots, la plus LOINTAINE d'abord.
 *
 * L'ordre est le geste : quand il faut en annuler une partie, on prend par le
 * bout le plus eloigne. Une cliente inscrite demain s'est organisee autour de
 * ce cours ; celle qui l'est dans trois semaines a le temps de replacer.
 */
async function inscriptionsAVenir(
  base: Base,
  idsLots: string[],
): Promise<{ bookingId: string; debut: string; fin: string; lieu: string }[]> {
  if (idsLots.length === 0) return [];

  const { data: resa } = await base
    .from("bookings")
    .select("id, course_id")
    .in("credit_lot_id", idsLots)
    .eq("status", "booked")
    .returns<{ id: string; course_id: string }[]>();

  if (!resa || resa.length === 0) return [];

  const { data: cours } = await base
    .from("courses")
    .select("id, starts_at, ends_at, location_id, status")
    .in("id", [...new Set(resa.map((r) => r.course_id))])
    .eq("status", "scheduled")
    .gt("starts_at", new Date().toISOString())
    .returns<{ id: string; starts_at: string; ends_at: string; location_id: string; status: string }[]>();

  const { data: lieux } = await base.from("locations").select("id, name")
    .returns<{ id: string; name: string }[]>();
  const nomLieu = new Map((lieux ?? []).map((l) => [l.id, l.name]));
  const parId = new Map((cours ?? []).map((c) => [c.id, c]));

  return resa
    .map((r) => ({ r, c: parId.get(r.course_id) }))
    .filter((x): x is { r: { id: string; course_id: string }; c: NonNullable<ReturnType<typeof parId.get>> } => !!x.c)
    .map((x) => ({
      bookingId: x.r.id,
      debut: x.c.starts_at,
      fin: x.c.ends_at,
      lieu: nomLieu.get(x.c.location_id) ?? "—",
    }))
    .sort((u, v) => v.debut.localeCompare(u.debut));
}

/**
 * Previent la cliente. Un echec d'envoi ne fait JAMAIS echouer l'appelant :
 * l'argent est parti, les seances sont retirees, rejouer ne changerait rien a
 * cela. L'erreur se lit dans email_log.
 */
async function previenirDuRemboursement(a: {
  userId: string;
  orderId: string;
  planId: string;
  montant: number;
  total: boolean;
  seancesRetirees: number;
  coursAnnules: { debut: string; fin: string; lieu: string }[];
}): Promise<void> {
  try {
    const base = await clientServeur();
    const [{ data: profil }, { data: formule }] = await Promise.all([
      base.from("profiles").select("email, first_name").eq("id", a.userId)
        .maybeSingle<{ email: string; first_name: string }>(),
      base.from("plans").select("name").eq("id", a.planId)
        .maybeSingle<{ name: string }>(),
    ]);
    if (!profil) return;

    const { objet, contenu } = remboursementEffectue({
      prenom: profil.first_name,
      formule: formule?.name ?? "Ton achat",
      montantCents: a.montant,
      total: a.total,
      seancesRetirees: a.seancesRetirees,
      coursAnnules: a.coursAnnules,
    });

    await envoyer({
      modele: "refund_processed",
      userId: a.userId,
      destinataire: profil.email,
      objet,
      contenu,
      liens: { order_id: a.orderId },
      reessayable: false,
    });
  } catch (erreur) {
    console.error("[remboursement] email non envoyé", erreur);
  }
}

function messageRpc(code: string | undefined, defaut: string): string {
  switch (code) {
    case "SB009": return "Cette action est réservée à l'administratrice.";
    case "SB008": return "Cet élément n'existe plus. Recharge la page.";
    case "SB010": return "Le nombre de séances ou le motif ne convient pas.";
    default: return defaut;
  }
}

// ---------------------------------------------------------------------------
// Solde d'une cliente
// ---------------------------------------------------------------------------

export async function crediterSeances(
  _precedent: EtatAdmin,
  donnees: FormData,
): Promise<EtatAdmin> {
  await exigerAdmin();
  const clienteId = texte(donnees, "clienteId");
  const nombre = Number(texte(donnees, "nombre"));
  const expire = texte(donnees, "expire");
  const motif = texte(donnees, "motif");
  const valeurs = { nombre: String(nombre || ""), expire, motif };

  if (!Number.isInteger(nombre) || nombre < 1) {
    return { erreur: "Indique un nombre de séances supérieur à zéro.", valeurs };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(expire)) {
    return { erreur: "Choisis une date de fin de validité.", valeurs };
  }
  if (!motif) {
    return {
      erreur: "Le motif est obligatoire.",
      detail: "La base le refuse sans, et pour une bonne raison : un geste de rattrapage sans motif est introuvable six mois plus tard.",
      valeurs,
    };
  }

  const supabase = await clientServeur();
  const { error } = await supabase.rpc("admin_grant_credits", {
    p_user_id: clienteId,
    p_quantity: nombre,
    // Fin de journee en Guadeloupe : la cliente garde la journee entiere.
    p_expires_at: new Date(`${expire}T23:59:00-04:00`).toISOString(),
    p_reason: motif,
  });

  if (error) {
    return { erreur: messageRpc(error.code, "Les séances n'ont pas pu être ajoutées."), valeurs };
  }

  retour(
    `/admin/clientes/${clienteId}`,
    `${nombre} séance${nombre > 1 ? "s" : ""} ajoutée${nombre > 1 ? "s" : ""}.`,
    "succes",
  );
}

export async function retirerSeances(
  _precedent: EtatAdmin,
  donnees: FormData,
): Promise<EtatAdmin> {
  await exigerAdmin();
  const clienteId = texte(donnees, "clienteId");
  const lotId = texte(donnees, "lotId");
  const nombre = Number(texte(donnees, "nombre"));
  const motif = texte(donnees, "motif");
  const valeurs = { nombre: String(nombre || ""), motif, lotId };

  if (!Number.isInteger(nombre) || nombre < 1) {
    return { erreur: "Indique un nombre de séances supérieur à zéro.", valeurs };
  }
  if (!motif) return { erreur: "Le motif est obligatoire.", valeurs };

  const supabase = await clientServeur();

  // Un lot designe : c'est le cas courant, corriger un credit qu'on vient de
  // poser. Sans lot, on retire par l'echeance la plus lointaine.
  const { error } = lotId
    ? await supabase.rpc("admin_revoke_credits_from_lot", {
        p_credit_lot_id: lotId, p_quantity: nombre, p_reason: motif })
    : await supabase.rpc("admin_revoke_credits", {
        p_user_id: clienteId, p_quantity: nombre, p_reason: motif });

  if (error) {
    return {
      erreur: messageRpc(error.code, "Les séances n'ont pas pu être retirées."),
      detail: error.code === "SB010" ? "Vérifie que le lot contient bien ce nombre de séances." : undefined,
      valeurs,
    };
  }

  retour(
    `/admin/clientes/${clienteId}`,
    `${nombre} séance${nombre > 1 ? "s" : ""} retirée${nombre > 1 ? "s" : ""}.`,
    "succes",
  );
}

export async function desinscrireDepuisFiche(donnees: FormData): Promise<void> {
  await exigerAdmin();
  const clienteId = texte(donnees, "clienteId");
  const supabase = await clientServeur();
  const { error } = await supabase.rpc("admin_unbook", {
    p_booking_id: texte(donnees, "reservationId"),
    p_refund: coche(donnees, "recrediter"),
    p_note: "Désinscrite par Oriane depuis la fiche cliente",
  });

  if (error) {
    retour(`/admin/clientes/${clienteId}`, messageRpc(error.code, "La désinscription a échoué."), "erreur");
  }
  retour(`/admin/clientes/${clienteId}`, "Désinscrite.", "succes");
}

// ---------------------------------------------------------------------------
// Notes privees et RGPD
// ---------------------------------------------------------------------------

export async function enregistrerNotes(donnees: FormData): Promise<void> {
  await exigerAdmin();
  const clienteId = texte(donnees, "clienteId");
  const supabase = await clientServeur();
  const { error } = await supabase.rpc("admin_set_client_notes", {
    p_user_id: clienteId,
    p_notes: texte(donnees, "notes") || null,
  });

  if (error) {
    retour(`/admin/clientes/${clienteId}`, messageRpc(error.code, "Les notes n'ont pas été enregistrées."), "erreur");
  }
  retour(`/admin/clientes/${clienteId}`, "Notes enregistrées.", "succes");
}

export async function anonymiser(donnees: FormData): Promise<void> {
  await exigerAdmin();
  const clienteId = texte(donnees, "clienteId");
  if (texte(donnees, "confirmation").toUpperCase() !== "ANONYMISER") {
    retour(
      `/admin/clientes/${clienteId}`,
      "Rien n'a été fait : il faut écrire ANONYMISER pour confirmer.",
      "erreur",
    );
  }

  const supabase = await clientServeur();
  const { error } = await supabase.rpc("anonymize_profile", { p_user_id: clienteId });

  if (error) {
    retour(`/admin/clientes/${clienteId}`, messageRpc(error.code, "L'anonymisation a échoué."), "erreur");
  }

  retour(
    "/admin/clientes",
    "Compte anonymisé. Ses achats sont conservés sans son nom, comme l'exige la comptabilité.",
    "succes",
  );
}

// ---------------------------------------------------------------------------
// Codes promo
// ---------------------------------------------------------------------------

export async function creerPromo(
  _precedent: EtatAdmin,
  donnees: FormData,
): Promise<EtatAdmin> {
  await exigerAdmin();

  const code = texte(donnees, "code").toUpperCase();
  const description = texte(donnees, "description");
  const type = texte(donnees, "type");
  const valeur = texte(donnees, "valeur");
  const duree = texte(donnees, "duree") as "once" | "repeating" | "forever";
  const mois = Number(texte(donnees, "mois"));
  const maxi = texte(donnees, "maxi");
  const expire = texte(donnees, "expire");
  const formules = donnees.getAll("formules").filter((v): v is string => typeof v === "string");

  const valeurs = { code, description, type, valeur, duree, mois: String(mois || ""), maxi, expire };
  const echec = (erreur: string, detail?: string) => ({ erreur, detail, valeurs });

  if (!/^[A-Z0-9_-]{3,40}$/.test(code)) {
    return echec(
      "Le code doit faire 3 à 40 caractères, en lettres, chiffres, tiret ou souligné.",
      "Sans espace ni accent : c'est ce que la cliente tapera au moment de payer.",
    );
  }

  let remise;
  if (type === "percent") {
    const p = Number(valeur.replace(",", "."));
    if (!Number.isFinite(p) || p <= 0 || p > 100) {
      return echec("Le pourcentage doit être compris entre 1 et 100.");
    }
    remise = { type: "percent" as const, pourcentage: p };
  } else {
    const c = eurosEnCentimes(valeur);
    if (c === null || c < 1) return echec("Le montant n'est pas valide. Écris-le en euros, par exemple 10 ou 7,50.");
    remise = { type: "amount" as const, centimes: c };
  }

  if (duree === "repeating" && (!Number.isInteger(mois) || mois < 1)) {
    return echec("Indique sur combien de mois la remise s'applique.");
  }

  const supabase = await clientServeur();

  const { data: deja } = await supabase
    .from("promo_codes").select("id").eq("code", code).maybeSingle<{ id: string }>();
  if (deja) return echec(`Le code « ${code} » existe déjà.`, "Choisis un autre code, ou réactive celui qui existe.");

  // Les formules choisies donnent les PRODUITS Stripe : c'est Stripe qui
  // refusera le code sur une formule non concernee, au moment du paiement.
  const { data: plans } = formules.length
    ? await supabase.from("plans").select("id, stripe_product_id").in("id", formules)
        .returns<{ id: string; stripe_product_id: string | null }[]>()
    : { data: [] };

  const produits = (plans ?? []).map((p) => p.stripe_product_id).filter((x): x is string => !!x);
  if (formules.length && produits.length !== formules.length) {
    return echec(
      "Une des formules choisies n'est pas encore publiée sur Stripe.",
      "Publie-la depuis « Formules et tarifs », puis reviens créer le code.",
    );
  }

  let refs;
  try {
    refs = await creerCodePromo({
      code, remise, duree,
      dureeEnMois: duree === "repeating" ? mois : null,
      utilisationsMax: maxi ? Number(maxi) : null,
      expireLe: expire ? new Date(`${expire}T23:59:00-04:00`).toISOString() : null,
      produitsAutorises: produits,
    });
  } catch (erreur) {
    return echec(messagePromoStripe(erreur), "Aucun code n'a été créé.");
  }

  const { error } = await supabase.rpc("admin_mirror_promo_code", {
    p_code: code,
    p_description: description || null,
    p_stripe_coupon_id: refs.couponId,
    p_stripe_promotion_code_id: refs.promotionCodeId,
    p_discount_type: remise.type,
    p_percent_off: remise.type === "percent" ? remise.pourcentage : null,
    p_amount_off_cents: remise.type === "amount" ? remise.centimes : null,
    p_currency: remise.type === "amount" ? "EUR" : null,
    p_duration: duree,
    p_duration_in_months: duree === "repeating" ? mois : null,
    p_max_redemptions: maxi ? Number(maxi) : null,
    p_restricted_plan_ids: formules.length ? formules : null,
    p_expires_at: expire ? new Date(`${expire}T23:59:00-04:00`).toISOString() : null,
  });

  if (error) {
    // Stripe a reussi, la base a echoue : on desactive le code cree pour ne
    // pas laisser courir une remise qu'aucun ecran ne montre.
    await desactiverCodePromo(refs.promotionCodeId).catch(() => {});
    return echec(
      "Le code n'a pas pu être enregistré.",
      `Le code créé chez Stripe a été désactivé, rien ne traîne. ${detailTechnique("promo", error)}`,
    );
  }

  retour("/admin/promos", `Le code « ${code} » est actif.`, "succes");
}

export async function basculerPromo(donnees: FormData): Promise<void> {
  await exigerAdmin();
  const id = texte(donnees, "id");

  const supabase = await clientServeur();
  const { data: promo } = await supabase
    .from("promo_codes")
    .select("code, is_active, stripe_promotion_code_id")
    .eq("id", id)
    .maybeSingle<{ code: string; is_active: boolean; stripe_promotion_code_id: string | null }>();

  if (!promo) retour("/admin/promos", "Ce code n'existe plus. Recharge la page.", "erreur");

  const actif = !promo.is_active;

  if (promo.stripe_promotion_code_id) {
    try {
      if (actif) await reactiverCodePromo(promo.stripe_promotion_code_id);
      else await desactiverCodePromo(promo.stripe_promotion_code_id);
    } catch (erreur) {
      // Stripe d'abord ici : c'est LUI qui accepte ou refuse le code au
      // paiement. Le desactiver en base sans le desactiver chez Stripe
      // laisserait la remise passer.
      retour("/admin/promos", messagePromoStripe(erreur), "erreur");
    }
  }

  const { error } = await supabase.from("promo_codes").update({ is_active: actif }).eq("id", id);
  if (error) retour("/admin/promos", "Le code n'a pas pu être modifié.", "erreur");

  retour(
    "/admin/promos",
    actif
      ? `Le code « ${promo.code} » est de nouveau utilisable.`
      : `Le code « ${promo.code} » ne fonctionne plus.`,
    "succes",
  );
}

// ---------------------------------------------------------------------------
// Parametres
// ---------------------------------------------------------------------------

export async function modifierMesInfos(donnees: FormData): Promise<void> {
  await exigerAdmin();
  const prenom = texte(donnees, "prenom");
  const nom = texte(donnees, "nom");
  const telephone = texte(donnees, "telephone");

  if (!prenom || !nom) {
    retour("/admin/parametres", "Ton prénom et ton nom sont nécessaires.", "erreur");
  }

  const profil = await profilCourant();
  const supabase = await clientServeur();
  // Trois colonnes seulement : c'est tout ce que `authenticated` a le droit
  // d'ecrire sur profiles, role compris.
  const { error } = await supabase
    .from("profiles")
    .update({ first_name: prenom, last_name: nom, phone: telephone || null })
    .eq("id", profil!.id);

  if (error) retour("/admin/parametres", "Tes informations n'ont pas été enregistrées.", "erreur");
  retour("/admin/parametres", "C'est enregistré.", "succes");
}

/**
 * Les delais d'annulation, formule par formule.
 *
 * Regle 6 : ce delai est un parametre PAR FORMULE, jamais une constante. Il est
 * modifiable ici et sur chaque fiche formule — les deux ecrivent la meme
 * colonne, et le trigger d'immuabilite ne la protege pas : changer un delai
 * n'est pas changer un prix.
 */
export async function modifierDelais(donnees: FormData): Promise<void> {
  await exigerAdmin();
  const supabase = await clientServeur();

  const { data: formules } = await supabase
    .from("plans").select("id, name").eq("is_active", true)
    .returns<{ id: string; name: string }[]>();

  for (const f of formules ?? []) {
    const brut = texte(donnees, `delai_${f.id}`);
    if (!brut) continue;
    const heures = Number(brut);
    if (!Number.isInteger(heures) || heures < 0) {
      retour("/admin/parametres", `Le délai de « ${f.name} » doit être un nombre d'heures positif.`, "erreur");
    }
    const { error } = await supabase
      .from("plans").update({ cancellation_deadline_hours: heures }).eq("id", f.id);
    if (error) {
      retour("/admin/parametres", `Le délai de « ${f.name} » n'a pas pu être enregistré.`, "erreur");
    }
  }

  retour("/admin/parametres", "Les délais d'annulation sont à jour.", "succes");
}

// ---------------------------------------------------------------------------
// Remboursement d'un achat
// ---------------------------------------------------------------------------

/**
 * Rembourse un achat, total ou partiel, depuis la fiche cliente.
 *
 * L'ORDRE EST LE SUJET. Stripe d'abord, la base ensuite — et c'est un choix,
 * pas une commodite. Un remboursement ne s'annule pas : il n'y a donc aucune
 * compensation possible, seulement le sens dans lequel on accepte d'echouer.
 *
 *   base d'abord, Stripe echoue  → elle perd ses seances ET son argent.
 *   Stripe d'abord, base echoue  → l'argent est rendu, elle garde ses seances.
 *
 * Le second laisse la cliente avantagee et Oriane avec un rattrapage a faire,
 * avec des outils qui existent. Le premier la lese, sans recours.
 *
 * QUI FAIT QUOI. Cette action ne touche pas a `orders` : le webhook
 * `charge.refunded` s'en charge, et sur un remboursement TOTAL c'est lui aussi
 * qui revoque le lot via `revoke_order_credits`. On ne double pas son travail,
 * on couvre ce qu'il laisse : la revocation partielle, qu'il refuse
 * deliberement de deduire d'un montant, et la desinscription des cours a venir.
 */
export async function rembourser(donnees: FormData): Promise<void> {
  await exigerAdmin();

  const achatId = texte(donnees, "achatId");
  const clienteId = texte(donnees, "clienteId");
  const motif = texte(donnees, "motif");
  const montant = eurosEnCentimes(texte(donnees, "montant"));
  const seancesSaisies = Math.max(0, Math.trunc(Number(texte(donnees, "seances")) || 0));
  const fiche = `/admin/clientes/${clienteId}`;

  if (!motif) retour(fiche, "Indique un motif : un remboursement sans motif n'est pas tracé.", "erreur");
  if (montant === null || montant <= 0) {
    retour(fiche, "Le montant n'est pas valide. Écris-le en euros, par exemple 24,50.", "erreur");
  }

  const supabase = await clientServeur();
  const { data: commande } = await supabase
    .from("orders")
    .select("id, user_id, status, amount_cents, refunded_amount_cents, stripe_payment_intent_id, stripe_invoice_id, plan_id")
    .eq("id", achatId)
    .maybeSingle<{
      id: string; user_id: string; status: string; amount_cents: number;
      refunded_amount_cents: number; stripe_payment_intent_id: string | null;
      stripe_invoice_id: string | null; plan_id: string;
    }>();

  if (!commande) retour(fiche, "Cet achat n'existe plus. Recharge la page.", "erreur");
  if (commande.user_id !== clienteId) {
    retour(fiche, "Cet achat n'appartient pas à cette cliente. Recharge la page.", "erreur");
  }
  if (commande.status === "refunded") {
    retour(fiche, "Cet achat est déjà remboursé en totalité.", "erreur");
  }
  if (commande.status !== "paid" && commande.status !== "partially_refunded") {
    retour(fiche, "Cet achat n'a pas été payé : il n'y a rien à rembourser.", "erreur");
  }

  const restant = commande.amount_cents - commande.refunded_amount_cents;
  if (montant > restant) {
    retour(fiche, `Tu ne peux pas rendre plus que ${prixLisible(restant)} sur cet achat.`, "erreur");
  }
  const total = montant === restant;

  // --- L'etat des seances, relu maintenant. L'affichage etait un apercu ; ici
  // --- c'est la source de verite, et la page a pu vieillir dans l'intervalle.
  const { data: lots } = await supabase
    .from("credit_lots")
    .select("id, quantity_remaining, closed_at")
    .eq("order_id", commande.id)
    .returns<{ id: string; quantity_remaining: number; closed_at: string | null }[]>();

  const lotsOuverts = (lots ?? []).filter((l) => !l.closed_at);
  const soldeRevocable = lotsOuverts.reduce((n, l) => n + l.quantity_remaining, 0);
  const coursAVenir = await inscriptionsAVenir(supabase, (lots ?? []).map((l) => l.id));

  // --- 1. STRIPE. Rien n'est ecrit avant que l'argent soit parti. -----------
  //
  // La resolution du paiement est SEPAREE de l'appel de remboursement. Ses
  // refus ne sont pas des pannes — une facture a 0 EUR n'a rien a rendre — et
  // les confondre ferait dire « Stripe a refuse » la ou il n'y a rien a
  // demander.
  let paymentIntent: string;
  try {
    paymentIntent = await paymentIntentDeLaCommande(commande);
  } catch (erreur) {
    retour(
      fiche,
      erreur instanceof RemboursementImpossible
        ? erreur.messageOriane
        : "Le paiement de cet achat n'a pas pu être retrouvé chez Stripe. Rien n'a bougé. " +
          detailTechnique("remboursement", erreur as { code?: string; message?: string }),
      "erreur",
    );
  }

  let remboursement: { id: string };
  try {
    remboursement = await stripe().refunds.create(
      { payment_intent: paymentIntent, amount: montant, metadata: { order_id: commande.id } },
      // Un double clic sur un bouton qui rend de l'argent rendrait l'argent
      // deux fois. La cle couvre la commande ET le montant : deux
      // remboursements partiels differents restent possibles.
      { idempotencyKey: `refund:${commande.id}:${montant}` },
    );
  } catch (erreur) {
    retour(
      fiche,
      "Stripe a refusé le remboursement. Rien n'a été rendu, et rien n'a bougé sur son solde. " +
        detailTechnique("remboursement", erreur as { code?: string; message?: string }),
      "erreur",
    );
  }

  // --- 2. LA BASE. A partir d'ici, l'argent est parti. Chaque echec se dit ---
  // --- precisement : Oriane doit savoir quoi finir a la main. ---------------
  const aFaireAMain: string[] = [];

  // Combien de seances retirer du solde. Sur un total, tout — mais c'est le
  // webhook qui le fait, avec revoke_order_credits, et qui ferme le lot.
  const aRetirer = total ? 0 : Math.min(seancesSaisies, soldeRevocable);

  if (aRetirer > 0) {
    for (const lot of lotsOuverts) {
      const part = Math.min(aRetirer, lot.quantity_remaining);
      if (part <= 0) continue;
      const { error } = await supabase.rpc("admin_refund_revoke_from_lot", {
        p_credit_lot_id: lot.id,
        p_quantity: part,
        p_order_id: commande.id,
        p_reason: motif,
      });
      if (error) aFaireAMain.push(`retirer ${part} séance(s) de son solde`);
    }
  }

  // Les inscriptions a venir. Sur un total, toutes. Sur un partiel, seulement
  // ce que le solde n'a pas pu absorber — et en commencant par la plus
  // LOINTAINE : une cliente inscrite demain s'est organisee autour de ce cours.
  const aDesinscrire = total
    ? coursAVenir
    : coursAVenir.slice(0, Math.max(0, seancesSaisies - aRetirer));

  const annules: { debut: string; fin: string; lieu: string }[] = [];
  for (const c of aDesinscrire) {
    // p_refund = false : la place est rendue au cours, la seance ne revient
    // PAS au solde. L'argent a ete rendu a sa place.
    const { error } = await supabase.rpc("admin_unbook", {
      p_booking_id: c.bookingId,
      p_refund: false,
      p_note: `Remboursement : ${motif}`,
    });
    if (error) aFaireAMain.push(`désinscrire du cours du ${enDateAnnee(c.debut)}`);
    else annules.push({ debut: c.debut, fin: c.fin, lieu: c.lieu });
  }

  // --- 3. L'EMAIL. Un echec d'envoi ne fait jamais echouer l'appelant. ------
  await previenirDuRemboursement({
    userId: commande.user_id,
    orderId: commande.id,
    planId: commande.plan_id,
    montant,
    total,
    // Sur un TOTAL, c'est le webhook qui revoque le solde — mais la cliente
    // doit lire ce qui lui arrive, pas ce que cette fonction a execute. La
    // revocation est certaine : `revoke_order_credits` suit le remboursement.
    seancesRetirees: total ? soldeRevocable : aRetirer,
    coursAnnules: annules,
  });

  const parts = [`${prixLisible(montant)} remboursés`];
  if (aRetirer > 0) parts.push(`${aRetirer} séance${aRetirer > 1 ? "s" : ""} retirée${aRetirer > 1 ? "s" : ""}`);
  if (annules.length > 0) parts.push(`${annules.length} inscription${annules.length > 1 ? "s" : ""} annulée${annules.length > 1 ? "s" : ""}`);
  if (total && soldeRevocable > 0) {
    parts.push(
      `son solde de ${soldeRevocable} séance${soldeRevocable > 1 ? "s" : ""} tombe dès que Stripe confirme, dans quelques secondes`,
    );
  }

  retour(
    fiche,
    aFaireAMain.length > 0
      ? `${prixLisible(montant)} sont bien partis chez Stripe. En revanche, à finir à la main : ${aFaireAMain.join(", ")}. Le remboursement, lui, est acquis (${remboursement.id}).`
      : `${parts.join(", ")}.`,
    aFaireAMain.length > 0 ? "erreur" : "succes",
  );
}
