import type { Metadata } from "next";
import { Bandeau } from "@/components/Bandeau";
import { Champ } from "@/components/Champ";
import { modifierProfil } from "@/lib/compte/actions";
import Link from "next/link";
import { profilCourant } from "@/lib/auth/session";
import { ChoixImage } from "@/components/charte/ChoixImage";
import { changerAutorisationImage } from "@/lib/charte/actions";
import { etatCharte } from "@/lib/charte/lecture";
import { enDateAnnee } from "@/lib/dates";

export const metadata: Metadata = { title: "Mon profil — Step by Step" };

export default async function PageProfil({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; ton?: string }>;
}) {
  const { message, ton } = await searchParams;
  const profil = await profilCourant();
  if (!profil) return null; // Le layout a deja redirige.

  const charte = await etatCharte(profil.id);

  return (
    <>
      {message && (
        <div className="mb-5">
          <Bandeau ton={ton === "erreur" ? "erreur" : "succes"}>{message}</Bandeau>
        </div>
      )}

      <h2 className="mb-6">Mon profil</h2>

      <section className="max-w-[520px] rounded-md border border-sable bg-white p-[22px]">
        <form action={modifierProfil} className="flex flex-col gap-5">
          <div className="grid grid-cols-2 gap-4">
            <Champ nom="prenom" libelle="Prénom" valeurParDefaut={profil.first_name}
              autoComplete="given-name" />
            <Champ nom="nom" libelle="Nom" valeurParDefaut={profil.last_name}
              autoComplete="family-name" />
          </div>
          <Champ nom="telephone" libelle="Téléphone" type="tel" requis={false}
            valeurParDefaut={profil.phone ?? ""} autoComplete="tel"
            aide="Pour te joindre si un cours est annulé." />

          <div>
            <span className="mb-1.5 block text-sm font-semibold">Email</span>
            <div className="rounded-sm border border-sable-deep bg-sable px-[13px] py-[11px] text-[15px] text-plume-deep">
              {profil.email}
            </div>
            <p className="mt-1.5 text-[13px] text-plume-deep">
              Ton email sert à te connecter. Pour en changer, écris à Oriane.
            </p>
          </div>

          <button
            type="submit"
            className="inline-flex cursor-pointer items-center justify-center rounded-sm bg-framboise px-[22px] py-[13px] text-[15px] font-semibold text-white transition-colors hover:bg-framboise-deep"
          >
            J&apos;enregistre
          </button>
        </form>
      </section>

      {/* La charte reste consultable, et le choix d'image modifiable DANS LES
          DEUX SENS a tout moment : l'article 7.4 le prevoit expressement. */}
      <section className="mt-5 max-w-[520px] rounded-md border border-sable bg-white p-[22px]">
        <h3 className="mb-1">La charte</h3>
        <p className="mb-4 text-[13px] text-plume-deep">
          {charte.signeeLe
            ? `Acceptée le ${enDateAnnee(charte.signeeLe)} — version ${charte.version}.`
            : "Pas encore acceptée."}{" "}
          <Link href="/charte" className="text-framboise-deep underline underline-offset-[3px]">
            La relire
          </Link>
        </p>

        <form action={changerAutorisationImage} className="flex flex-col gap-4 border-t border-sable pt-4">
          <ChoixImage valeur={charte.autorisationImage} legende="Mon image" />
          {charte.imageDecideeLe && (
            <p className="text-[13px] text-plume-deep">
              Ton choix actuel date du {enDateAnnee(charte.imageDecideeLe)}. Tu peux
              en changer autant de fois que tu veux.
            </p>
          )}
          <button
            type="submit"
            className="self-start cursor-pointer rounded-sm border border-sable-deep bg-white px-[18px] py-3 text-sm font-semibold text-encre transition-colors hover:bg-sable sm:py-2.5"
          >
            J&apos;enregistre ce choix
          </button>
        </form>
      </section>
    </>
  );
}
