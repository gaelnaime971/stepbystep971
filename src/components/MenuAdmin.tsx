"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Entree = { href?: string; libelle: string; groupe?: never };
type Groupe = { groupe: string; href?: never; libelle?: never };

/** Tous les ecrans existent. Le type garde la porte ouverte pour la suite. */
const ENTREES: ReadonlyArray<Entree | Groupe> = [
  { href: "/admin", libelle: "Vue d'ensemble" },
  { href: "/admin/planning", libelle: "Planning des cours" },
  { href: "/admin/clientes", libelle: "Mes clientes" },
  { groupe: "Ventes" },
  { href: "/admin/formules", libelle: "Formules et tarifs" },
  { href: "/admin/promos", libelle: "Codes promo" },
  { href: "/admin/paiements", libelle: "Paiements" },
  { groupe: "Réglages" },
  { href: "/admin/lieux", libelle: "Lieux" },
  { href: "/admin/parametres", libelle: "Paramètres" },
];

export function MenuAdmin() {
  const chemin = usePathname();

  return (
    <nav className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 md:mx-0 md:flex-col md:gap-0.5 md:overflow-visible md:px-0 md:pb-0">
      {ENTREES.map((e, i) => {
        if ("groupe" in e && e.groupe) {
          return (
            <span key={e.groupe} className="hidden px-3 pt-4 pb-1.5 text-[13px] text-[#6E666A] md:block">
              {e.groupe}
            </span>
          );
        }
        if (!e.href) {
          return (
            <span
              key={`${e.libelle}-${i}`}
              className="cursor-default rounded-sm px-3 py-2.5 text-[15px] whitespace-nowrap text-[#6E666A]"
              title="Bientôt"
            >
              {e.libelle}
            </span>
          );
        }
        const actif =
          e.href === "/admin" ? chemin === "/admin" : chemin.startsWith(e.href);
        return (
          <Link
            key={e.href}
            href={e.href}
            aria-current={actif ? "page" : undefined}
            className={`rounded-sm px-3 py-2.5 text-[15px] whitespace-nowrap transition-colors ${
              actif
                ? "bg-framboise font-semibold text-white"
                : "text-[#B8B2B5] hover:bg-[#2A2729] hover:text-white"
            }`}
          >
            {e.libelle}
          </Link>
        );
      })}
    </nav>
  );
}
