import type { Metadata } from "next";
import { FormulaireConnexion } from "./formulaire";

export const metadata: Metadata = { title: "Connexion — Step by Step" };

export default async function PageConnexion({
  searchParams,
}: {
  searchParams: Promise<{ suite?: string }>;
}) {
  const { suite } = await searchParams;
  return <FormulaireConnexion suite={suite ?? ""} />;
}
