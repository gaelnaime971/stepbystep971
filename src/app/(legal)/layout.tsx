import Link from "next/link";
import { Bandeau } from "@/components/Bandeau";
import { Logo } from "@/components/Logo";
import { NavVitrine } from "@/components/vitrine/Nav";
import { accueilSelonRole, profilCourant } from "@/lib/auth/session";

const PAGES = [
  ["/mentions-legales", "Mentions légales"],
  ["/cgv", "Conditions générales de vente"],
  ["/confidentialite", "Confidentialité"],
] as const;

export default async function LayoutLegal({ children }: { children: React.ReactNode }) {
  const profil = await profilCourant();

  return (
    <>
      <NavVitrine
        destinationCompte={profil ? accueilSelonRole(profil.role) : "/connexion"}
        connectee={!!profil}
      />

      <main id="contenu" className="px-5 py-10 sm:px-6 sm:py-16">
        <div className="mx-auto max-w-[760px]">
          {/* Visible d'Oriane seule. Ces textes sont une trame de travail : la
              signature engage son entreprise, pas ce site. */}
          {profil?.role === "admin" && (
            <div className="mb-8">
              <Bandeau ton="attention" titre="Document à faire valider par un professionnel du droit avant mise en ligne">
                Ce texte est une base sérieuse, écrite à partir de ton activité
                réelle, mais il n&apos;a pas été rédigé par un juriste. Fais-le
                relire avant de t&apos;en servir : c&apos;est ton entreprise qui
                s&apos;engage. Les passages entre crochets attendent une
                information que toi seule as.
              </Bandeau>
            </div>
          )}

          <article className="legal">{children}</article>

          <nav className="mt-14 flex flex-wrap gap-x-6 gap-y-2 border-t border-sable pt-6 text-[15px]">
            {PAGES.map(([href, libelle]) => (
              <Link key={href} href={href} className="text-framboise-deep underline underline-offset-[3px]">
                {libelle}
              </Link>
            ))}
          </nav>
        </div>
      </main>

      <footer className="bg-encre px-5 pt-12 pb-8 text-sm text-[#9A9096] sm:px-6">
        <div className="mx-auto flex max-w-shell flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Logo clair hauteur={44} />
            <p className="mt-3">Cours de step en Guadeloupe</p>
          </div>
          <p>Step by Step Coaching — Siret 915 127 534 00013.</p>
        </div>
      </footer>
    </>
  );
}
