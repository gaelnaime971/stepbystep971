"use client";

import { useActionState } from "react";
import { Alerte } from "@/components/Alerte";
import { BoutonEnvoi } from "@/components/Bouton";
import { Champ, ChampNombre, Selecteur } from "@/components/Champ";
import { modifierCours } from "@/lib/planning/actions";
import { ETAT_PLANNING_INITIAL } from "@/lib/planning/etat";

export function FormulaireModification({
  cours,
  lieux,
}: {
  cours: {
    id: string;
    location_id: string;
    date: string;
    debut: string;
    fin: string;
    capacity: number;
    seats_taken: number;
  };
  lieux: { valeur: string; libelle: string }[];
}) {
  const [etat, action] = useActionState(modifierCours, ETAT_PLANNING_INITIAL);
  const v = etat.valeurs ?? {};

  return (
    <form action={action} className="flex flex-col gap-5">
      {etat.erreur && (
        <Alerte ton="erreur">
          {etat.erreur}
          {etat.detail && <span className="mt-1 block font-normal">{etat.detail}</span>}
        </Alerte>
      )}

      <input type="hidden" name="id" value={cours.id} />

      <Selecteur nom="lieu" libelle="Lieu" options={lieux}
        valeurParDefaut={v.lieu ?? cours.location_id} />

      <Champ nom="date" libelle="Date" type="date" valeurParDefaut={v.date ?? cours.date} />

      <div className="grid grid-cols-2 gap-3">
        <Champ nom="debut" libelle="Début" type="time" valeurParDefaut={v.debut ?? cours.debut} />
        <Champ nom="fin" libelle="Fin" type="time" valeurParDefaut={v.fin ?? cours.fin} />
      </div>

      <ChampNombre nom="places" libelle="Nombre de places" min={Math.max(1, cours.seats_taken)}
        valeurParDefaut={v.places ?? cours.capacity}
        aide={
          cours.seats_taken > 0
            ? `Tu ne peux pas descendre sous ${cours.seats_taken}, c'est le nombre d'inscrites.`
            : "Personne n'est inscrit, tu peux mettre ce que tu veux."
        } />

      <BoutonEnvoi enAttente="Enregistrement…">J&apos;enregistre</BoutonEnvoi>
    </form>
  );
}
