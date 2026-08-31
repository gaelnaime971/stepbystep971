import { BoutonDeconnexion } from "./BoutonDeconnexion";
import { Marque } from "./Marque";
import type { Profil } from "@/lib/auth/session";

function initiales(profil: Profil) {
  return `${profil.first_name[0] ?? ""}${profil.last_name[0] ?? ""}`.toUpperCase();
}

export function EnteteConnectee({ profil }: { profil: Profil }) {
  return (
    <nav className="sticky top-0 z-20 bg-encre px-6 py-3.5">
      <div className="mx-auto flex max-w-shell items-center justify-between gap-5">
        <Marque clair />
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-framboise text-[13px] font-semibold text-white"
          >
            {initiales(profil)}
          </span>
          <span className="text-[15px] text-white">
            {profil.first_name} {profil.last_name}
          </span>
          <BoutonDeconnexion />
        </div>
      </div>
    </nav>
  );
}
