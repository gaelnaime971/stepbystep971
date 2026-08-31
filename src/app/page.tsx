import type { Metadata } from "next";
import Link from "next/link";
import { BoutonAchat } from "@/components/BoutonAchat";
import { Marque } from "@/components/Marque";
import { Pastille } from "@/components/Pastille";
import { Faq } from "@/components/vitrine/Faq";
import { NavVitrine } from "@/components/vitrine/Nav";
import { accueilSelonRole, profilCourant } from "@/lib/auth/session";
import { coursAVenir, lieux } from "@/lib/compte/lecture";
import { enCreneau, enDate, enJourCourt } from "@/lib/dates";
import { prixLisible, validiteLisible } from "@/lib/formules/format";
import { COLONNES_FORMULE, estAchetable, type Formule } from "@/lib/formules/types";
import { clientServeur } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Step by Step Coaching — cours de step en Guadeloupe",
  description:
    "Des cours de step aux Abymes, au Moule et à Jarry. Achète tes séances, place-les toi-même dans le planning.",
};

/** Toutes les formules en vente, avec leurs puces. Lecture publique. */
async function formulesVitrine(): Promise<Formule[]> {
  const supabase = await clientServeur();
  const { data } = await supabase
    .from("plans")
    .select(COLONNES_FORMULE)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .returns<Formule[]>();

  return (data ?? []).filter(estAchetable);
}

function placesLisibles(restantes: number) {
  if (restantes <= 0) return { texte: "Complet", ton: "complet" as const };
  if (restantes <= 3)
    return { texte: `${restantes} place${restantes > 1 ? "s" : ""}`, ton: "bientot" as const };
  return { texte: `${restantes} places`, ton: "dispo" as const };
}

export default async function PageAccueil() {
  const [profil, cours, nomsLieux, formules] = await Promise.all([
    profilCourant(),
    coursAVenir(8),
    lieux(),
    formulesVitrine(),
  ]);

  const destinationCompte = profil ? accueilSelonRole(profil.role) : "/connexion";
  const semaine = cours.slice(0, 4);
  const bornes =
    semaine.length > 0
      ? `Du ${enDate(semaine[0].starts_at)} au ${enDate(semaine.at(-1)!.starts_at)}`
      : null;

  return (
    <>
      <NavVitrine destinationCompte={destinationCompte} />

      {/* Hero ------------------------------------------------------------ */}
      <header className="relative overflow-hidden bg-encre">
        {/* La photo d'Oriane viendra ici, en fond plein cadre. En attendant,
            l'aplat sombre de la maquette tient la place sans mentir. */}
        <div aria-hidden="true" className="absolute inset-0 bg-[#262023]" />
        <div aria-hidden="true" className="absolute inset-0 bg-[rgba(15,12,14,.62)]" />

        <div className="relative mx-auto max-w-shell px-6 pt-[92px] pb-[84px]">
          <h1 className="max-w-[15ch] text-white">
            Ne viens pas juste faire du sport,{" "}
            <span className="text-framboise">viens vivre une expérience</span>
          </h1>
          <p className="mt-5 max-w-[46ch] text-lg text-[#D6D2D4]">
            Des cours de step où chacune évolue à son rythme, sans pression.
            Bouger, se dépenser, et surtout prendre du plaisir.
          </p>
          <div className="mt-[30px] flex flex-wrap gap-3">
            <Link
              href="#formules"
              className="inline-flex items-center justify-center rounded-sm bg-framboise px-[22px] py-[13px] text-[15px] font-semibold text-white transition-colors hover:bg-framboise-deep"
            >
              Choisir ma formule
            </Link>
            <Link
              href="#planning"
              className="inline-flex items-center justify-center rounded-sm border border-white/40 px-[22px] py-[13px] text-[15px] font-semibold text-white transition-colors hover:bg-white/10"
            >
              Voir le planning
            </Link>
          </div>
          <p className="mt-[34px] text-[15px] text-[#9A9096]">
            Cours aux Abymes, au Moule et à Jarry
          </p>
        </div>
      </header>

      {/* Le planning, en surimpression comme dans la maquette ------------- */}
      <section id="planning" className="bg-encre pb-[34px]">
        <div className="mx-auto max-w-shell px-6">
          <div className="relative z-[5] mb-[-40px] rounded-lg bg-white p-6 shadow-[0_18px_40px_rgba(27,27,29,.14)] md:mb-[-60px]">
            <div className="mb-[18px] flex flex-wrap items-baseline justify-between gap-4">
              <h3>Les cours de la semaine</h3>
              {bornes && <span className="text-[13px] text-plume">{bornes}</span>}
            </div>

            {semaine.length === 0 ? (
              <p className="py-6 text-[15px] text-plume">
                Le planning de la semaine arrive. Reviens dans un moment, ou
                crée ton compte pour être prête à réserver.
              </p>
            ) : (
              <div className="grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-3">
                {semaine.map((c) => {
                  const places = placesLisibles(c.capacity - c.seats_taken);
                  return (
                    <div
                      key={c.id}
                      className="flex flex-col gap-[7px] rounded-md border border-sable p-[15px]"
                    >
                      <span className="font-display text-[17px] font-semibold italic first-letter:uppercase">
                        {enJourCourt(c.starts_at)}
                      </span>
                      <span className="text-sm text-plume">
                        {nomsLieux.get(c.location_id) ?? "Lieu à préciser"},{" "}
                        {enCreneau(c.starts_at, c.ends_at)}
                      </span>
                      <span>
                        <Pastille ton={places.ton}>{places.texte}</Pastille>
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            <p className="mt-4 text-[13px] text-plume">
              Crée ton compte pour réserver ta place.
            </p>
          </div>
        </div>
      </section>

      {/* Les formules ---------------------------------------------------- */}
      <section id="formules" className="px-6 py-24">
        <div className="mx-auto max-w-shell">
          <div className="mb-[34px] max-w-[54ch]">
            <h2>Choisis ta formule</h2>
            <p className="mt-3 text-[17px] text-plume">
              Toutes les formules te créditent des séances. Tu les places
              ensuite où tu veux dans le planning, dans le lieu qui t&apos;arrange.
            </p>
          </div>

          <div className="grid grid-cols-[repeat(auto-fit,minmax(230px,1fr))] gap-4">
            {formules.map((f) => (
              <article
                key={f.id}
                className={`flex flex-col rounded-md bg-white p-[22px] ${
                  f.is_highlighted ? "border-2 border-framboise" : "border border-sable"
                }`}
              >
                {f.is_highlighted && (
                  <span className="mb-2.5 self-start">
                    <Pastille ton="rose">Le plus choisi</Pastille>
                  </span>
                )}
                <span className="text-[15px] text-plume">{f.name}</span>
                <span className="chiffre mt-1.5 mb-0.5 text-[42px] text-framboise">
                  {prixLisible(f.price_cents)}
                  {f.kind === "subscription" && (
                    <small className="ml-1.5 font-texte text-[15px] font-normal text-plume not-italic">
                      / 4 semaines
                    </small>
                  )}
                  {f.compare_at_price_cents && (
                    <span className="ml-2 font-texte text-base font-normal text-sable-deep line-through not-italic">
                      {prixLisible(f.compare_at_price_cents)}
                    </span>
                  )}
                </span>

                <ul className="my-4 flex list-none flex-col gap-2.5 p-0">
                  {(f.features.length > 0
                    ? f.features
                    : [
                        `${f.sessions_count} séance${f.sessions_count > 1 ? "s" : ""}`,
                        `Valable ${validiteLisible(f.validity_interval)}`,
                      ]
                  ).map((puce) => (
                    <li key={puce} className="relative pl-[22px] text-[15px]">
                      <span
                        aria-hidden="true"
                        className="absolute top-[9px] left-0 h-0.5 w-2.5 bg-framboise"
                      />
                      {puce}
                    </li>
                  ))}
                </ul>

                <div className="mt-auto">
                  <BoutonAchat
                    slug={f.slug}
                    variante={f.is_highlighted ? "plein" : "ligne"}
                    libelle={f.kind === "subscription" ? "M'abonner" : "Je prends"}
                  />
                </div>
              </article>
            ))}
          </div>

          <p className="mt-5 text-[15px] text-plume">
            Paiement par carte, sécurisé par Stripe. Tu pourras entrer un code
            promo à l&apos;étape suivante. Pas encore de compte ? Le paiement te
            demandera de te connecter d&apos;abord.
          </p>
        </div>
      </section>

      {/* Oriane ---------------------------------------------------------- */}
      <section
        id="oriane"
        className="border-y border-sable bg-white px-6 py-24"
      >
        <div className="mx-auto grid max-w-shell items-center gap-[46px] lg:grid-cols-2">
          <div className="flex aspect-[4/5] items-center justify-center rounded-lg bg-sable p-5 text-center text-sm text-plume">
            Photo d&apos;Oriane
          </div>
          <div>
            <h2>Hello, moi c&apos;est Oriane</h2>
            <p className="mt-4 max-w-[46ch] text-[17px] text-encre-soft">
              Diplômée en éducation physique et sportive, je donne des cours de
              step depuis 2022. Mon truc, c&apos;est de rendre le sport
              épanouissant et ludique.
            </p>
            <p className="mt-4 max-w-[46ch] text-[17px] text-encre-soft">
              Pas besoin d&apos;être experte pour venir. Chacune évolue à son
              rythme, sans pression, avec un seul objectif : bouger, se dépenser
              et prendre du plaisir.
            </p>
            <p className="mt-[22px] font-display text-[22px] font-bold italic text-framboise">
              Ta Super Nana
            </p>
          </div>
        </div>
      </section>

      {/* La Team Super Nana ---------------------------------------------- */}
      <section id="team" className="bg-encre px-6 py-24 text-white">
        <div className="mx-auto max-w-shell">
          <h2 className="text-white">La Team Super Nana</h2>
          <p className="mt-3.5 max-w-[48ch] text-[17px] text-[#C4BEC1]">
            Un cours de step, c&apos;est une heure. La team, c&apos;est ce qui
            reste après. On s&apos;encourage, on rigole, et on se retrouve chaque
            année à la Fitness Academy.
          </p>

          <div className="mt-[34px] grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3">
            {[
              "Photo de groupe — Fitness Academy",
              "Cours au studio",
              "Ambiance en salle",
              "Portrait participante",
            ].map((legende, i) => (
              <div
                key={legende}
                className={`flex items-center justify-center rounded-md bg-[#2C2A2C] p-3 text-center text-[13px] text-[#7E767B] ${
                  i === 0 ? "col-span-2 aspect-[3/2]" : "aspect-[3/4]"
                }`}
              >
                {legende}
              </div>
            ))}
          </div>

          <div className="mt-[34px]">
            <Link
              href="/inscription"
              className="inline-flex items-center justify-center rounded-sm bg-framboise px-[22px] py-[13px] text-[15px] font-semibold text-white transition-colors hover:bg-framboise-deep"
            >
              Rejoindre la team
            </Link>
          </div>
        </div>
      </section>

      {/* FAQ ------------------------------------------------------------- */}
      <section className="px-6 py-24">
        <div className="mx-auto max-w-[820px]">
          <h2 className="mb-[22px]">Les questions qu&apos;on me pose</h2>
          <Faq />
        </div>
      </section>

      {/* Pied ------------------------------------------------------------ */}
      <footer className="bg-encre px-6 pt-[46px] pb-[30px] text-sm text-[#9A9096]">
        <div className="mx-auto max-w-shell">
          <div className="flex flex-wrap justify-between gap-[26px]">
            <div>
              <p className="mb-3">
                <Marque clair />
              </p>
              <p>
                Cours de step en Guadeloupe
                <br />
                Les Abymes, Le Moule, Jarry
              </p>
            </div>
            <div>
              {[
                ["#planning", "Le planning"],
                ["#formules", "Les formules"],
                [destinationCompte, "Mon compte"],
              ].map(([href, libelle]) => (
                <Link key={libelle} href={href} className="mb-2 block text-[#C4BEC1]">
                  {libelle}
                </Link>
              ))}
            </div>
            <div>
              <a href="mailto:sbscoaching28@gmail.com" className="mb-2 block text-[#C4BEC1]">
                sbscoaching28@gmail.com
              </a>
            </div>
          </div>
          <p className="mt-[30px] border-t border-[#343133] pt-[18px]">
            Step by Step Coaching — Siret 915 127 534 00013.
          </p>
        </div>
      </footer>
    </>
  );
}
