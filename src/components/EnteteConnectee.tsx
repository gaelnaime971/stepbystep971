import { BoutonDeconnexion } from "./BoutonDeconnexion";
import { Logo } from "./Logo";
import type { Profil } from "@/lib/auth/session";

function initiales(profil: Profil) {
  return `${profil.first_name[0] ?? ""}${profil.last_name[0] ?? ""}`.toUpperCase();
}

export function EnteteConnectee({ profil }: { profil: Profil }) {
  return (
    <nav className="sticky top-0 z-20 bg-encre px-5 py-2.5 sm:px-6 sm:py-3">
      <div className="mx-auto flex max-w-shell items-center justify-between gap-3">
        <Logo clair hauteur={38} priorite />
        <div className="flex items-center gap-2.5 sm:gap-3">
          <span
            aria-hidden="true"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-framboise text-[13px] font-semibold text-white"
          >
            {initiales(profil)}
          </span>
          {/* Le nom complet ferait deborder une barre de 375 px : les
              initiales suffisent, le nom revient des qu'il y a la place. */}
          <span className="hidden text-[15px] whitespace-nowrap text-white sm:inline">
            {profil.first_name} {profil.last_name}
          </span>
          <BoutonDeconnexion />
        </div>
      </div>
    </nav>
  );
}
