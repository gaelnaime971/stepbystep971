import Link from "next/link";
import { BoutonAchat } from "@/components/BoutonAchat";
import { Marque } from "@/components/Marque";
import { accueilSelonRole, profilCourant } from "@/lib/auth/session";
import { formulesEnVente } from "@/lib/compte/lecture";
import { prixLisible } from "@/lib/formules/format";

/**
 * Accueil provisoire. La vitrine — planning public, formules, Oriane, la Team
 * Super Nana, la FAQ — est une etape a part entiere. Cette page n'existe pour
 * l'instant que pour donner une entree a l'authentification.
 */
export default async function PageAccueil() {
  const profil = await profilCourant();
  // Lecture publique : la policy plans_select_active laisse `anon` voir les
  // formules actives, et estAchetable() ecarte celles sans prix Stripe.
  const formules = await formulesEnVente();

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
            href="#formules"
            className="inline-flex items-center justify-center rounded-sm bg-framboise px-[22px] py-[13px] text-[15px] font-semibold text-white transition-colors hover:bg-framboise-deep"
          >
            Choisir ma formule
          </Link>
          <Link
            href="/inscription"
            className="inline-flex items-center justify-center rounded-sm border border-framboise px-[22px] py-[13px] text-[15px] font-semibold text-framboise transition-colors hover:bg-framboise-wash"
          >
            Rejoindre la team
          </Link>
        </div>
      </main>

      <section id="formules" className="border-t border-sable bg-white px-6 py-20">
        <div className="mx-auto max-w-shell">
          <h2>Choisis ta formule</h2>
          <p className="mt-3 max-w-[54ch] text-[17px] text-plume">
            Toutes les formules te créditent des séances. Tu les places ensuite
            où tu veux dans le planning, dans le lieu qui t&apos;arrange.
          </p>

          <div className="mt-9 grid grid-cols-[repeat(auto-fit,minmax(230px,1fr))] gap-4">
            {formules.map((f) => (
              <article
                key={f.id}
                className="flex flex-col rounded-md border border-sable bg-white p-[22px]"
              >
                <span className="text-[15px] text-plume">{f.name}</span>
                <span className="chiffre my-1.5 text-[42px] text-framboise">
                  {prixLisible(f.price_cents)}
                  {f.kind === "subscription" && (
                    <small className="ml-1.5 font-texte text-[15px] font-normal text-plume not-italic">
                      / 4 semaines
                    </small>
                  )}
                </span>
                <p className="mb-5 text-[15px] text-plume">
                  {f.cancellation_deadline_hours} h pour annuler une séance
                </p>
                <div className="mt-auto">
                  <BoutonAchat
                    slug={f.slug}
                    variante={f.kind === "subscription" ? "plein" : "ligne"}
                    libelle={f.kind === "subscription" ? "M'abonner" : "Je prends"}
                  />
                </div>
              </article>
            ))}
          </div>

          <p className="mt-6 text-[15px] text-plume">
            Pas encore de compte ? Le paiement te demandera de te connecter
            d&apos;abord.
          </p>
        </div>
      </section>
    </div>
  );
}
