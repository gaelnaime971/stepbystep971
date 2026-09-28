import type { Metadata } from "next";
import { Bandeau } from "@/components/Bandeau";
import { ChoixImage } from "@/components/charte/ChoixImage";
import { TexteCharte } from "@/components/charte/TexteCharte";
import { profilCourant } from "@/lib/auth/session";
import { signerCharte } from "@/lib/charte/actions";
import { etatCharte } from "@/lib/charte/lecture";
import { VERSION_CHARTE } from "@/lib/charte/texte";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "La charte — Step by Step" };

export default async function PageSignature({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; ton?: string; suite?: string }>;
}) {
  const { message, ton, suite } = await searchParams;
  const profil = await profilCourant();
  if (!profil) return null; // Le layout a deja redirige.

  // Deja signee : rien a demander. On n'enferme personne sur cette page.
  const etat = await etatCharte(profil.id);
  if (etat.signee) redirect("/compte");

  const destination = /^\/[a-zA-Z0-9/_-]*$/.test(suite ?? "") ? suite! : "/compte";

  return (
    <div className="mx-auto max-w-[760px]">
      {message && (
        <div className="mb-5">
          <Bandeau ton={ton === "erreur" ? "erreur" : "succes"}>{message}</Bandeau>
        </div>
      )}

      <h2 className="mb-2">
        {etat.version ? "La charte a changé" : "Avant de continuer"}
      </h2>
      <p className="mb-6 max-w-[58ch] text-[17px] text-plume-deep">
        {etat.version
          ? `Tu avais accepté la version ${etat.version}. En voici une nouvelle : relis-la, puis accepte-la pour retrouver ton espace.`
          : "Oriane a mis par écrit les règles de ses cours. Lis-les, puis accepte-les pour accéder à ton espace. C'est une seule fois."}
      </p>

      <div className="rounded-md border border-sable bg-white p-5 sm:p-8">
        <TexteCharte compacte />
      </div>

      <form
        action={signerCharte}
        className="mt-6 flex flex-col gap-6 rounded-md border border-sable bg-white p-5 sm:p-[26px]"
      >
        <input type="hidden" name="suite" value={destination} />

        <div>
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              name="reglement"
              className="mt-1 h-[18px] w-[18px] shrink-0 accent-framboise"
            />
            <span className="text-[15px] font-semibold">
              J&apos;ai lu la charte et j&apos;accepte le règlement
            </span>
          </label>
          <p className="mt-1.5 pl-[30px] text-[13px] text-plume-deep">
            Obligatoire pour réserver des cours. Version {VERSION_CHARTE}.
          </p>
        </div>

        {/* Le second consentement, SEPARE du premier et sans valeur par defaut.
            Les fusionner en une seule case viderait celui-ci de sa valeur. */}
        <div className="border-t border-sable pt-5">
          <ChoixImage />
        </div>

        <button
          type="submit"
          className="self-start cursor-pointer rounded-sm bg-framboise px-[22px] py-[15px] text-[15px] font-semibold text-white transition-colors hover:bg-framboise-deep sm:py-[13px]"
        >
          J&apos;accepte et je continue
        </button>
      </form>
    </div>
  );
}
