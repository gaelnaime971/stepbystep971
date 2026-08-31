"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { profilCourant } from "@/lib/auth/session";
import { clientServeur } from "@/lib/supabase/server";
import { eurosEnCentimes } from "@/lib/formules/format";
import {
  creerCodePromo, desactiverCodePromo, messagePromoStripe, reactiverCodePromo,
} from "@/lib/promo/stripe";
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
      `Le code créé chez Stripe a été désactivé, rien ne traîne. Détail : ${error.message}`,
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
