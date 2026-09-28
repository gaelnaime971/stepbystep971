"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { profilCourant } from "@/lib/auth/session";
import { clientServeur } from "@/lib/supabase/server";
import { detailTechnique } from "@/lib/erreur-technique";
import { VERSION_CHARTE } from "./texte";

/**
 * L'adresse et le navigateur, pour la valeur probante.
 *
 * Derriere Vercel, l'adresse reelle est dans `x-forwarded-for`, dont le premier
 * element est le client ; les suivants sont les relais. `x-real-ip` sert de
 * repli. Aucune de ces valeurs n'est garantie : un consentement sans IP vaut
 * mieux qu'un consentement refuse pour un en-tete manquant.
 */
async function traceTechnique(): Promise<{ ip: string | null; ua: string | null }> {
  const h = await headers();
  const transmise = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return {
    ip: transmise || h.get("x-real-ip") || null,
    ua: h.get("user-agent"),
  };
}

/**
 * Le choix d'image, lu SANS valeur par defaut.
 *
 * Rend `null` si rien n'a ete coche. C'est le coeur du sujet : ne pas repondre
 * n'est pas repondre « non », et surtout pas « oui ». L'appelant refuse.
 */
function choixImage(donnees: FormData): boolean | null {
  const v = donnees.get("autorisationImage");
  if (v === "autorise") return true;
  if (v === "refuse") return false;
  return null;
}

async function enregistrer(
  autorisationImage: boolean,
  origine: "acceptation" | "changement_image",
): Promise<string | null> {
  const supabase = await clientServeur();
  const { ip, ua } = await traceTechnique();

  const { error } = await supabase.rpc("accepter_charte", {
    p_version: VERSION_CHARTE,
    p_autorisation_image: autorisationImage,
    p_origine: origine,
    p_ip: ip,
    p_user_agent: ua,
  });

  return error ? detailTechnique("charte", error) : null;
}

/**
 * La signature, depuis la page bloquante.
 *
 * Les deux consentements sont lus SEPAREMENT et aucun ne se deduit de l'autre.
 * L'acceptation du reglement est obligatoire ; le choix d'image est obligatoire
 * A EXPRIMER, mais sa valeur est libre — et un refus ne bloque rien, l'article
 * 7.4 le dit lui-meme.
 */
export async function signerCharte(donnees: FormData): Promise<void> {
  const profil = await profilCourant();
  if (!profil) redirect("/connexion?suite=/compte");

  const suite = (() => {
    const v = donnees.get("suite");
    // On ne redirige que vers une route interne : une URL fournie par le
    // formulaire pourrait sinon envoyer ailleurs.
    return typeof v === "string" && /^\/[a-zA-Z0-9/_-]*$/.test(v) ? v : "/compte";
  })();

  const echec = (m: string): never =>
    redirect(`/accepter-la-charte?message=${encodeURIComponent(m)}&ton=erreur`);

  if (donnees.get("reglement") !== "on") {
    echec("Pour accéder à ton espace, il faut accepter le règlement.");
  }

  const image = choixImage(donnees);
  if (image === null) {
    echec("Dis-nous aussi si tu autorises la diffusion de ton image. Un refus ne t'empêche de rien.");
    return;
  }

  const erreur = await enregistrer(image, "acceptation");
  if (erreur) echec(`Ton acceptation n'a pas pu être enregistrée. ${erreur}`);

  revalidatePath("/compte", "layout");
  redirect(suite);
}

/**
 * Le changement d'avis sur l'image, depuis le profil, dans les deux sens.
 *
 * Article 7.4 : le refus peut etre notifie « a tout moment au cours de sa
 * participation ». Une ligne de plus, jamais une reecriture — l'etat qui avait
 * cours au moment d'une publication reste lisible.
 */
export async function changerAutorisationImage(donnees: FormData): Promise<void> {
  const profil = await profilCourant();
  if (!profil) redirect("/connexion?suite=/compte/profil");

  const image = choixImage(donnees);
  const retour = (m: string, ton: "succes" | "erreur"): never =>
    redirect(`/compte/profil?message=${encodeURIComponent(m)}&ton=${ton}`);

  if (image === null) {
    retour("Choisis « J'autorise » ou « Je refuse ».", "erreur");
    return;
  }

  const erreur = await enregistrer(image, "changement_image");
  if (erreur) retour(`Ton choix n'a pas pu être enregistré. ${erreur}`, "erreur");

  revalidatePath("/compte", "layout");
  retour(
    image
      ? "C'est noté : tu autorises la diffusion de ton image."
      : "C'est noté : ton image ne sera pas diffusée.",
    "succes",
  );
}

/**
 * Ecrit le consentement exprime A L'INSCRIPTION, au premier acces.
 *
 * Pourquoi ce detour : avec la confirmation par email, `signUp` n'ouvre pas de
 * session, et `accepter_charte()` a besoin d'un `auth.uid()`. Les deux choix
 * voyagent donc dans les metadonnees du compte jusqu'a la premiere session, ou
 * cette fonction les transforme en ligne — avec l'adresse et le navigateur de
 * ce moment-la.
 *
 * Les metadonnees d'un compte sont modifiables par son titulaire : elles ne
 * SONT donc pas la preuve. La preuve, c'est la ligne ecrite ici, cote serveur.
 * Le risque est d'ailleurs sans portee : falsifier son propre consentement ne
 * fait que l'engager davantage.
 *
 * Rend `true` si une ligne a ete ecrite.
 */
export async function enregistrerDepuisInscription(): Promise<boolean> {
  const supabase = await clientServeur();
  const { data } = await supabase.auth.getUser();

  const meta = data.user?.user_metadata as
    | { charte_version?: unknown; charte_image?: unknown }
    | undefined;

  if (meta?.charte_version !== VERSION_CHARTE) return false;
  if (typeof meta.charte_image !== "boolean") return false;

  const erreur = await enregistrer(meta.charte_image, "acceptation");
  if (erreur) {
    console.error("[charte] consentement d'inscription non enregistre");
    return false;
  }
  return true;
}
