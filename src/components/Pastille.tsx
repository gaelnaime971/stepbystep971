type Ton = "dispo" | "bientot" | "complet" | "rose";

const TONS: Record<Ton, string> = {
  dispo: "bg-menthe-wash text-menthe-deep",
  bientot: "bg-ambre-wash text-ambre-texte",
  complet: "bg-sable text-plume-deep",
  rose: "bg-framboise-wash text-framboise-deep",
};

export function Pastille({ ton, children }: { ton: Ton; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-[11px] py-1 text-[13px] font-semibold ${TONS[ton]}`}
    >
      {children}
    </span>
  );
}
