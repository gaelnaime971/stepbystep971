"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { profilCourant } from "@/lib/auth/session";
import { clientServeur } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe/client";
import { messageReservation } from "./messages";

function texte(d: FormData, champ: string): string {
  const v = d.get(champ);
  return typeof v === "string" ? v.trim() : "";
}

/** Renvoie sur l'espace cliente avec un bandeau. */
function retour(message: string, ton: "succes" | "erreur", ancre = ""): never {
  revalidatePath("/compte", "layout");
  redirect(`/compte?message=${encodeURIComponent(message)}&ton=${ton}${ancre}`);
}

// ---------------------------------------------------------------------------
// Reserver
// ---------------------------------------------------------------------------

/**
 * Passe par le RPC book_course, jamais par un insert.
 *
 * `authenticated` n'a AUCUN privilege d'ecriture sur bookings ni credit_lots :
 * meme si ce code voulait inserer directement, la base refuserait. Le RPC est
 * le seul chemin qui verrouille le cours, choisit le lot selon les regles 4 et
 * 5, decremente et ecrit le grand livre — le tout dans une transaction.
 */
export async function reserver(donnees: FormData): Promise<void> {
  const profil = await profilCourant();
  if (!profil) redirect("/connexion?suite=/compte");

  const supabase = await clientServeur();
  const { error } = await supabase.rpc("book_course", {
    p_course_id: texte(donnees, "coursId"),
  });

  if (error) retour(messageReservation(error.code), "erreur");
  retour("Réservé. On se voit là-bas.", "succes");
}

// ---------------------------------------------------------------------------
// Annuler
// ---------------------------------------------------------------------------

export async function annuler(donnees: FormData): Promise<void> {
  const profil = await profilCourant();
  if (!profil) redirect("/connexion?suite=/compte");

  const supabase = await clientServeur();
  const { error } = await supabase.rpc("cancel_booking", {
    p_booking_id: texte(donnees, "reservationId"),
  });

  if (error) {
    // Le delai vient de la formule qui a finance la seance (regle 6) : le
    // message le rappelle avec le bon nombre d'heures plutot qu'un « 24 h »
    // en dur qui serait faux pour une autre formule.
    const heures = texte(donnees, "delai");
    const precision =
      error.code === "SB007" && heures
        ? `Trop tard pour annuler : il faut s'y prendre au moins ${heures} h avant le cours. Ta séance reste décomptée.`
        : undefined;
    retour(messageReservation(error.code, precision), "erreur");
  }

  retour("Annulé. La séance est revenue sur ton solde.", "succes");
}

// ---------------------------------------------------------------------------
// Portail client Stripe
// ---------------------------------------------------------------------------

/**
 * Ouvre le portail Stripe : changer de carte, telecharger ses factures,
 * resilier. Tout ce qui touche au paiement vit chez Stripe, pas ici.
 */
export async function ouvrirPortail(): Promise<void> {
  const profil = await profilCourant();
  if (!profil) redirect("/connexion?suite=/compte/formule");

  if (!profil.stripe_customer_id) {
    redirect(
      "/compte/formule?message=" +
        encodeURIComponent(
          "Tu n'as pas encore de paiement enregistré. Le portail s'ouvrira après ton premier achat.",
        ) +
        "&ton=erreur",
    );
  }

  let url: string;
  try {
    const session = await stripe().billingPortal.sessions.create({
      customer: profil.stripe_customer_id,
      return_url: `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/compte/formule`,
    });
    url = session.url;
  } catch {
    redirect(
      "/compte/formule?message=" +
        encodeURIComponent(
          "Le portail de paiement ne répond pas. Réessaie dans un instant, ton abonnement n'a pas bougé.",
        ) +
        "&ton=erreur",
    );
  }

  redirect(url);
}

// ---------------------------------------------------------------------------
// Profil
// ---------------------------------------------------------------------------

export async function modifierProfil(donnees: FormData): Promise<void> {
  const profil = await profilCourant();
  if (!profil) redirect("/connexion?suite=/compte/profil");

  const prenom = texte(donnees, "prenom");
  const nom = texte(donnees, "nom");
  const telephone = texte(donnees, "telephone");

  const echec = (m: string) =>
    redirect(`/compte/profil?message=${encodeURIComponent(m)}&ton=erreur`);

  if (!prenom || !nom) echec("Renseigne ton prénom et ton nom.");

  const supabase = await clientServeur();
  // Seules ces trois colonnes sont accordees a `authenticated` : ni le role,
  // ni l'email, ni le client Stripe ne peuvent partir d'ici.
  const { error } = await supabase
    .from("profiles")
    .update({ first_name: prenom, last_name: nom, phone: telephone || null })
    .eq("id", profil.id);

  if (error) echec("Tes informations n'ont pas pu être enregistrées.");

  revalidatePath("/compte", "layout");
  redirect(
    `/compte/profil?message=${encodeURIComponent("C'est enregistré.")}&ton=succes`,
  );
}
