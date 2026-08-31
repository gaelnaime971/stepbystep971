import { redirect } from "next/navigation";
import { EnteteConnectee } from "@/components/EnteteConnectee";
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
      <main className="mx-auto max-w-shell px-6 py-10">{children}</main>
    </div>
  );
}
