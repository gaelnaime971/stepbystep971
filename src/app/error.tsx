"use client";

import Link from "next/link";
import { useEffect } from "react";

/**
 * Ecran d'erreur.
 *
 * Client par obligation de Next. Le logo n'y est pas : si le rendu a echoue,
 * on ne parie pas sur le chargement d'une image. Le `digest` est affiche parce
 * qu'il est la seule chose qui permette de retrouver la trace cote serveur.
 */
export default function PageErreur({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("erreur de rendu :", error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col bg-ivoire">
      <main className="flex flex-1 items-center px-5 py-16 sm:px-6">
        <div className="mx-auto w-full max-w-[520px]">
          <p className="mb-2 font-display text-[19px] font-bold italic tracking-[-0.01em] text-encre">
            Step <span className="text-framboise">by</span> Step
          </p>
          <h1 className="mt-8 mb-3 font-display text-[clamp(26px,5vw,36px)] leading-[1.05] font-bold italic">
            Quelque chose s&apos;est cassé
          </h1>
          <p className="mb-8 text-[17px] text-plume-deep">
            L&apos;erreur vient du site, pas de toi. Réessaie : la plupart du
            temps ça repart. Si ça recommence, préviens Oriane.
          </p>

          <div className="flex flex-col gap-3 sm:flex-row">
            <button type="button" onClick={reset}
              className="inline-flex cursor-pointer items-center justify-center rounded-sm bg-framboise px-[22px] py-[15px] text-[15px] font-semibold text-white transition-colors hover:bg-framboise-deep sm:py-[13px]">
              Réessayer
            </button>
            <Link href="/"
              className="inline-flex items-center justify-center rounded-sm border border-framboise px-[22px] py-[15px] text-[15px] font-semibold text-framboise transition-colors hover:bg-framboise-wash sm:py-[13px]">
              Retour à l&apos;accueil
            </Link>
          </div>

          <p className="mt-8 text-[15px] text-plume-deep">
            <Link href="/contact" className="text-framboise-deep underline underline-offset-[3px]">
              Écrire à Oriane
            </Link>
            {error.digest && (
              <>
                {" "}— en lui donnant ce code, ça l&apos;aidera :{" "}
                <code className="rounded-[4px] bg-sable px-1.5 py-0.5 text-[13px]">
                  {error.digest}
                </code>
              </>
            )}
          </p>
        </div>
      </main>
    </div>
  );
}
