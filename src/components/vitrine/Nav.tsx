import Link from "next/link";
import { Logo } from "@/components/Logo";
import { MenuMobile } from "./MenuMobile";

const LIENS = [
  ["#planning", "Le planning"],
  ["#formules", "Les formules"],
  ["#oriane", "Oriane"],
  ["#team", "La team"],
  ["/contact", "Contact"],
] as const;

export function NavVitrine({
  destinationCompte,
  connectee,
}: {
  destinationCompte: string;
  connectee: boolean;
}) {
  return (
    <nav className="sticky top-0 z-40 bg-encre">
      <div className="mx-auto flex max-w-shell items-center justify-between gap-4 px-5 py-2.5 sm:px-6 sm:py-3">
        <Logo clair hauteur={42} priorite />

        <div className="hidden items-center gap-7 lg:flex">
          {LIENS.map(([href, libelle]) => (
            <Link
              key={href}
              href={href}
              className="relative py-1 text-[15px] text-[#D6D2D4] transition-colors after:absolute after:inset-x-0 after:-bottom-0.5 after:h-[2px] after:origin-left after:scale-x-0 after:bg-framboise after:transition-transform hover:text-white hover:after:scale-x-100"
            >
              {libelle}
            </Link>
          ))}
          <Link
            href={destinationCompte}
            className="rounded-sm bg-framboise px-4 py-2 text-sm font-semibold whitespace-nowrap text-white transition-colors hover:bg-framboise-deep"
          >
            {connectee ? "Mon compte" : "Me connecter"}
          </Link>
        </div>

        <MenuMobile liens={LIENS} destinationCompte={destinationCompte} connectee={connectee} />
      </div>
    </nav>
  );
}
