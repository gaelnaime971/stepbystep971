import { redirect } from "next/navigation";
import { EnteteConnectee } from "@/components/EnteteConnectee";
import { OngletsCompte } from "@/components/OngletsCompte";
import { profilCourant } from "@/lib/auth/session";

export default async function LayoutCompte({
  children,
}: {
  children: React.ReactNode;
}) {
  // Le middleware a deja renvoye les visiteuses vers /connexion. Ce controle
  // est le second verrou : le middleware peut etre contourne par une route
  // qui echappe a son matcher, un layout serveur non.
  const profil = await profilCourant();
  if (!profil) redirect("/connexion?suite=/compte");

  return (
    <div className="min-h-screen bg-ivoire">
      <EnteteConnectee profil={profil} />
      <OngletsCompte />
      <main id="contenu" className="mx-auto max-w-shell px-5 pt-7 pb-16 sm:px-6 sm:pt-9 sm:pb-[70px]">{children}</main>
    </div>
  );
}
