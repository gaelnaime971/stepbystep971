import Link from "next/link";
import { Marque } from "@/components/Marque";

const LIENS = [
  ["#planning", "Le planning"],
  ["#formules", "Les formules"],
  ["#oriane", "Oriane"],
  ["#team", "La team"],
] as const;

export function NavVitrine({ destinationCompte }: { destinationCompte: string }) {
  return (
    <nav className="sticky top-0 z-20 bg-encre py-3.5">
      <div className="mx-auto flex max-w-shell items-center justify-between gap-5 px-6">
        <Marque clair />

        <div className="flex items-center gap-6">
          {/* Les ancres disparaissent sur petit écran, comme dans la maquette :
              sur un téléphone la page se parcourt au pouce, pas au menu. */}
          <div className="hidden items-center gap-6 lg:flex">
            {LIENS.map(([href, libelle]) => (
              <Link key={href} href={href} className="text-[15px] text-[#D6D2D4] hover:text-white">
                {libelle}
              </Link>
            ))}
          </div>
          <Link
            href={destinationCompte}
            className="rounded-sm bg-framboise px-3.5 py-2 text-sm font-semibold whitespace-nowrap text-white transition-colors hover:bg-framboise-deep"
          >
            Mon compte
          </Link>
        </div>
      </div>
    </nav>
  );
}
