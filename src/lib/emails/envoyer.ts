import { clientService } from "@/lib/supabase/service";
import { expediteur, repondreA, resend } from "./client";
import { rendre, type Contenu } from "./rendu";

export type Modele =
  | "purchase_confirmation"
  | "booking_confirmation"
  | "course_canceled"
  | "expiry_warning"
  | "payment_failed";

export type Envoi = {
  modele: Modele;
  userId: string;
  destinataire: string;
  objet: string;
  contenu: Contenu;
  /** Rattachements : ce sont eux qui portent l'idempotence en base. */
  liens?: {
    order_id?: string;
    booking_id?: string;
    course_id?: string;
    credit_lot_id?: string;
    subscription_id?: string;
    stripe_invoice_id?: string;
  };
  /**
   * true  : un echec d'envoi efface la reservation, la prochaine execution
   *         reessaiera. Pour les crons, ou perdre l'alerte est pire qu'un
   *         doublon improbable.
   * false : la ligne reste avec son erreur. Au plus une fois, la trace du
   *         probleme est conservee. Pour les webhooks et les actions.
   */
  reessayable?: boolean;
};

export type Resultat =
  | { etat: "envoye"; id: string | null }
  | { etat: "deja_envoye" }
  | { etat: "echec"; raison: string };

/**
 * Envoie un email et le journalise.
 *
 * La ligne d'email_log est ecrite AVANT l'envoi : c'est elle qui reserve la
 * place. Les index uniques partiels de 0002 font le reste — une alerte de fin
 * de validite par lot, un echec de paiement par facture, une fin d'abonnement
 * par abonnement. Deux crons qui se chevauchent ou un webhook rejoue butent
 * sur la contrainte au lieu d'ecrire deux fois a la meme cliente.
 */
export async function envoyer(envoi: Envoi): Promise<Resultat> {
  const base = clientService();

  const { data: reservation, error: conflit } = await base
    .from("email_log")
    .insert({
      user_id: envoi.userId,
      template: envoi.modele,
      to_email: envoi.destinataire,
      ...envoi.liens,
    })
    .select("id")
    .single<{ id: string }>();

  if (conflit?.code === "23505") return { etat: "deja_envoye" };
  if (conflit || !reservation) {
    return { etat: "echec", raison: conflit?.message ?? "journal indisponible" };
  }

  const { html, texte } = rendre(envoi.contenu);

  try {
    const { data, error } = await resend().emails.send({
      from: expediteur(),
      to: envoi.destinataire,
      replyTo: repondreA(),
      subject: envoi.objet,
      html,
      text: texte,
    });

    if (error) throw new Error(error.message);

    await base
      .from("email_log")
      .update({ resend_message_id: data?.id ?? null })
      .eq("id", reservation.id);

    return { etat: "envoye", id: data?.id ?? null };
  } catch (erreur) {
    const raison = erreur instanceof Error ? erreur.message : String(erreur);

    if (envoi.reessayable) {
      // On rend la place : la prochaine execution du cron reessaiera.
      await base.from("email_log").delete().eq("id", reservation.id);
    } else {
      await base.from("email_log").update({ error: raison }).eq("id", reservation.id);
    }

    console.error(`email ${envoi.modele} non envoyé à ${envoi.destinataire} : ${raison}`);
    return { etat: "echec", raison };
  }
}
