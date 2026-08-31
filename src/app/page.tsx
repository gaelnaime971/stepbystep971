import Link from "next/link";
import { Marque } from "@/components/Marque";
import { accueilSelonRole, profilCourant } from "@/lib/auth/session";

/**
 * Accueil provisoire. La vitrine — planning public, formules, Oriane, la Team
 * Super Nana, la FAQ — est une etape a part entiere. Cette page n'existe pour
 * l'instant que pour donner une entree a l'authentification.
 */
export default async function PageAccueil() {
  const profil = await profilCourant();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="bg-encre px-6 py-3.5">
        <div className="mx-auto flex max-w-shell items-center justify-between gap-5">
          <Marque clair />
          <Link
            href={profil ? accueilSelonRole(profil.role) : "/connexion"}
            className="rounded-sm bg-framboise px-[14px] py-2 text-sm font-semibold text-white transition-colors hover:bg-framboise-deep"
          >
            Mon compte
          </Link>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-shell flex-1 flex-col justify-center px-6 py-20">
        <h1 className="max-w-[15ch]">
          Ne viens pas juste faire du sport,{" "}
          <span className="text-framboise">viens vivre une expérience</span>
        </h1>
        <p className="mt-5 max-w-[46ch] text-lg text-encre-soft">
          Des cours de step où chacune évolue à son rythme, sans pression.
          Bouger, se dépenser, et surtout prendre du plaisir.
        </p>
        <p className="mt-8 text-plume">
          Cours aux Abymes, au Moule et à Jarry.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/inscription"
            className="inline-flex items-center justify-center rounded-sm bg-framboise px-[22px] py-[13px] text-[15px] font-semibold text-white transition-colors hover:bg-framboise-deep"
          >
            Rejoindre la team
          </Link>
          <Link
            href="/connexion"
            className="inline-flex items-center justify-center rounded-sm border border-framboise px-[22px] py-[13px] text-[15px] font-semibold text-framboise transition-colors hover:bg-framboise-wash"
          >
            Se connecter
          </Link>
        </div>
      </main>
    </div>
  );
}
