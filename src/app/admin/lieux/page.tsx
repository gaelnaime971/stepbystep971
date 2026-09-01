import type { Metadata } from "next";
import { Bandeau } from "@/components/Bandeau";
import { Pastille } from "@/components/Pastille";
import { basculerLieu } from "@/lib/planning/actions";
import { tousLesLieux } from "@/lib/planning/lecture";
import { FormulaireLieu } from "./formulaire";

export const metadata: Metadata = { title: "Lieux — Step by Step" };

export default async function PageLieux({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; ton?: string }>;
}) {
  const { message, ton } = await searchParams;
  const lieux = await tousLesLieux();

  return (
    <>
      <div className="mb-[26px]">
        <h2>Lieux</h2>
        <p className="mt-1.5 max-w-[62ch] text-plume-deep">
          Un lieu fermé disparaît du choix à la création d&apos;un cours, mais
          les cours déjà programmés là-bas ne bougent pas. C&apos;est pour ça
          qu&apos;on ferme au lieu de supprimer.
        </p>
      </div>

      {message && (
        <div className="mb-6">
          <Bandeau ton={ton === "erreur" ? "erreur" : "succes"}>{message}</Bandeau>
        </div>
      )}

      <div className="grid items-start gap-5 lg:grid-cols-[1fr_360px]">
        <section className="rounded-md border border-sable bg-white p-[22px]">
          <h3 className="mb-4">Mes lieux</h3>
          {lieux.length === 0 && (
            <p className="py-8 text-center text-[15px] text-plume-deep">
              Aucun lieu. Ajoute-en un pour pouvoir créer des cours.
            </p>
          )}
          {lieux.map((l) => (
            <div
              key={l.id}
              className="flex items-center justify-between gap-3 border-b border-sable py-3.5 last:border-b-0"
            >
              <div>
                <div className="flex items-center gap-2.5">
                  <p className="text-[15px] font-medium">{l.name}</p>
                  {l.is_active ? (
                    <Pastille ton="dispo">Ouvert</Pastille>
                  ) : (
                    <Pastille ton="complet">Fermé</Pastille>
                  )}
                </div>
                <p className="text-[13px] text-plume-deep">
                  {[l.address, l.city].filter(Boolean).join(", ") || "Adresse non renseignée"}
                </p>
              </div>

              <form action={basculerLieu}>
                <input type="hidden" name="id" value={l.id} />
                <button
                  type="submit"
                  className="cursor-pointer rounded-sm border border-sable-deep bg-white px-4 py-2.5 text-sm font-semibold text-encre transition-colors hover:bg-sable"
                >
                  {l.is_active ? "Fermer" : "Rouvrir"}
                </button>
              </form>
            </div>
          ))}
        </section>

        <section className="rounded-md border border-sable bg-white p-[22px]">
          <h3 className="mb-5">Ajouter un lieu</h3>
          <FormulaireLieu />
        </section>
      </div>
    </>
  );
}
