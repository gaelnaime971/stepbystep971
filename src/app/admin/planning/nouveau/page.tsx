import type { Metadata } from "next";
import Link from "next/link";
import { tousLesLieux } from "@/lib/planning/lecture";
import { aujourdHui } from "@/lib/planning/dates";
import { FormulaireCours } from "./formulaire";

export const metadata: Metadata = { title: "Créer un cours — Step by Step" };

export default async function PageNouveauCours({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date } = await searchParams;
  const lieux = (await tousLesLieux()).filter((l) => l.is_active);

  return (
    <>
      <p className="mb-4 text-[15px]">
        <Link href="/admin/planning" className="text-framboise-deep underline underline-offset-[3px]">
          Retour au planning
        </Link>
      </p>

      <h2 className="mb-2">Créer un cours</h2>
      <p className="mb-8 max-w-[62ch] text-plume">
        Les horaires sont ceux de la Guadeloupe. Une répétition crée toutes les
        séances d&apos;un coup, le même jour à la même heure.
      </p>

      {lieux.length === 0 ? (
        <div className="max-w-[520px] rounded-md border border-sable bg-white p-[22px]">
          <h3 className="mb-2">Aucun lieu ouvert</h3>
          <p className="mb-4 text-[15px] text-plume">
            Il faut au moins un lieu pour créer un cours.
          </p>
          <Link
            href="/admin/lieux"
            className="inline-flex items-center justify-center rounded-sm bg-framboise px-[22px] py-[13px] text-[15px] font-semibold text-white transition-colors hover:bg-framboise-deep"
          >
            Ajouter un lieu
          </Link>
        </div>
      ) : (
        <FormulaireCours
          lieux={lieux.map((l) => ({ valeur: l.id, libelle: l.name }))}
          dateParDefaut={date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : aujourdHui()}
        />
      )}
    </>
  );
}
