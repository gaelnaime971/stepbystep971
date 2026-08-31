import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { utilisatriceCourante } from "@/lib/auth/session";
import { FormulaireNouveauMotDePasse } from "./formulaire";

export const metadata: Metadata = { title: "Nouveau mot de passe — Step by Step" };

export default async function PageNouveauMotDePasse() {
  // On n'arrive ici qu'avec une session : soit celle ouverte par le lien de
  // recuperation, soit une session normale. Sans session, le lien a expire ou
  // la page a ete ouverte directement.
  const utilisatrice = await utilisatriceCourante();
  if (!utilisatrice) redirect("/mot-de-passe-oublie");

  return <FormulaireNouveauMotDePasse />;
}
