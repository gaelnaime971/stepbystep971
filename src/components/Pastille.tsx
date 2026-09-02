type Ton = "dispo" | "bientot" | "complet" | "rose" | "neutre";

const TONS: Record<Ton, string> = {
  dispo: "bg-menthe-wash text-menthe-deep",
  bientot: "bg-ambre-wash text-ambre-texte",
  complet: "bg-sable text-plume-deep",
  rose: "bg-framboise-wash text-framboise-deep",
  /* Le niveau d'un cours n'est ni une bonne ni une mauvaise nouvelle : il ne
     doit pas emprunter le vert de « des places » ni l'ambre de « bientot
     plein ». Un contour, pas un aplat — et aucune couleur nouvelle. */
  neutre: "border border-sable-deep bg-white text-encre-soft",
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
