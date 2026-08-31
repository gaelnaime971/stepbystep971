import { NextResponse, type NextRequest } from "next/server";
import { refuserSiPasLeCron } from "@/lib/cron/garde";
import { clientService } from "@/lib/supabase/service";
import { envoyer } from "@/lib/emails/envoyer";
import { alerteExpiration } from "@/lib/emails/modeles";
import { joursRestants } from "@/lib/dates";

type LotMenace = {
  user_id: string;
  email: string;
  first_name: string;
  credit_lot_id: string;
  quantity_remaining: number;
  expires_at: string;
};

const JOURS_PAR_DEFAUT = 3;

/**
 * Alerte de fin de validite.
 *
 * lots_expiring_soon() ecarte deja les lots dont l'alerte est partie ; l'index
 * unique partiel email_log_one_expiry_warning_per_lot est le vrai garde-fou si
 * deux executions se chevauchent.
 *
 * Les envois sont marques reessayables : si Resend est indisponible, la place
 * est rendue et l'execution du lendemain reprendra le lot. Perdre l'alerte
 * serait pire qu'un doublon improbable — la cliente perdrait ses seances sans
 * avoir ete prevenue.
 */
export async function GET(requete: NextRequest) {
  const refus = refuserSiPasLeCron(requete);
  if (refus) return refus;

  const jours = Number(process.env.EXPIRY_WARNING_DAYS ?? JOURS_PAR_DEFAUT);
  const base = clientService();

  const { data, error } = await base.rpc("lots_expiring_soon", {
    p_days: Number.isFinite(jours) && jours > 0 ? jours : JOURS_PAR_DEFAUT,
  });

  if (error) {
    console.error("lots_expiring_soon en échec :", error.message);
    return NextResponse.json({ erreur: error.message }, { status: 500 });
  }

  const lots = (data ?? []) as LotMenace[];
  let envoyes = 0;
  let deja = 0;
  let echecs = 0;

  for (const lot of lots) {
    const { objet, contenu } = alerteExpiration({
      prenom: lot.first_name,
      seances: lot.quantity_remaining,
      expire: lot.expires_at,
      joursRestants: joursRestants(lot.expires_at),
    });

    const r = await envoyer({
      modele: "expiry_warning",
      userId: lot.user_id,
      destinataire: lot.email,
      objet,
      contenu,
      liens: { credit_lot_id: lot.credit_lot_id },
      reessayable: true,
    });

    if (r.etat === "envoye") envoyes++;
    else if (r.etat === "deja_envoye") deja++;
    else echecs++;
  }

  return NextResponse.json({ candidats: lots.length, envoyes, deja, echecs });
}
