import { Bandeau } from "@/components/Bandeau";
import { profilCourant } from "@/lib/auth/session";

/**
 * Un avertissement destine a Oriane seule, au milieu d'une page publique.
 *
 * Le controle du role se fait ici, une fois, plutot que dans chaque page :
 * une visiteuse ne doit jamais voir nos notes de travail.
 */
export async function NoteAdmin({
  titre,
  children,
}: {
  titre: string;
  children: React.ReactNode;
}) {
  const profil = await profilCourant();
  if (profil?.role !== "admin") return null;

  return (
    <div className="my-8">
      <Bandeau ton="attention" titre={titre}>
        {children}
      </Bandeau>
    </div>
  );
}
