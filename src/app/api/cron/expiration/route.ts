import { NextResponse, type NextRequest } from "next/server";
import { refuserSiPasLeCron } from "@/lib/cron/garde";
import { clientService } from "@/lib/supabase/service";

/**
 * Balayage nocturne d'expiration.
 *
 * PURE COMPTABILITE. L'expiration est deja appliquee par le WHERE de toute
 * requete de solde et de reservation : meme si ce cron ne tourne jamais, une
 * seance echue est inutilisable. Ce passage sert a equilibrer le grand livre
 * et a alimenter l'historique.
 *
 * Il tourne APRES les alertes : previenir d'abord, solder ensuite.
 */
export async function GET(requete: NextRequest) {
  const refus = refuserSiPasLeCron(requete);
  if (refus) return refus;

  const { data, error } = await clientService().rpc("expire_credit_lots");

  if (error) {
    console.error("expire_credit_lots en échec :", error.message);
    return NextResponse.json({ erreur: error.message }, { status: 500 });
  }

  return NextResponse.json({ lots_soldes: data ?? 0 });
}
