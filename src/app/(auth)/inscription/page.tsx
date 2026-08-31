import type { Metadata } from "next";
import { FormulaireInscription } from "./formulaire";

export const metadata: Metadata = { title: "Rejoindre la team — Step by Step" };

export default function PageInscription() {
  return <FormulaireInscription />;
}
