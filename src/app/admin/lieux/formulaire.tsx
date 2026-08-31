"use client";

import { useActionState } from "react";
import { Alerte } from "@/components/Alerte";
import { BoutonEnvoi } from "@/components/Bouton";
import { Champ } from "@/components/Champ";
import { creerLieu } from "@/lib/planning/actions";
import { ETAT_PLANNING_INITIAL } from "@/lib/planning/etat";

export function FormulaireLieu() {
  const [etat, action] = useActionState(creerLieu, ETAT_PLANNING_INITIAL);
  const v = etat.valeurs ?? {};

  return (
    <form action={action} className="flex flex-col gap-5">
      {etat.erreur && (
        <Alerte ton="erreur">
          {etat.erreur}
          {etat.detail && <span className="mt-1 block font-normal">{etat.detail}</span>}
        </Alerte>
      )}

      <Champ nom="nom" libelle="Nom" valeurParDefaut={v.nom}
        aide="Celui que tes clientes emploient. « Jarry » plutôt que « Baie-Mahault »." />
      <Champ nom="ville" libelle="Commune" requis={false} valeurParDefaut={v.ville} />
      <Champ nom="adresse" libelle="Adresse" requis={false} valeurParDefaut={v.adresse} />

      <BoutonEnvoi enAttente="Ajout…">J&apos;ajoute le lieu</BoutonEnvoi>
    </form>
  );
}
