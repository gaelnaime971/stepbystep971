import Link from "next/link";
import { Logo } from "@/components/Logo";

export default function PageIntrouvable() {
  return (
    <div className="flex min-h-screen flex-col bg-ivoire">
      <header className="border-b border-sable px-5 py-4 sm:px-6">
        <div className="mx-auto max-w-shell">
          <Logo hauteur={44} />
        </div>
      </header>

      <main id="contenu" className="flex flex-1 items-center px-5 py-16 sm:px-6">
        <div className="mx-auto w-full max-w-[520px]">
          <p className="chiffre mb-2 text-[64px] leading-none text-framboise">404</p>
          <h1 className="mb-3 font-display text-[clamp(26px,5vw,36px)] leading-[1.05] font-bold italic">
            Cette page n&apos;existe pas
          </h1>
          <p className="mb-8 text-[17px] text-plume-deep">
            Le lien est peut-être ancien, ou l&apos;adresse comporte une faute.
            Rien de grave.
          </p>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href="/"
              className="inline-flex items-center justify-center rounded-sm bg-framboise px-[22px] py-[15px] text-[15px] font-semibold text-white transition-colors hover:bg-framboise-deep sm:py-[13px]">
              Retour à l&apos;accueil
            </Link>
            <Link href="/compte"
              className="inline-flex items-center justify-center rounded-sm border border-framboise px-[22px] py-[15px] text-[15px] font-semibold text-framboise transition-colors hover:bg-framboise-wash sm:py-[13px]">
              Mon compte
            </Link>
          </div>

          <p className="mt-8 text-[15px] text-plume-deep">
            Tu cherchais quelque chose de précis ?{" "}
            <Link href="/contact" className="text-framboise-deep underline underline-offset-[3px]">
              Écris à Oriane
            </Link>
            .
          </p>
        </div>
      </main>
    </div>
  );
}
