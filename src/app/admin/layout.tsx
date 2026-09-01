import { redirect } from "next/navigation";
import { BoutonDeconnexion } from "@/components/BoutonDeconnexion";
import { Logo } from "@/components/Logo";
import { MenuAdmin } from "@/components/MenuAdmin";
import { profilCourant } from "@/lib/auth/session";

export default async function LayoutAdmin({
  children,
}: {
  children: React.ReactNode;
}) {
  const profil = await profilCourant();

  // Le middleware ne sait que « y a-t-il quelqu'un ». Le role se lit en base,
  // et c'est ici qu'on le fait : une requete par navigation dans l'admin, pas
  // une par requete du site.
  if (!profil) redirect("/connexion?suite=/admin");
  if (profil.role !== "admin") redirect("/compte");

  return (
    <div className="min-h-screen md:grid md:grid-cols-[236px_1fr]">
      {/* Sur telephone la colonne de 236 px pousserait tout le contenu vers le
          bas : le menu devient une barre qui defile horizontalement. */}
      <aside className="flex flex-col bg-encre px-4 py-4 md:py-5">
        <div className="mb-4 flex items-center justify-between gap-3 md:mx-2 md:mb-6 md:block">
          <Logo clair hauteur={54} hauteurMobile={52} priorite />
          <div className="flex items-center gap-3 md:hidden">
            <BoutonDeconnexion />
          </div>
        </div>

        <MenuAdmin />

        <div className="mt-auto hidden flex-col gap-3 px-3 pt-8 md:flex">
          <p className="text-[13px] text-[#6E666A]">
            {profil.first_name} {profil.last_name}
          </p>
          <BoutonDeconnexion />
        </div>
      </aside>

      <main id="contenu" className="max-w-[1180px] px-5 py-7 md:px-[34px] md:pt-[30px] md:pb-[70px]">
        {children}
      </main>
    </div>
  );
}
