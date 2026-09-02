import { Selecteur } from "@/components/Champ";
import { ListeMoisMobile } from "@/components/admin/ListeMoisMobile";
import { NIVEAUX } from "@/lib/niveaux";
import type { CoursAdmin } from "@/lib/planning/types";

const L = "11111111-1111-1111-1111-111111111111";
const c = (id: string, h: string, level: CoursAdmin["level"]): CoursAdmin =>
  ({
    id, location_id: L,
    starts_at: `2026-09-10T${h}:00-04:00`, ends_at: `2026-09-10T${h}:00-04:00`,
    capacity: 20, seats_taken: 5, status: "scheduled",
    cancellation_reason: null, level,
  }) as CoursAdmin;

export default function A() {
  return (
    <main className="px-5 py-7">
      <Selecteur nom="niveau" libelle="Niveau"
        options={NIVEAUX.map((n) => ({ valeur: n.valeur, libelle: n.libelle }))}
        valeurParDefaut="tous_niveaux" />
      <ListeMoisMobile
        cours={[c("a", "18:30", "debutante"), c("b", "19:30", "intermediaire"), c("c", "20:30", null)]}
        nomLieu={new Map([[L, "Les Abymes"]])}
        aujourdHui="2026-09-03"
        libelleVide="—" />
    </main>
  );
}
