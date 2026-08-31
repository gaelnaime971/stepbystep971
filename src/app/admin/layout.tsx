import { redirect } from "next/navigation";
import { EnteteConnectee } from "@/components/EnteteConnectee";
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
    <div className="min-h-screen bg-ivoire">
      <EnteteConnectee profil={profil} />
      <main className="mx-auto max-w-shell px-6 py-10">{children}</main>
    </div>
  );
}
