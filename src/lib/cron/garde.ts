import { NextResponse, type NextRequest } from "next/server";

/**
 * Protege une route de cron.
 *
 * Vercel Cron envoie `Authorization: Bearer <CRON_SECRET>`. Sans ce controle,
 * n'importe qui pourrait declencher le balayage d'expiration ou provoquer un
 * envoi d'emails en masse.
 *
 * La comparaison est a temps constant : une comparaison naive laisse fuir la
 * longueur du prefixe correct, ce qui suffit a retrouver un secret a force
 * d'essais.
 */
export function refuserSiPasLeCron(requete: NextRequest): NextResponse | null {
  const attendu = process.env.CRON_SECRET;
  if (!attendu) {
    console.error("CRON_SECRET absente : route de cron refusée");
    return NextResponse.json({ erreur: "cron non configuré" }, { status: 500 });
  }

  const recu = requete.headers.get("authorization") ?? "";
  const bon = `Bearer ${attendu}`;

  if (recu.length !== bon.length) {
    return NextResponse.json({ erreur: "non autorisé" }, { status: 401 });
  }
  let ecart = 0;
  for (let i = 0; i < bon.length; i++) ecart |= recu.charCodeAt(i) ^ bon.charCodeAt(i);
  if (ecart !== 0) {
    return NextResponse.json({ erreur: "non autorisé" }, { status: 401 });
  }

  return null;
}
