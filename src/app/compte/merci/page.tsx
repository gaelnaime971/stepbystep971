import type { Metadata } from "next";
import Link from "next/link";
import { Bandeau } from "@/components/Bandeau";
import { lotsActifs, soldeTotal } from "@/lib/compte/lecture";
import { enDate } from "@/lib/dates";

export const metadata: Metadata = { title: "Merci — Step by Step" };

export default async function PageMerci() {
  const lots = await lotsActifs();
  const solde = soldeTotal(lots);

  return (
    <>
      <h2 className="mb-2">Merci</h2>
      <p className="mb-7 max-w-[62ch] text-plume-deep">
        Ton paiement est passé. Tes séances arrivent sur ton solde dans quelques
        secondes — Stripe nous prévient juste après l&apos;encaissement.
      </p>

      {solde > 0 ? (
        <div className="mb-7">
          <Bandeau ton="succes">
            Tu as {solde} séance{solde > 1 ? "s" : ""} à placer
            {lots[0] && `, à utiliser avant le ${enDate(lots[0].expires_at)}`}.
          </Bandeau>
        </div>
      ) : (
        <div className="mb-7">
          <Bandeau ton="attention">
            Ton solde n&apos;est pas encore à jour. Recharge la page dans un
            instant. S&apos;il ne bouge toujours pas, écris à Oriane : le
            paiement est bien passé de ton côté.
          </Bandeau>
        </div>
      )}

      <Link
        href="/compte"
        className="inline-flex items-center justify-center rounded-sm bg-framboise px-[22px] py-[13px] text-[15px] font-semibold text-white transition-colors hover:bg-framboise-deep"
      >
        Placer mes séances
      </Link>
    </>
  );
}
