/**
 * L'URL publique du site, en un seul endroit.
 *
 * Elle etait construite a quatre endroits, avec trois replis differents —
 * « http://localhost:3000 » deux fois, et une chaine vide pour l'URL de retour
 * du portail Stripe, ce qui produisait un lien relatif que Stripe refuse.
 *
 * Le repli silencieux est le vrai danger : en production il ne casse rien
 * visiblement, il envoie simplement des liens morts vers localhost dans les
 * emails des clientes. Personne ne le voit avant qu'une cliente le signale.
 * D'ou l'echec bruyant.
 */
export function urlDuSite(): string {
  const brut = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  const enProduction = process.env.NODE_ENV === "production";

  if (!brut) {
    if (enProduction) {
      throw new Error(
        "NEXT_PUBLIC_SITE_URL est absente. Sans elle, les liens des emails et " +
          "les URL de retour Stripe pointeraient vers localhost.",
      );
    }
    console.warn(
      "NEXT_PUBLIC_SITE_URL absente : repli sur http://localhost:3000 (développement).",
    );
    return "http://localhost:3000";
  }

  if (!/^https?:\/\//.test(brut)) {
    throw new Error(
      `NEXT_PUBLIC_SITE_URL doit commencer par http:// ou https:// (reçu : « ${brut.slice(0, 24)}… »).`,
    );
  }

  if (enProduction && brut.startsWith("http://")) {
    throw new Error(
      `NEXT_PUBLIC_SITE_URL est en http:// en production (« ${brut} »). ` +
        "Stripe refuse une URL de retour non chiffrée, et les liens des emails doivent être en https.",
    );
  }

  return brut.replace(/\/$/, "");
}
