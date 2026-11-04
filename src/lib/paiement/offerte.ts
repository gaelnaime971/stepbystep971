"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { profilCourant } from "@/lib/auth/session";
import { clientServeur } from "@/lib/supabase/server";
import { detailTechnique } from "@/lib/erreur-technique";
import { envoyer } from "@/lib/emails/envoyer";
import { confirmationFormuleOfferte } from "@/lib/emails/modeles";
import { COLONNES_FORMULE, estGratuite, type Formule } from "@/lib/formules/types";

/**
 * Prendre une formule offerte.
 *
 * CE CHEMIN NE TOUCHE JAMAIS STRIPE. Checkout refuse une session a zero : il
 * n'y a ni produit, ni prix, ni session. Le RPC `prendre_formule_offerte`
 * ecrit une commande a zero puis appelle `credit_order()` — la MEME fonction
 * qu'apres un paiement. Meme lot, meme expiration, meme mouvement au grand
 * livre, avec une origine `offert` qui le dit.
 *
 * Le garde-fou n'est pas ici : il est DANS le RPC, qui relit le prix en base.
 * Un formulaire rejoue avec le slug du pack a 400 EUR echoue en SB014. Ce qui
 * suit n'est que la traduction de ses refus.
 */
export async function prendreFormuleOfferte(donnees: FormData): Promise<void> {
  const profil = await profilCourant();
  if (!profil) redirect("/connexion?suite=/compte/formule");

  const slug = (() => {
    const v = donnees.get("slug");
    return typeof v === "string" ? v.trim() : "";
  })();

  const echec = (message: string): never =>
    redirect(`/compte/formule?message=${encodeURIComponent(message)}&ton=erreur`);

  const supabase = await clientServeur();
  const { data: formule } = await supabase
    .from("plans").select(COLONNES_FORMULE).eq("slug", slug).maybeSingle<Formule>();

  if (!formule) return echec("Cette formule n'existe pas.");
  if (!estGratuite(formule)) {
    // Elle a un prix : ce n'est pas le bon chemin. On ne la refuse pas, on
    // l'envoie payer.
    redirect("/compte/formule");
  }

  const { error } = await supabase.rpc("prendre_formule_offerte", { p_slug: slug });

  if (error) {
    if (error.code === "SB015") {
      return echec("Tu as déjà pris cette formule offerte. Elle est à une par personne.");
    }
    if (error.code === "SB008") return echec("Cette formule n'est plus proposée.");
    if (error.code === "SB014") return echec("Cette formule n'est pas gratuite.");
    return echec(
      `Tes séances n'ont pas pu être créditées. ${detailTechnique("offerte", error)}`,
    );
  }

  await previenir(profil, formule);

  revalidatePath("/compte", "layout");
  redirect(
    `/compte?message=${encodeURIComponent(
      `C'est à toi : ${formule.sessions_count} séance${formule.sessions_count > 1 ? "s" : ""} offerte${formule.sessions_count > 1 ? "s" : ""}. Place-${formule.sessions_count > 1 ? "les" : "la"} dans le planning.`,
    )}&ton=succes`,
  );
}

/**
 * Un echec d'envoi ne fait JAMAIS echouer l'inscription : les seances sont
 * creditees, rejouer ne changerait rien a cela. L'erreur se lit dans email_log.
 */
async function previenir(
  profil: { id: string; email: string; first_name: string },
  formule: Formule,
): Promise<void> {
  try {
    const supabase = await clientServeur();
    const { data: lot } = await supabase
      .from("credit_lots")
      .select("id, quantity_remaining, expires_at, order_id")
      .eq("user_id", profil.id).eq("plan_id", formule.id).eq("origin", "offert")
      .order("issued_at", { ascending: false }).limit(1)
      .maybeSingle<{ id: string; quantity_remaining: number; expires_at: string; order_id: string }>();
    if (!lot) return;

    const { objet, contenu } = confirmationFormuleOfferte({
      prenom: profil.first_name,
      formule: formule.name,
      seances: lot.quantity_remaining,
      expire: lot.expires_at,
    });

    await envoyer({
      modele: "purchase_confirmation",
      userId: profil.id,
      destinataire: profil.email,
      objet,
      contenu,
      liens: { order_id: lot.order_id, credit_lot_id: lot.id },
      reessayable: false,
    });
  } catch (erreur) {
    console.error("[offerte] confirmation non envoyée :", erreur);
  }
}
