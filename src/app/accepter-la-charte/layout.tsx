import { redirect } from "next/navigation";
import { EnteteConnectee } from "@/components/EnteteConnectee";
import { profilCourant } from "@/lib/auth/session";

/**
 * La page de signature vit HORS de `/compte`, et c'est structurel.
 *
 * Le layout de `/compte` exige la charte pour toutes ses pages. Y loger la
 * page qui la fait signer la renverrait vers elle-meme, indefiniment. La
 * sortir est la seule facon de garantir qu'aucune route ajoutee plus tard dans
 * l'espace cliente n'echappe au controle — et qu'aucune ne s'y enferme.
 *
 * Meme en-tete, sans les onglets : il n'y a qu'une chose a faire ici.
 */
export default async function LayoutSignature({ children }: { children: React.ReactNode }) {
  const profil = await profilCourant();
  if (!profil) redirect("/connexion?suite=/compte");

  return (
    <div className="min-h-screen bg-ivoire">
      <EnteteConnectee profil={profil} />
      <main id="contenu" className="mx-auto max-w-shell px-5 pt-7 pb-16 sm:px-6 sm:pt-9 sm:pb-[70px]">
        {children}
      </main>
    </div>
  );
}
