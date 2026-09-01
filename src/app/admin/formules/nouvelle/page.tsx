import type { Metadata } from "next";
import Link from "next/link";
import { formuleParId } from "@/lib/formules/lecture";
import { centimesEnEuros } from "@/lib/formules/format";
import { FormulaireFormule } from "./formulaire";

export const metadata: Metadata = { title: "Créer une formule — Step by Step" };

export default async function PageNouvelleFormule({
  searchParams,
}: {
  searchParams: Promise<{ depuis?: string }>;
}) {
  const { depuis } = await searchParams;
  const source = depuis ? await formuleParId(depuis) : null;

  return (
    <>
      <p className="mb-4 text-[15px]">
        <Link href="/admin/formules" className="text-framboise-deep underline underline-offset-[3px]">
          Retour aux formules
        </Link>
      </p>

      <h2 className="mb-2">
        {source ? `Nouvelle formule à partir de « ${source.name} »` : "Créer une formule"}
      </h2>
      <p className="mb-8 max-w-[62ch] text-plume-deep">
        {source
          ? "Le prix d'une formule vendue ne se modifie pas. Change ce que tu veux ici, puis archive l'ancienne : les clientes qui l'ont achetée gardent leurs séances."
          : "Le produit et le prix sont créés chez Stripe au moment où tu enregistres. Tu n'as rien à faire de ton côté."}
      </p>

      <FormulaireFormule
        valeursInitiales={
          source
            ? {
                nom: source.name,
                argumentaire: source.tagline ?? "",
                type: source.kind,
                seances: String(source.sessions_count),
                prix: centimesEnEuros(source.price_cents),
                prixBarre: source.compare_at_price_cents
                  ? centimesEnEuros(source.compare_at_price_cents)
                  : "",
                delai: String(source.cancellation_deadline_hours),
                ordre: String(source.sort_order),
                puces: source.features.join("\n"),
              }
            : undefined
        }
      />
    </>
  );
}
