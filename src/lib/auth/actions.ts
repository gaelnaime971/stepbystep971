"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { clientServeur } from "@/lib/supabase/server";
import { urlDuSite } from "@/lib/site";
import type { EtatFormulaire } from "./formulaire";
import { messageErreur } from "./messages";
import { accueilSelonRole, COLONNES_PROFIL, type Role } from "./session";

const LONGUEUR_MOT_DE_PASSE = 8;

function texte(donnees: FormData, champ: string): string {
  const v = donnees.get(champ);
  return typeof v === "string" ? v.trim() : "";
}

function emailValide(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

/**
 * Empeche une redirection ouverte : seule une route interne est acceptee, et
 * jamais une page d'authentification (on y serait renvoyee en boucle).
 */
function suiteSure(brut: string): string | null {
  if (!brut.startsWith("/") || brut.startsWith("//")) return null;
  if (/^\/(connexion|inscription|mot-de-passe-oublie|auth)(\/|$)/.test(brut)) {
    return null;
  }
  return brut;
}

/**
 * URL publique, pour les liens de confirmation et de reinitialisation.
 *
 * Repli sur les en-tetes de la requete quand la variable est absente : utile
 * sur un deploiement de previsualisation, ou l'URL change a chaque commit. En
 * production la variable est obligatoire et urlDuSite() echoue sans elle.
 */
async function origine(): Promise<string> {
  if (process.env.NEXT_PUBLIC_SITE_URL?.trim()) return urlDuSite();

  const entetes = await headers();
  const hote = entetes.get("x-forwarded-host") ?? entetes.get("host");
  const protocole = entetes.get("x-forwarded-proto") ?? "http";
  return `${protocole}://${hote}`;
}

// ---------------------------------------------------------------------------
// Connexion
// ---------------------------------------------------------------------------

export async function connexion(
  _precedent: EtatFormulaire,
  donnees: FormData,
): Promise<EtatFormulaire> {
  const email = texte(donnees, "email");
  const motDePasse = texte(donnees, "motDePasse");
  const suite = suiteSure(texte(donnees, "suite"));
  const valeurs = { email };

  if (!email || !motDePasse) {
    return { erreur: "Renseigne ton email et ton mot de passe.", valeurs };
  }

  const supabase = await clientServeur();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: motDePasse,
  });

  if (error) {
    return { erreur: messageErreur(error.message), valeurs };
  }

  // Le role decide de la page d'accueil. On enumere les colonnes : select('*')
  // est interdit sur profiles.
  const { data: profil } = await supabase
    .from("profiles")
    .select(COLONNES_PROFIL)
    .eq("id", data.user.id)
    .single<{ role: Role }>();

  revalidatePath("/", "layout");
  redirect(suite ?? accueilSelonRole(profil?.role));
}

// ---------------------------------------------------------------------------
// Inscription
// ---------------------------------------------------------------------------

export async function inscription(
  _precedent: EtatFormulaire,
  donnees: FormData,
): Promise<EtatFormulaire> {
  const prenom = texte(donnees, "prenom");
  const nom = texte(donnees, "nom");
  const email = texte(donnees, "email");
  const telephone = texte(donnees, "telephone");
  const motDePasse = texte(donnees, "motDePasse");
  const valeurs = { prenom, nom, email, telephone };

  if (!prenom || !nom) {
    return { erreur: "Renseigne ton prénom et ton nom.", valeurs };
  }
  if (!emailValide(email)) {
    return { erreur: "Cet email n'est pas valide. Vérifie ta saisie.", valeurs };
  }
  if (motDePasse.length < LONGUEUR_MOT_DE_PASSE) {
    return {
      erreur: `Ton mot de passe doit faire au moins ${LONGUEUR_MOT_DE_PASSE} caractères.`,
      valeurs,
    };
  }

  const supabase = await clientServeur();
  const { data, error } = await supabase.auth.signUp({
    email,
    password: motDePasse,
    options: {
      emailRedirectTo: `${await origine()}/auth/confirm`,
      // Ces trois valeurs alimentent le trigger handle_new_user, qui cree la
      // ligne profiles. Sans elles, le profil naitrait avec « Prenom » / « Nom ».
      data: { first_name: prenom, last_name: nom, phone: telephone || null },
    },
  });

  if (error) {
    return { erreur: messageErreur(error.message), valeurs };
  }

  // Si la confirmation par email est active, il n'y a pas encore de session.
  if (!data.session) {
    return {
      succes:
        "C'est presque fait. Ouvre le mail que je viens de t'envoyer et clique sur le lien pour activer ton compte.",
    };
  }

  revalidatePath("/", "layout");
  redirect("/compte");
}

// ---------------------------------------------------------------------------
// Mot de passe oublie
// ---------------------------------------------------------------------------

export async function demanderNouveauMotDePasse(
  _precedent: EtatFormulaire,
  donnees: FormData,
): Promise<EtatFormulaire> {
  const email = texte(donnees, "email");

  if (!emailValide(email)) {
    return {
      erreur: "Cet email n'est pas valide. Vérifie ta saisie.",
      valeurs: { email },
    };
  }

  const supabase = await clientServeur();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${await origine()}/auth/confirm?suite=/nouveau-mot-de-passe`,
  });

  // Un echec de rythme se dit ; le reste non. Repondre « cet email n'existe
  // pas » revelerait qui a un compte.
  if (error && /rate limit|for security purposes|too many/i.test(error.message)) {
    return { erreur: messageErreur(error.message), valeurs: { email } };
  }

  return {
    succes:
      "Si un compte existe avec cet email, tu vas recevoir un lien pour choisir un nouveau mot de passe.",
  };
}

export async function changerMotDePasse(
  _precedent: EtatFormulaire,
  donnees: FormData,
): Promise<EtatFormulaire> {
  const motDePasse = texte(donnees, "motDePasse");
  const confirmation = texte(donnees, "confirmation");

  if (motDePasse.length < LONGUEUR_MOT_DE_PASSE) {
    return {
      erreur: `Ton mot de passe doit faire au moins ${LONGUEUR_MOT_DE_PASSE} caractères.`,
    };
  }
  if (motDePasse !== confirmation) {
    return { erreur: "Les deux mots de passe ne sont pas identiques." };
  }

  const supabase = await clientServeur();
  const { data, error } = await supabase.auth.updateUser({ password: motDePasse });

  if (error) {
    return { erreur: messageErreur(error.message) };
  }

  const { data: profil } = await supabase
    .from("profiles")
    .select(COLONNES_PROFIL)
    .eq("id", data.user.id)
    .single<{ role: Role }>();

  revalidatePath("/", "layout");
  redirect(accueilSelonRole(profil?.role));
}

// ---------------------------------------------------------------------------
// Deconnexion
// ---------------------------------------------------------------------------

export async function deconnexion(): Promise<void> {
  const supabase = await clientServeur();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}
