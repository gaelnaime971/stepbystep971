import Link from "next/link";
import { demarrerPaiement } from "@/lib/paiement/actions";

export function BoutonAchat({
  slug,
  libelle,
  variante = "plein",
  gratuite = false,
}: {
  slug: string;
  libelle: string;
  variante?: "plein" | "ligne";
  /** Une formule a 0 EUR ne passe pas par Stripe : Checkout refuse zero. */
  gratuite?: boolean;
}) {
  const style =
    variante === "plein"
      ? "bg-framboise text-white border-transparent hover:bg-framboise-deep"
      : "bg-transparent text-framboise border-framboise hover:bg-framboise-wash";

  const classes = `inline-flex w-full cursor-pointer items-center justify-center rounded-sm border px-[22px] py-[13px] text-[15px] font-semibold transition-colors ${style}`;

  // Un LIEN, pas un envoi de formulaire : il n'y a rien a soumettre, et la
  // page qui suit explique ce qui va se passer avant de crediter quoi que ce
  // soit. `demarrerPaiement` garde le meme garde-fou de son cote, au cas ou
  // un formulaire serait rejoue.
  if (gratuite) {
    return (
      <Link href={`/compte/offerte/${encodeURIComponent(slug)}`} className={classes}>
        {libelle}
      </Link>
    );
  }

  return (
    <form action={demarrerPaiement} className="w-full">
      <input type="hidden" name="slug" value={slug} />
      <button type="submit" className={classes}>
        {libelle}
      </button>
    </form>
  );
}
