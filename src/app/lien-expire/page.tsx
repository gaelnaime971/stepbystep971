import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/Logo";

export const metadata: Metadata = { title: "Lien expiré — Step by Step" };

export default function PageLienExpire() {
  return (
    <div className="flex min-h-screen flex-col bg-ivoire">
      <header className="border-b border-sable px-6 py-4">
        <div className="mx-auto max-w-shell">
          <Logo hauteur={44} />
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-[420px]">
          <h2 className="mb-2">Ce lien ne marche plus</h2>
          <p className="mb-7 text-plume-deep">
            Les liens envoyés par mail expirent au bout d&apos;une heure, et ne
            servent qu&apos;une fois. Demandes-en un nouveau.
          </p>
          <div className="flex flex-col gap-3">
            <Link
              href="/mot-de-passe-oublie"
              className="inline-flex items-center justify-center rounded-sm border border-transparent bg-framboise px-[22px] py-[13px] text-[15px] font-semibold text-white transition-colors hover:bg-framboise-deep"
            >
              Recevoir un nouveau lien
            </Link>
            <Link
              href="/connexion"
              className="inline-flex items-center justify-center rounded-sm border border-framboise px-[22px] py-[13px] text-[15px] font-semibold text-framboise transition-colors hover:bg-framboise-wash"
            >
              Retour à la connexion
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
