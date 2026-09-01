import Image from "next/image";
import Link from "next/link";

/**
 * Le logo, dans ses deux variantes.
 *
 * Le fichier d'origine porte un mot-symbole NOIR, invisible sur les en-tetes
 * sombres du site. `logo-marque-claire.png` en est derive : le noir y est
 * blanc, le framboise inchange. Les deux sont detoures de leurs marges
 * transparentes, sans quoi le logo paraitrait deux fois plus petit que sa
 * boite.
 *
 * `priority` sur les en-tetes : c'est la premiere chose visible, elle ne doit
 * pas arriver apres le texte.
 */
export function Logo({
  clair = false,
  hauteur = 40,
  hauteurMobile,
  lien = "/",
  priorite = false,
}: {
  clair?: boolean;
  hauteur?: number;
  /** Hauteur sous 640 px. Sans elle, la meme qu'au-dessus. */
  hauteurMobile?: number;
  lien?: string | null;
  priorite?: boolean;
}) {
  const RATIO = 464 / 407;
  const image = (
    <Image
      src={clair ? "/logo-marque-claire.png" : "/logo-marque.png"}
      /* Vide quand l'image est dans un lien deja nomme : sinon le lecteur
         d'ecran annonce deux fois « Step by Step Coaching ». */
      alt={lien ? "" : "Step by Step Coaching"}
      width={Math.round(hauteur * RATIO)}
      height={hauteur}
      priority={priorite}
      className="h-[var(--h-mobile)] w-auto sm:h-[var(--h)]"
      style={
        {
          "--h": `${hauteur}px`,
          "--h-mobile": `${hauteurMobile ?? hauteur}px`,
        } as React.CSSProperties
      }
    />
  );

  if (!lien) return image;

  return (
    <Link href={lien} aria-label="Step by Step Coaching, retour à l'accueil" className="inline-flex">
      {image}
    </Link>
  );
}
