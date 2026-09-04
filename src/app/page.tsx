import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { BoutonAchat } from "@/components/BoutonAchat";
import { Logo } from "@/components/Logo";
import { Pastille } from "@/components/Pastille";
import { PedagogieFormule } from "@/components/PedagogieFormule";
import { Faq } from "@/components/vitrine/Faq";
import { NavVitrine } from "@/components/vitrine/Nav";
import { accueilSelonRole, profilCourant } from "@/lib/auth/session";
import { coursAVenir, lieux } from "@/lib/compte/lecture";
import { enCreneau, enDate, enJourCourt } from "@/lib/dates";
import { prixLisible, validiteLisible } from "@/lib/formules/format";
import { COLONNES_FORMULE, estAchetable, type Formule } from "@/lib/formules/types";
import { libelleNiveau } from "@/lib/niveaux";
import { clientServeur } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Step by Step Coaching — cours de Fitness Step en Guadeloupe",
  description:
    "Des cours de Fitness Step aux Abymes, au Moule et à Jarry. Achète tes séances, place-les toi-même dans le planning depuis ton compte.",
};

async function formulesVitrine(): Promise<Formule[]> {
  const supabase = await clientServeur();
  const { data } = await supabase
    .from("plans").select(COLONNES_FORMULE).eq("is_active", true)
    .order("sort_order", { ascending: true }).returns<Formule[]>();
  return (data ?? []).filter(estAchetable);
}

function places(restantes: number) {
  if (restantes <= 0) return { texte: "Complet", ton: "complet" as const };
  if (restantes <= 3) return { texte: `${restantes} place${restantes > 1 ? "s" : ""}`, ton: "bientot" as const };
  return { texte: `${restantes} places`, ton: "dispo" as const };
}

const GALERIE = [
  { src: "/groupe4.jpg", alt: "La Team Super Nana au grand complet à la Fitness Academy, une cinquantaine de personnes en tenue noire, bras levés sur la pelouse, le soir", large: true, w: 1600, h: 1066 },
  { src: "/groupe5.jpg", alt: "Le même groupe en tenues colorées et bandeaux fluo, serré pour la photo de fin de soirée", large: true, w: 1600, h: 1066 },
  { src: "/groupe2.JPG", alt: "Oriane sur son step, index levé, au milieu d'un cours dans la salle au sol vert", large: false, w: 854, h: 1280 },
  { src: "/groupe3.JPG", alt: "Un cours en pleine chorégraphie, bras levés, chacune sur son step", large: false, w: 854, h: 1280 },
  { src: "/oriane3.JPG", alt: "Oriane en plein cours du soir, souriante, entourée de sa communauté", large: false, w: 854, h: 1280 },
  // En 16/9, la plus panoramique des six. En cellule portrait, le recadrage
  // centre tombe sur le podium et garde la foule derriere.
  { src: "/groupe6.jpg", alt: "Un cours géant en plein air : plusieurs centaines de participants face à la coach sur son podium, sous les chapiteaux blancs", large: false, w: 1600, h: 900 },
];

export default async function PageAccueil() {
  const [profil, cours, nomsLieux, formules] = await Promise.all([
    profilCourant(), coursAVenir(8), lieux(), formulesVitrine(),
  ]);

  const destinationCompte = profil ? accueilSelonRole(profil.role) : "/connexion";
  const semaine = cours.slice(0, 4);
  const bornes = semaine.length > 0
    ? `Du ${enDate(semaine[0].starts_at)} au ${enDate(semaine.at(-1)!.starts_at)}`
    : null;

  return (
    <>
      <NavVitrine destinationCompte={destinationCompte} connectee={!!profil} />

      {/* Hero ------------------------------------------------------------ */}
      <header id="contenu" className="relative overflow-hidden bg-encre">
        {/* La video est muette, en boucle et sans controle : c'est une texture,
            pas un contenu. `poster` evite l'aplat noir avant chargement, et
            prefers-reduced-motion la remplace par cette meme image fixe. */}
        <video
          className="absolute inset-0 h-full w-full object-cover motion-reduce:hidden"
          poster="/hero-poster.jpg"
          autoPlay muted loop playsInline preload="metadata"
          aria-hidden="true" tabIndex={-1}
        >
          <source src="/hero.mp4" type="video/mp4" />
        </video>
        <div
          aria-hidden="true"
          className="absolute inset-0 hidden bg-[url('/hero-poster.jpg')] bg-cover bg-center motion-reduce:block"
        />
        <div aria-hidden="true" className="absolute inset-0 bg-[rgba(15,12,14,.66)]" />

        <div className="relative mx-auto max-w-shell px-5 pt-16 pb-20 sm:px-6 sm:pt-[92px] sm:pb-[84px]">
          <h1 className="max-w-[15ch] text-balance text-white">
            Ne viens pas juste faire du sport,{" "}
            <span className="text-framboise">viens vivre une expérience !</span>
          </h1>
          <p className="mt-5 max-w-[46ch] text-[17px] text-[#D6D2D4] sm:text-lg">
            Des cours de Fitness Step dans lesquels chacun.e évolue à son
            rythme… Objectif : bouger, se dépenser et surtout, prendre du
            plaisir.
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Link href="#formules"
              className="inline-flex items-center justify-center rounded-sm bg-framboise px-[22px] py-[15px] text-[15px] font-semibold text-white transition-colors hover:bg-framboise-deep sm:py-[13px]">
              Choisir ma formule
            </Link>
            <Link href="#planning"
              className="inline-flex items-center justify-center rounded-sm border border-white/40 px-[22px] py-[15px] text-[15px] font-semibold text-white transition-colors hover:bg-white/10 sm:py-[13px]">
              Voir le planning
            </Link>
          </div>
          <p className="mt-8 text-[15px] text-[#9A9096]">
            Retrouve mes cours à la salle Ladies (Abymes), à la salle Reborn
            Gym (Le Moule) et à la salle Infinity Fit (Jarry).
          </p>
        </div>
      </header>

      {/* Le planning ----------------------------------------------------- */}
      <section id="planning" className="scroll-mt-16 bg-encre pb-8 sm:pb-[34px]">
        <div className="mx-auto max-w-shell px-5 sm:px-6">
          <div className="relative z-[5] mb-[-32px] rounded-lg bg-white p-5 shadow-[0_18px_40px_rgba(27,27,29,.14)] sm:mb-[-60px] sm:p-6">
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
              <h3>Les cours de la semaine</h3>
              {bornes && <span className="text-[13px] text-plume-deep">{bornes}</span>}
            </div>

            {semaine.length === 0 ? (
              <p className="py-6 text-[15px] text-plume-deep">
                Le planning de la semaine arrive. Reviens dans un moment, ou crée
                ton compte pour être prête à réserver.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {semaine.map((c) => {
                  const p = places(c.capacity - c.seats_taken);
                  return (
                    <div key={c.id} className="flex flex-col gap-[7px] rounded-md border border-sable p-4">
                      <span className="font-display text-[17px] font-semibold italic first-letter:uppercase">
                        {enJourCourt(c.starts_at)}
                      </span>
                      <span className="text-sm text-plume-deep">
                        {nomsLieux.get(c.location_id) ?? "Lieu à préciser"},{" "}
                        {enCreneau(c.starts_at, c.ends_at)}
                      </span>
                      <span className="flex flex-wrap gap-2">
                        <Pastille ton={p.ton}>{p.texte}</Pastille>
                        <Pastille ton="neutre">{libelleNiveau(c.level)}</Pastille>
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            <p className="mt-4 text-[13px] text-plume-deep">
              Crée ton compte pour réserver ta place.
            </p>
          </div>
        </div>
      </section>

      {/* Les formules ---------------------------------------------------- */}
      <section id="formules" className="scroll-mt-16 px-5 pt-16 pb-16 sm:px-6 sm:pt-24 sm:pb-24">
        <div className="mx-auto max-w-shell">
          <div className="mb-8 max-w-[54ch] sm:mb-[34px]">
            <h2>Choisis ta formule</h2>
            <p className="mt-3 text-[17px] text-plume-deep">
              Toutes les formules te créditent des séances. Tu les places ensuite
              où tu veux sur le planning, dans la salle qui te convient.
            </p>
          </div>

          {formules.length === 0 ? (
            <div className="rounded-md border border-sable bg-white p-6 text-[15px] text-plume-deep">
              Les formules ne sont pas encore en ligne. Écris à Oriane, elle te
              dira comment prendre ta première séance.{" "}
              <Link href="/contact" className="text-framboise-deep underline underline-offset-[3px]">
                La contacter
              </Link>
              .
            </div>
          ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {formules.map((f) => (
              <article key={f.id}
                className={`flex flex-col rounded-md bg-white p-5 sm:p-[22px] ${
                  f.is_highlighted ? "border-2 border-framboise" : "border border-sable"
                }`}>
                {f.is_highlighted && (
                  <span className="mb-2.5 self-start"><Pastille ton="rose">Le plus choisi</Pastille></span>
                )}
                <span className="text-[15px] text-plume-deep">{f.name}</span>
                <span className="chiffre mt-1.5 mb-0.5 text-[38px] text-framboise sm:text-[42px]">
                  {prixLisible(f.price_cents)}
                  {f.kind === "subscription" && (
                    <small className="ml-1.5 font-texte text-[15px] font-normal text-plume-deep not-italic">
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
                    : [`${f.sessions_count} séance${f.sessions_count > 1 ? "s" : ""}`,
                       `Valable ${validiteLisible(f.validity_interval)}`]
                  ).map((puce) => (
                    <li key={puce} className="relative pl-[22px] text-[15px]">
                      <span aria-hidden="true" className="absolute top-[9px] left-0 h-0.5 w-2.5 bg-framboise" />
                      {puce}
                    </li>
                  ))}
                </ul>

                <div className="mt-auto">
                  <BoutonAchat slug={f.slug}
                    variante={f.is_highlighted ? "plein" : "ligne"}
                    libelle={f.kind === "subscription" ? "M'abonner" : "Je prends"} />
                  <PedagogieFormule
                    kind={f.kind}
                    seances={f.sessions_count}
                    validite={f.validity_interval}
                    delaiHeures={f.cancellation_deadline_hours}
                  />
                </div>
              </article>
            ))}
          </div>
          )}

          <p className="mt-6 max-w-[68ch] text-[15px] text-plume-deep">
            Paiement par carte, sécurisé par Stripe. Pas encore de compte ? Le
            paiement te demandera de te connecter d&apos;abord.
          </p>
        </div>
      </section>

      {/* Oriane ---------------------------------------------------------- */}
      <section id="oriane" className="scroll-mt-16 border-y border-sable bg-white px-5 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto grid max-w-shell items-center gap-8 lg:grid-cols-2 lg:gap-[46px]">
          <Image
            src="/oriane1.JPG"
            alt="Oriane devant un mur de briques, bras levé, en tenue de sport, souriante"
            width={854} height={1280}
            sizes="(min-width: 1024px) 520px, 100vw"
            className="h-auto w-full rounded-lg object-cover"
          />
          <div>
            <h2>Hello, moi c&apos;est Oriane !</h2>
            <p className="mt-4 max-w-[46ch] text-[17px] text-encre-soft">
              Diplômée en Éducation Physique et Sportive, je donne des cours de
              Fitness Step depuis 2022. Mon ambition est de rendre votre pratique
              sportive épanouissante et ludique.
            </p>
            <p className="mt-4 max-w-[46ch] text-[17px] text-encre-soft">
              Pas besoin d&apos;être expert.e pour participer. Chacun.e évolue à
              son rythme, sans pression, avec un seul objectif : bouger, se
              dépenser et prendre du plaisir.
            </p>
            <p className="mt-[22px] font-display text-[22px] font-bold italic text-framboise">
              Ta Super Nana
            </p>
          </div>
        </div>
      </section>

      {/* La Team --------------------------------------------------------- */}
      <section id="team" className="scroll-mt-16 bg-encre px-5 py-16 text-white sm:px-6 sm:py-24">
        <div className="mx-auto max-w-shell">
          <h2 className="text-white">La Team Super Nana</h2>
          <p className="mt-3.5 max-w-[48ch] text-[17px] text-[#C4BEC1]">
            Le Fitness Step, c&apos;est notre rendez-vous sportif quotidien. La
            Team Super Nana, c&apos;est notre énergie, nos fous rires, nos
            encouragements et notre complicité. Et chaque année, on se retrouve à
            la Fitness Academy pour continuer à faire vivre cette belle aventure !
          </p>

          <div className="mt-8 grid grid-cols-2 gap-3 sm:mt-[34px] lg:grid-cols-4">
            {GALERIE.map((photo) => (
              <div key={photo.src}
                className={`relative overflow-hidden rounded-md bg-[#2C2A2C] ${
                  photo.large ? "col-span-2 aspect-[3/2]" : "aspect-[3/4]"
                }`}>
                <Image
                  src={photo.src} alt={photo.alt} fill
                  sizes={photo.large
                    ? "(min-width: 1024px) 540px, 100vw"
                    : "(min-width: 1024px) 260px, 50vw"}
                  className="object-cover"
                />
              </div>
            ))}
          </div>

          <div className="mt-8 sm:mt-[34px]">
            <Link href="/inscription"
              className="inline-flex items-center justify-center rounded-sm bg-framboise px-[22px] py-[15px] text-[15px] font-semibold text-white transition-colors hover:bg-framboise-deep sm:py-[13px]">
              Rejoindre la team
            </Link>
          </div>
        </div>
      </section>

      {/* FAQ ------------------------------------------------------------- */}
      <section className="px-5 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-[820px]">
          <h2 className="mb-[22px]">Des questions ?</h2>
          <Faq />
        </div>
      </section>

      {/* Pied ------------------------------------------------------------ */}
      <footer className="bg-encre px-5 pt-12 pb-8 text-sm text-[#9A9096] sm:px-6 sm:pt-[46px] sm:pb-[30px]">
        <div className="mx-auto max-w-shell">
          <div className="flex flex-col gap-8 sm:flex-row sm:flex-wrap sm:justify-between">
            <div>
              <Logo clair hauteur={48} />
              <p className="mt-3">
                Cours de Fitness Step en Guadeloupe
                <br />
                Les Abymes, Le Moule, Jarry
              </p>
            </div>
            <div className="flex flex-col gap-2">
              {[["#planning", "Le planning"], ["#formules", "Les formules"],
                ["/contact", "Contact"], [destinationCompte, "Mon compte"]].map(([href, libelle]) => (
                <Link key={libelle} href={href} className="text-[#C4BEC1] hover:text-white">
                  {libelle}
                </Link>
              ))}
            </div>
            <div className="flex flex-col gap-2">
              <a href="mailto:sbscoaching28@gmail.com" className="text-[#C4BEC1] hover:text-white">
                sbscoaching28@gmail.com
              </a>
              {process.env.NEXT_PUBLIC_INSTAGRAM_URL && (
                <a href={process.env.NEXT_PUBLIC_INSTAGRAM_URL}
                  target="_blank" rel="noopener noreferrer"
                  className="text-[#C4BEC1] hover:text-white">
                  Instagram
                </a>
              )}
            </div>
          </div>
          <div className="mt-8 flex flex-col gap-3 border-t border-[#343133] pt-[18px] sm:mt-[30px] sm:flex-row sm:items-center sm:justify-between">
            <p>Step by Step Coaching — Hegesippe Oriane (EI) — Siret 915 127 534 00013.</p>
            <div className="flex flex-wrap gap-x-5 gap-y-1">
              {[["/mentions-legales", "Mentions légales"],
                ["/cgv", "Conditions générales de vente"],
                ["/confidentialite", "Confidentialité"]].map(([href, libelle]) => (
                <Link key={href} href={href} className="text-[#C4BEC1] hover:text-white">
                  {libelle}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}
