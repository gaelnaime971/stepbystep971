import { redirect } from "next/navigation";
import { BoutonDeconnexion } from "@/components/BoutonDeconnexion";
import { Marque } from "@/components/Marque";
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
      <aside className="flex flex-col bg-encre px-4 py-5">
        <div className="mx-2 mb-6">
          <Marque clair />
        </div>

        <MenuAdmin />

        <div className="mt-auto flex flex-col gap-3 px-3 pt-8">
          <p className="text-[13px] text-[#6E666A]">
            {profil.first_name} {profil.last_name}
          </p>
          <BoutonDeconnexion />
        </div>
      </aside>

      <main className="max-w-[1180px] px-6 py-8 md:px-[34px] md:pt-[30px] md:pb-[70px]">
        {children}
      </main>
    </div>
  );
}
