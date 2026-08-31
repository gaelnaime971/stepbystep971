import type { Metadata } from "next";
import Link from "next/link";
import { profilCourant } from "@/lib/auth/session";
import { formulesToutes } from "@/lib/formules/lecture";
import { etatPublication } from "@/lib/formules/types";

export const metadata: Metadata = { title: "Administration — Step by Step" };

function Kpi({ valeur, libelle }: { valeur: string; libelle: string }) {
  return (
    <div className="rounded-md border border-sable bg-white px-[18px] py-[17px]">
      <p className="chiffre text-[32px] leading-[1.1]">{valeur}</p>
      <p className="mt-1 text-sm text-plume">{libelle}</p>
    </div>
  );
}

export default async function PageAdmin() {
  const profil = await profilCourant();
  if (!profil) return null; // Le layout a deja redirige.

  const formules = await formulesToutes();
  const achetables = formules.filter((f) => etatPublication(f) === "publiee");
  const aPublier = formules.filter((f) => etatPublication(f) === "non_publiee");

  return (
    <>
      <div className="mb-[26px] flex flex-wrap items-start justify-between gap-5">
        <div>
          <h2>Bonjour {profil.first_name}</h2>
          <p className="mt-1.5 text-plume">
            Le planning, les clientes et les paiements arrivent ici.
          </p>
        </div>
      </div>

      <div className="mb-[30px] grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-3.5">
        <Kpi valeur={String(achetables.length)} libelle="Formules achetables" />
        <Kpi valeur={String(aPublier.length)} libelle="Formules à publier" />
        <Kpi valeur="—" libelle="Clientes actives" />
        <Kpi valeur="—" libelle="Encaissé ce mois" />
      </div>

      <section className="rounded-md border border-sable bg-white p-[22px]">
        <h3 className="mb-4">Ce qui est prêt</h3>
        <p className="text-[15px] text-plume">
          Tes formules se pilotent depuis{" "}
          <Link href="/admin/formules" className="text-framboise-deep underline underline-offset-[3px]">
            Formules et tarifs
          </Link>
          . Le planning des cours et les fiches clientes arrivent ensuite.
        </p>
      </section>
    </>
  );
}
