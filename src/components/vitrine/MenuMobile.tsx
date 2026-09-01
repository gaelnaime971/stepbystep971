"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Logo } from "@/components/Logo";

/**
 * Menu plein ecran sous 1024px.
 *
 * Le seul endroit du site public qui demande du JavaScript. Un menu n'est pas
 * un formulaire : rien de vital n'y passe, et les memes liens existent dans le
 * pied de page pour qui navigue sans JS.
 */
export function MenuMobile({
  liens,
  destinationCompte,
  connectee,
}: {
  liens: ReadonlyArray<readonly [string, string]>;
  destinationCompte: string;
  connectee: boolean;
}) {
  const [ouvert, setOuvert] = useState(false);

  // Le fond ne defile pas derriere le panneau, et Echap referme.
  useEffect(() => {
    if (!ouvert) return;
    const avant = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const echap = (e: KeyboardEvent) => e.key === "Escape" && setOuvert(false);
    window.addEventListener("keydown", echap);
    return () => {
      document.body.style.overflow = avant;
      window.removeEventListener("keydown", echap);
    };
  }, [ouvert]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOuvert(true)}
        aria-label="Ouvrir le menu"
        aria-expanded={ouvert}
        className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-sm text-white lg:hidden"
      >
        <span aria-hidden="true" className="flex flex-col gap-[5px]">
          <span className="block h-[2px] w-[22px] bg-current" />
          <span className="block h-[2px] w-[22px] bg-current" />
          <span className="block h-[2px] w-[22px] bg-current" />
        </span>
      </button>

      {ouvert && (
        <div className="fixed inset-0 z-50 flex flex-col bg-encre lg:hidden">
          <div className="flex items-center justify-between px-6 py-3.5">
            <Logo clair hauteur={42} />
            <button
              type="button"
              onClick={() => setOuvert(false)}
              aria-label="Fermer le menu"
              className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-sm text-3xl leading-none text-white"
            >
              <span aria-hidden="true">×</span>
            </button>
          </div>

          <nav className="flex flex-1 flex-col justify-center gap-1 px-6 pb-24">
            {liens.map(([href, libelle]) => (
              <Link
                key={href}
                href={href}
                onClick={() => setOuvert(false)}
                className="border-b border-white/10 py-4 font-display text-[26px] font-bold italic text-white"
              >
                {libelle}
              </Link>
            ))}

            <Link
              href={destinationCompte}
              onClick={() => setOuvert(false)}
              className="mt-7 inline-flex items-center justify-center rounded-sm bg-framboise px-[22px] py-[15px] text-[16px] font-semibold text-white"
            >
              {connectee ? "Mon compte" : "Me connecter"}
            </Link>
            {!connectee && (
              <Link
                href="/inscription"
                onClick={() => setOuvert(false)}
                className="mt-3 inline-flex items-center justify-center rounded-sm border border-white/40 px-[22px] py-[15px] text-[16px] font-semibold text-white"
              >
                Rejoindre la team
              </Link>
            )}
          </nav>
        </div>
      )}
    </>
  );
}
