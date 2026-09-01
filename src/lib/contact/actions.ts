"use server";

import { redirect } from "next/navigation";
import { resend, expediteur } from "@/lib/emails/client";
import { rendre } from "@/lib/emails/rendu";
import { verifierJeton } from "./jeton";

const DESTINATAIRE = process.env.EMAIL_REPLY_TO ?? "sbscoaching28@gmail.com";

function texte(d: FormData, champ: string): string {
  const v = d.get(champ);
  return typeof v === "string" ? v.trim() : "";
}

function retour(message: string, ton: "succes" | "erreur"): never {
  redirect(`/contact?message=${encodeURIComponent(message)}&ton=${ton}#formulaire`);
}

export async function envoyerMessage(donnees: FormData): Promise<void> {
  // Champ piege : invisible pour une humaine, irresistible pour un robot.
  // On repond « envoye » sans rien envoyer : un robot qui recoit une erreur
  // recommence, un robot qui croit avoir reussi passe au site suivant.
  if (texte(donnees, "site")) {
    retour("Merci, ton message est parti. Oriane te répond vite.", "succes");
  }

  const verdict = verifierJeton(texte(donnees, "jeton"));
  if (verdict === "trop_rapide") {
    retour("Le message est parti trop vite pour être lu. Réessaie.", "erreur");
  }
  if (verdict === "perime" || verdict === "invalide") {
    retour("Cette page est restée ouverte trop longtemps. Recharge-la et réessaie.", "erreur");
  }

  const nom = texte(donnees, "nom").slice(0, 120);
  const email = texte(donnees, "email").slice(0, 200);
  const message = texte(donnees, "message").slice(0, 4000);

  if (!nom || !email || !message) {
    retour("Renseigne ton nom, ton email et ton message.", "erreur");
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    retour("Cet email n'est pas valide. Vérifie ta saisie.", "erreur");
  }
  if (message.length < 10) {
    retour("Ton message est un peu court. Dis-m'en un peu plus.", "erreur");
  }

  const { html, texte: brut } = rendre({
    titre: `Message de ${nom}`,
    paragraphes: message.split("\n").filter(Boolean),
    lignes: [["Nom", nom], ["Email", email]],
    pied: ["Réponds directement à ce mail, la réponse arrivera chez elle."],
  });

  try {
    const { error } = await resend().emails.send({
      from: expediteur(),
      to: DESTINATAIRE,
      // La reponse part vers la cliente : Oriane repond sans recopier l'adresse.
      replyTo: email,
      subject: `Site — message de ${nom}`,
      html,
      text: brut,
    });
    if (error) throw new Error(error.message);
  } catch (erreur) {
    console.error("message de contact non envoyé :", erreur);
    retour(
      "Le message n'est pas parti. Écris directement à sbscoaching28@gmail.com, ça marchera.",
      "erreur",
    );
  }

  retour("Merci, ton message est parti. Oriane te répond vite.", "succes");
}
