"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { profilCourant } from "@/lib/auth/session";
import { clientServeur } from "@/lib/supabase/server";
import { clientService } from "@/lib/supabase/service";
import { stripe } from "@/lib/stripe/client";
import { envoyer } from "@/lib/emails/envoyer";
import { confirmationReservation } from "@/lib/emails/modeles";
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
  const coursId = texte(donnees, "coursId");
  const { data: reservationId, error } = await supabase.rpc("book_course", {
    p_course_id: coursId,
  });

  if (error) retour(messageReservation(error.code), "erreur");

  // L'email est un a-cote : la seance est reservee, une panne de Resend ne doit
  // pas faire croire le contraire ni annuler quoi que ce soit.
  try {
    await notifierReservation(profil.id, coursId, String(reservationId));
  } catch (erreur) {
    console.error("confirmation de réservation non envoyée :", erreur);
  }

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

/**
 * Confirme la reservation par email.
 *
 * Le delai d'annulation vient de la formule qui a finance la seance (regle 6),
 * lu via le lot debite — jamais un 24 h en dur.
 */
async function notifierReservation(
  userId: string,
  coursId: string,
  bookingId: string,
): Promise<void> {
  const base = clientService();

  const [{ data: profil }, { data: cours }, { data: reservation }] = await Promise.all([
    base.from("profiles").select("email, first_name").eq("id", userId)
      .maybeSingle<{ email: string; first_name: string }>(),
    base.from("courses").select("starts_at, ends_at, location_id").eq("id", coursId)
      .maybeSingle<{ starts_at: string; ends_at: string; location_id: string }>(),
    base.from("bookings").select("credit_lot_id").eq("id", bookingId)
      .maybeSingle<{ credit_lot_id: string }>(),
  ]);
  if (!profil || !cours) return;

  const { data: lieu } = await base.from("locations").select("name")
    .eq("id", cours.location_id).maybeSingle<{ name: string }>();

  let delai = 24;
  if (reservation) {
    const { data: lot } = await base.from("credit_lots").select("plan_id")
      .eq("id", reservation.credit_lot_id).maybeSingle<{ plan_id: string | null }>();
    if (lot?.plan_id) {
      const { data: formule } = await base.from("plans")
        .select("cancellation_deadline_hours").eq("id", lot.plan_id)
        .maybeSingle<{ cancellation_deadline_hours: number }>();
      delai = formule?.cancellation_deadline_hours ?? 24;
    }
  }

  const { data: restants } = await base
    .from("credit_lots").select("quantity_remaining")
    .eq("user_id", userId).is("closed_at", null)
    .gt("quantity_remaining", 0).gt("expires_at", new Date().toISOString())
    .returns<{ quantity_remaining: number }[]>();

  const { objet, contenu } = confirmationReservation({
    prenom: profil.first_name,
    debut: cours.starts_at,
    fin: cours.ends_at,
    lieu: lieu?.name ?? "le lieu habituel",
    delaiHeures: delai,
    soldeRestant: (restants ?? []).reduce((n, l) => n + l.quantity_remaining, 0),
  });

  await envoyer({
    modele: "booking_confirmation",
    userId,
    destinataire: profil.email,
    objet,
    contenu,
    liens: { booking_id: bookingId, course_id: coursId },
  });
}
