import { redirect } from "next/navigation";
import { EnteteConnectee } from "@/components/EnteteConnectee";
import { OngletsCompte } from "@/components/OngletsCompte";
import { profilCourant } from "@/lib/auth/session";
import { enregistrerDepuisInscription } from "@/lib/charte/actions";
import { etatCharte } from "@/lib/charte/lecture";

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

  // La charte, une seule fois, et en BASE : changer de telephone ne la
  // redemande pas. Le controle est dans le layout parce qu'il doit couvrir
  // TOUTES les pages de l'espace cliente, y compris celles ajoutees plus tard.
  //
  // La page de signature vit HORS de `/compte` : sous ce layout, elle se
  // renverrait vers elle-meme. L'espace d'Oriane n'est pas concerne non plus,
  // son layout est ailleurs — rien ne doit lui bloquer l'administration.
  const etat = await etatCharte(profil.id);
  if (!etat.signee) {
    // Elle a repondu au formulaire d'inscription : on enregistre, on ne
    // redemande pas. Les comptes anterieurs, eux, passent par la page.
    const rattrape = await enregistrerDepuisInscription();
    if (!rattrape) redirect("/accepter-la-charte");
  }

  return (
    <div className="min-h-screen bg-ivoire">
      <EnteteConnectee profil={profil} />
      <OngletsCompte />
      <main id="contenu" className="mx-auto max-w-shell px-5 pt-7 pb-16 sm:px-6 sm:pt-9 sm:pb-[70px]">{children}</main>
    </div>
  );
}
