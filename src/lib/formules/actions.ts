"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { clientServeur } from "@/lib/supabase/server";
import { profilCourant } from "@/lib/auth/session";
import { detailTechnique } from "@/lib/erreur-technique";
import type { EtatFormule } from "./etat";
import {
  archiverProduit,
  creerProduitEtPrix,
  messageStripe,
  reactiverProduit,
  remplacerPrix,
  renommerProduit,
} from "./stripe";
import { eurosEnCentimes, intervalle, slugDepuis, VALIDITE_ABONNEMENT, type Unite } from "./format";
import { COLONNES_FORMULE, type Formule, type TypeFormule } from "./types";

const TYPES: TypeFormule[] = ["single", "subscription", "pack"];
const UNITES_VALIDES = ["days", "weeks", "months"];

function texte(d: FormData, champ: string): string {
  const v = d.get(champ);
  return typeof v === "string" ? v.trim() : "";
}
function coche(d: FormData, champ: string): boolean {
  return d.get(champ) === "on" || d.get(champ) === "true";
}
function lignes(brut: string): string[] {
  return brut.split("\n").map((l) => l.trim()).filter(Boolean);
}

async function exigerAdmin(): Promise<void> {
  const profil = await profilCourant();
  if (!profil || profil.role !== "admin") {
    redirect("/connexion?suite=/admin/formules");
  }
}

/** Renvoie vers la liste avec un bandeau. */
function retourListe(message: string, ton: "succes" | "erreur" = "succes"): never {
  revalidatePath("/admin/formules");
  redirect(`/admin/formules?message=${encodeURIComponent(message)}&ton=${ton}`);
}

// ---------------------------------------------------------------------------
// Creation
// ---------------------------------------------------------------------------

export async function creerFormule(
  _precedent: EtatFormule,
  donnees: FormData,
): Promise<EtatFormule> {
  await exigerAdmin();

  const nom = texte(donnees, "nom");
  const argumentaire = texte(donnees, "argumentaire");
  const type = texte(donnees, "type") as TypeFormule;
  const seances = Number(texte(donnees, "seances"));
  const validiteNombre = Number(texte(donnees, "validiteNombre"));
  const validiteUnite = texte(donnees, "validiteUnite") as Unite;
  const prix = texte(donnees, "prix");
  const prixBarre = texte(donnees, "prixBarre");
  const delai = Number(texte(donnees, "delai"));
  const miseEnAvant = coche(donnees, "miseEnAvant");
  const ordre = Number(texte(donnees, "ordre") || "0");
  const puces = lignes(texte(donnees, "puces"));

  const valeurs = {
    nom, argumentaire, type, prix, prixBarre, puces: texte(donnees, "puces"),
    seances: String(seances || ""), validiteNombre: String(validiteNombre || ""),
    validiteUnite, delai: String(delai || ""), ordre: String(ordre),
    miseEnAvant: miseEnAvant ? "on" : "",
  };
  const echec = (erreur: string, detail?: string) => ({ erreur, detail, valeurs });

  // --- Validation ---------------------------------------------------------
  if (!nom) return echec("Donne un nom à la formule.");
  if (!TYPES.includes(type)) return echec("Choisis un type de formule.");
  if (!Number.isInteger(seances) || seances < 1) {
    return echec("Le nombre de séances doit être un entier supérieur à zéro.");
  }
  const centimes = eurosEnCentimes(prix);
  if (centimes === null || centimes < 1) {
    return echec("Le prix n'est pas un montant valide. Écris-le en euros, par exemple 15 ou 70,50.");
  }
  const centimesBarres = prixBarre ? eurosEnCentimes(prixBarre) : null;
  if (prixBarre && centimesBarres === null) {
    return echec("Le prix barré n'est pas un montant valide.");
  }
  if (centimesBarres !== null && centimesBarres <= centimes) {
    return echec(
      "Le prix barré doit être supérieur au prix réel.",
      "Le prix barré sert à montrer l'économie. S'il est inférieur ou égal, la formule afficherait une remise négative.",
    );
  }
  if (!Number.isInteger(delai) || delai < 0) {
    return echec("Le délai d'annulation doit être un nombre d'heures positif ou nul.");
  }

  // Regle 3 : un abonnement est en 4 semaines, l'interface ne propose rien
  // d'autre et le serveur ne fait pas confiance a l'interface.
  let validite: string;
  if (type === "subscription") {
    validite = VALIDITE_ABONNEMENT;
  } else {
    if (!Number.isInteger(validiteNombre) || validiteNombre < 1) {
      return echec("La durée de validité doit être un entier supérieur à zéro.");
    }
    if (!UNITES_VALIDES.includes(validiteUnite)) {
      return echec("Choisis une unité de validité.");
    }
    validite = intervalle(validiteNombre, validiteUnite);
  }

  const slug = slugDepuis(nom);
  if (!slug) {
    return echec("Ce nom ne produit aucun identifiant utilisable. Utilise au moins une lettre ou un chiffre.");
  }

  const supabase = await clientServeur();

  // Pre-controle du doublon : moins cher qu'un aller-retour Stripe suivi d'une
  // compensation. La contrainte d'unicite reste le juge, plus bas.
  const { data: deja } = await supabase
    .from("plans").select("id, name").eq("slug", slug).maybeSingle<{ id: string; name: string }>();
  if (deja) {
    return echec(
      `Une formule porte déjà ce nom : « ${deja.name} ».`,
      "Deux formules ne peuvent pas partager le même identifiant. Change le nom, ou archive l'ancienne formule si tu veux la remplacer.",
    );
  }

  // --- Stripe d'abord -----------------------------------------------------
  // Aucune ligne n'est ecrite tant que Stripe n'a pas rendu ses identifiants :
  // une formule sans price_id ne serait pas achetable.
  let refs;
  try {
    refs = await creerProduitEtPrix({
      slug, name: nom, tagline: argumentaire || null, kind: type,
      sessions_count: seances, price_cents: centimes, currency: "EUR",
    });
  } catch (erreur) {
    return echec(messageStripe(erreur), "Aucune formule n'a été créée. Tu peux réessayer.");
  }

  // --- Puis la base -------------------------------------------------------
  const { error } = await supabase.from("plans").insert({
    slug, name: nom, tagline: argumentaire || null, kind: type,
    sessions_count: seances, validity_interval: validite,
    price_cents: centimes, compare_at_price_cents: centimesBarres,
    currency: "EUR",
    stripe_product_id: refs.productId, stripe_price_id: refs.priceId,
    cancellation_deadline_hours: delai, is_active: true,
    is_highlighted: miseEnAvant, features: puces, sort_order: ordre,
  });

  if (error) {
    // Stripe a reussi, la base a echoue : on annule le produit pour ne pas
    // laisser un produit fantome dans le tableau de bord Stripe.
    await archiverProduit(refs.productId, refs.priceId).catch(() => {});

    if (error.code === "23505") {
      return echec(
        "Une formule vient d'être créée avec ce même nom.",
        "Deux enregistrements simultanés se sont croisés. Recharge la liste, la formule est peut-être déjà là.",
      );
    }
    return echec(
      "La formule n'a pas pu être enregistrée.",
      `Le produit Stripe créé a été archivé, rien ne traîne. ${detailTechnique("formule-creation", error)}`,
    );
  }

  if (miseEnAvant) await retirerAutresMisesEnAvant(slug);

  retourListe(`« ${nom} » est créée et achetable.`);
}

/** Une seule formule porte la pastille « Le plus choisi » a la fois. */
async function retirerAutresMisesEnAvant(slugGarde: string): Promise<void> {
  const supabase = await clientServeur();
  await supabase.from("plans").update({ is_highlighted: false }).neq("slug", slugGarde).eq("is_highlighted", true);
}

// ---------------------------------------------------------------------------
// Publication d'une formule qui n'a pas encore de prix Stripe
// ---------------------------------------------------------------------------

export async function publierFormule(donnees: FormData): Promise<void> {
  await exigerAdmin();
  const id = texte(donnees, "id");

  const supabase = await clientServeur();
  const { data: f } = await supabase
    .from("plans").select(COLONNES_FORMULE).eq("id", id).single<Formule>();

  if (!f) retourListe("Cette formule n'existe pas.", "erreur");
  if (f.stripe_price_id) {
    retourListe(`« ${f.name} » est déjà publiée sur Stripe.`, "erreur");
  }

  let refs;
  try {
    refs = await creerProduitEtPrix({
      slug: f.slug, name: f.name, tagline: f.tagline, kind: f.kind,
      sessions_count: f.sessions_count, price_cents: f.price_cents,
      currency: f.currency,
    });
  } catch (erreur) {
    retourListe(messageStripe(erreur), "erreur");
  }

  const { error } = await supabase
    .from("plans")
    .update({ stripe_product_id: refs.productId, stripe_price_id: refs.priceId })
    .eq("id", id);

  if (error) {
    await archiverProduit(refs.productId, refs.priceId).catch(() => {});
    retourListe(
      `« ${f.name} » n'a pas pu être publiée. Le produit Stripe créé a été archivé, tu peux réessayer.`,
      "erreur",
    );
  }

  retourListe(`« ${f.name} » est publiée sur Stripe et devient achetable.`);
}

// ---------------------------------------------------------------------------
// Desactiver, reactiver, archiver
// ---------------------------------------------------------------------------

async function changerEtat(
  id: string,
  actif: boolean,
  archive: boolean,
): Promise<{ formule: Formule; avertissement: string | null }> {
  const supabase = await clientServeur();
  const { data: f } = await supabase
    .from("plans").select(COLONNES_FORMULE).eq("id", id).single<Formule>();

  if (!f) retourListe("Cette formule n'existe pas.", "erreur");

  // La base d'abord : c'est elle qui decide ce que la vitrine affiche. Stripe
  // ensuite, au mieux. Si Stripe echoue, la formule est deja retiree de la
  // vente et on le dit.
  const { error } = await supabase
    .from("plans")
    .update({
      is_active: actif,
      archived_at: archive ? new Date().toISOString() : null,
    })
    .eq("id", id);

  if (error) retourListe(`« ${f.name} » n'a pas pu être modifiée.`, "erreur");

  let avertissement: string | null = null;
  if (f.stripe_product_id) {
    try {
      if (actif) await reactiverProduit(f.stripe_product_id, f.stripe_price_id);
      else await archiverProduit(f.stripe_product_id, f.stripe_price_id);
    } catch {
      avertissement =
        " Stripe n'a pas suivi : le produit y reste dans son état précédent. Sans conséquence pour tes clientes, plus rien ne pointe dessus.";
    }
  }

  return { formule: f, avertissement };
}

export async function desactiverFormule(donnees: FormData): Promise<void> {
  await exigerAdmin();
  const { formule, avertissement } = await changerEtat(texte(donnees, "id"), false, false);
  retourListe(
    `« ${formule.name} » est retirée de la vente.${avertissement ?? ""}`,
    avertissement ? "erreur" : "succes",
  );
}

export async function reactiverFormule(donnees: FormData): Promise<void> {
  await exigerAdmin();
  const { formule, avertissement } = await changerEtat(texte(donnees, "id"), true, false);
  retourListe(
    `« ${formule.name} » est de nouveau en vente.${avertissement ?? ""}`,
    avertissement ? "erreur" : "succes",
  );
}

export async function archiverFormule(donnees: FormData): Promise<void> {
  await exigerAdmin();
  const { formule, avertissement } = await changerEtat(texte(donnees, "id"), false, true);
  retourListe(
    `« ${formule.name} » est archivée. Les clientes qui l'ont achetée gardent leurs séances.${avertissement ?? ""}`,
    avertissement ? "erreur" : "succes",
  );
}

// ---------------------------------------------------------------------------
// Modification des champs d'affichage
// ---------------------------------------------------------------------------

export async function modifierFormule(
  _precedent: EtatFormule,
  donnees: FormData,
): Promise<EtatFormule> {
  await exigerAdmin();

  const id = texte(donnees, "id");
  const nom = texte(donnees, "nom");
  const argumentaire = texte(donnees, "argumentaire");
  const delai = Number(texte(donnees, "delai"));
  const miseEnAvant = coche(donnees, "miseEnAvant");
  const ordre = Number(texte(donnees, "ordre") || "0");
  const puces = lignes(texte(donnees, "puces"));

  if (!nom) return { erreur: "Donne un nom à la formule." };
  if (!Number.isInteger(delai) || delai < 0) {
    return { erreur: "Le délai d'annulation doit être un nombre d'heures positif ou nul." };
  }

  const supabase = await clientServeur();

  // Ni price_cents, ni sessions_count, ni validity_interval, ni kind : ces
  // colonnes ne figurent pas dans le UPDATE, et le trigger
  // plans_guard_immutable les refuserait de toute facon des la premiere vente.
  const { data: f, error } = await supabase
    .from("plans")
    .update({
      name: nom, tagline: argumentaire || null,
      cancellation_deadline_hours: delai, is_highlighted: miseEnAvant,
      sort_order: ordre, features: puces,
    })
    .eq("id", id)
    .select(COLONNES_FORMULE)
    .single<Formule>();

  if (error || !f) {
    return {
      erreur: "La formule n'a pas pu être modifiée.",
      detail: detailTechnique("formule-modification", error),
    };
  }

  if (miseEnAvant) await retirerAutresMisesEnAvant(f.slug);

  // Le NOM du produit Stripe suit. Son PRIX ne bouge jamais : un prix Stripe
  // est immuable, comme le prix d'une formule vendue.
  if (f.stripe_product_id) {
    await renommerProduit(f.stripe_product_id, nom, argumentaire || null).catch(() => {});
  }

  retourListe(`« ${nom} » est à jour.`);
}

// ---------------------------------------------------------------------------
// Correction du tarif d'une formule JAMAIS VENDUE
// ---------------------------------------------------------------------------

export async function corrigerTarif(
  _precedent: EtatFormule,
  donnees: FormData,
): Promise<EtatFormule> {
  await exigerAdmin();

  const id = texte(donnees, "id");
  const prix = texte(donnees, "prix");
  const prixBarre = texte(donnees, "prixBarre");
  const seances = Number(texte(donnees, "seances"));
  const validiteNombre = Number(texte(donnees, "validiteNombre"));
  const validiteUnite = texte(donnees, "validiteUnite") as Unite;

  const supabase = await clientServeur();
  const { data: f } = await supabase
    .from("plans").select(COLONNES_FORMULE).eq("id", id).single<Formule>();
  if (!f) return { erreur: "Cette formule n'existe pas." };

  // Second verrou. L'interface n'affiche ce formulaire que si le compteur est a
  // zero, mais le serveur ne fait pas confiance a l'interface — et entre
  // l'affichage et l'envoi, une premiere vente a pu tomber.
  const { count } = await supabase
    .from("orders").select("id", { count: "exact", head: true }).eq("plan_id", id);
  if ((count ?? 0) > 0) {
    return {
      erreur: "Cette formule vient d'être vendue : son tarif est désormais figé.",
      detail:
        "Recharge la page. Pour changer le prix, crée une nouvelle formule à partir de celle-ci, puis archive-la.",
    };
  }

  const centimes = eurosEnCentimes(prix);
  if (centimes === null || centimes < 1) {
    return { erreur: "Le prix n'est pas un montant valide. Écris-le en euros, par exemple 15 ou 70,50." };
  }
  const centimesBarres = prixBarre ? eurosEnCentimes(prixBarre) : null;
  if (prixBarre && centimesBarres === null) {
    return { erreur: "Le prix barré n'est pas un montant valide." };
  }
  if (centimesBarres !== null && centimesBarres <= centimes) {
    return { erreur: "Le prix barré doit être supérieur au prix réel." };
  }
  if (!Number.isInteger(seances) || seances < 1) {
    return { erreur: "Le nombre de séances doit être un entier supérieur à zéro." };
  }

  const validite =
    f.kind === "subscription"
      ? VALIDITE_ABONNEMENT
      : (!Number.isInteger(validiteNombre) || validiteNombre < 1
          ? null
          : UNITES_VALIDES.includes(validiteUnite)
            ? intervalle(validiteNombre, validiteUnite)
            : null);
  if (validite === null) return { erreur: "La durée de validité n'est pas valide." };

  // Stripe d'abord, comme a la creation : la base ne doit jamais annoncer un
  // tarif que Stripe ne sait pas facturer.
  let nouveauPrixId = f.stripe_price_id;
  if (f.stripe_product_id && centimes !== f.price_cents) {
    try {
      nouveauPrixId = await remplacerPrix(f.stripe_product_id, f.stripe_price_id, {
        slug: f.slug, kind: f.kind, price_cents: centimes, currency: f.currency,
      });
    } catch (erreur) {
      return {
        erreur: messageStripe(erreur),
        detail: "Le tarif n'a pas été modifié. La formule reste achetable à son prix actuel.",
      };
    }
  }

  const { error } = await supabase.from("plans").update({
    price_cents: centimes,
    compare_at_price_cents: centimesBarres,
    sessions_count: seances,
    validity_interval: validite,
    stripe_price_id: nouveauPrixId,
  }).eq("id", id);

  if (error) {
    return {
      erreur: "Le tarif n'a pas pu être enregistré.",
      detail:
        error.code === "SB012" || error.message.includes("deja ete vendue")
          ? "Cette formule a été vendue entre-temps. Crée une nouvelle formule à partir de celle-ci."
          : detailTechnique("formule-tarif", error),
    };
  }

  retourListe(`Le tarif de « ${f.name} » est à jour.`);
}
