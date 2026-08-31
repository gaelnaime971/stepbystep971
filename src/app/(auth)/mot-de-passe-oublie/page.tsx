import type { Metadata } from "next";
import { FormulaireMotDePasseOublie } from "./formulaire";

export const metadata: Metadata = { title: "Mot de passe oublié — Step by Step" };

export default function PageMotDePasseOublie() {
  return <FormulaireMotDePasseOublie />;
}
