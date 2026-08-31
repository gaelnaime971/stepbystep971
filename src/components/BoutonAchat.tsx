import { demarrerPaiement } from "@/lib/paiement/actions";

export function BoutonAchat({
  slug,
  libelle,
  variante = "plein",
}: {
  slug: string;
  libelle: string;
  variante?: "plein" | "ligne";
}) {
  const style =
    variante === "plein"
      ? "bg-framboise text-white border-transparent hover:bg-framboise-deep"
      : "bg-transparent text-framboise border-framboise hover:bg-framboise-wash";

  return (
    <form action={demarrerPaiement} className="w-full">
      <input type="hidden" name="slug" value={slug} />
      <button
        type="submit"
        className={`inline-flex w-full cursor-pointer items-center justify-center rounded-sm border px-[22px] py-[13px] text-[15px] font-semibold transition-colors ${style}`}
      >
        {libelle}
      </button>
    </form>
  );
}
