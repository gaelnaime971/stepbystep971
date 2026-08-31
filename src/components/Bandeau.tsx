export function Bandeau({
  ton,
  titre,
  children,
}: {
  ton: "succes" | "erreur" | "attention";
  titre?: string;
  children: React.ReactNode;
}) {
  const style = {
    succes: "border-menthe bg-menthe-wash text-menthe",
    erreur: "border-framboise bg-framboise-wash text-framboise-deep",
    attention: "border-ambre bg-ambre-wash text-ambre",
  }[ton];

  return (
    <div role="status" className={`rounded-md border px-4 py-3.5 text-[15px] ${style}`}>
      {titre && <p className="font-semibold">{titre}</p>}
      <div className={titre ? "mt-1" : ""}>{children}</div>
    </div>
  );
}
