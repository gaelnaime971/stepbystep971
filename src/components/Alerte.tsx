/**
 * Message de formulaire. `role="alert"` pour que les lecteurs d'ecran
 * l'annoncent sans qu'il faille retrouver le champ fautif.
 */
export function Alerte({
  ton,
  children,
}: {
  ton: "erreur" | "succes";
  children: React.ReactNode;
}) {
  const style =
    ton === "erreur"
      ? "border-framboise bg-framboise-wash text-framboise-deep"
      : "border-menthe bg-menthe-wash text-menthe";

  return (
    <p
      role="alert"
      className={`rounded-sm border px-[13px] py-[11px] text-[15px] ${style}`}
    >
      {children}
    </p>
  );
}
