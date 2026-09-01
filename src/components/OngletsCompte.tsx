"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ONGLETS = [
  ["/compte", "Mes séances"],
  ["/compte/formule", "Ma formule"],
  ["/compte/profil", "Mon profil"],
] as const;

export function OngletsCompte() {
  const chemin = usePathname();

  return (
    <div className="border-b border-sable bg-white">
      <nav className="mx-auto flex max-w-shell gap-1 overflow-x-auto px-5 sm:px-6">
        {ONGLETS.map(([href, libelle]) => {
          const actif = chemin === href;
          return (
            <Link
              key={href}
              href={href}
              aria-current={actif ? "page" : undefined}
              className={`whitespace-nowrap border-b-2 px-4 py-[15px] text-[15px] transition-colors ${
                actif
                  ? "border-framboise font-semibold text-framboise"
                  : "border-transparent font-medium text-plume hover:text-encre"
              }`}
            >
              {libelle}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
