"use client";

import { useActionState } from "react";
import { Alerte } from "@/components/Alerte";
import { BoutonEnvoi } from "@/components/Bouton";
import { Champ, ChampNombre, Selecteur } from "@/components/Champ";
import { creerCours } from "@/lib/planning/actions";
import { ETAT_PLANNING_INITIAL } from "@/lib/planning/etat";

const REPETITIONS = [
  { valeur: "1", libelle: "Une seule fois" },
  { valeur: "4", libelle: "Toutes les semaines pendant 4 semaines" },
  { valeur: "12", libelle: "Toutes les semaines pendant 12 semaines" },
];

export function FormulaireCours({
  lieux,
  dateParDefaut,
}: {
  lieux: { valeur: string; libelle: string }[];
  dateParDefaut: string;
}) {
  const [etat, action] = useActionState(creerCours, ETAT_PLANNING_INITIAL);
  const v = etat.valeurs ?? {};

  return (
    <form action={action} className="flex max-w-[520px] flex-col gap-5">
      {etat.erreur && (
        <Alerte ton="erreur">
          {etat.erreur}
          {etat.detail && <span className="mt-1 block font-normal">{etat.detail}</span>}
        </Alerte>
      )}

      <Selecteur nom="lieu" libelle="Lieu" options={lieux} />

      <Champ nom="date" libelle="Date" type="text"
        valeurParDefaut={v.date ?? dateParDefaut}
        aide="Au format 2026-09-09." />

      <div className="grid grid-cols-2 gap-3">
        <Champ nom="debut" libelle="Début" type="text" valeurParDefaut={v.debut ?? "18:30"}
          aide="Au format 18:30." />
        <Champ nom="fin" libelle="Fin" type="text" valeurParDefaut={v.fin ?? "19:30"}
          aide="Au format 19:30." />
      </div>

      <ChampNombre nom="places" libelle="Nombre de places" min={1}
        valeurParDefaut={v.places ?? 15}
        aide="Le cours passe en complet une fois ce nombre atteint. Pas de liste d'attente." />

      <Selecteur nom="repetition" libelle="Répéter" options={REPETITIONS}
        aide="Toutes les séances sont créées d'un coup. Si l'une d'elles tombe sur un créneau déjà pris, aucune n'est créée et je te dis laquelle." />

      <BoutonEnvoi enAttente="Création…">Je crée le cours</BoutonEnvoi>
    </form>
  );
}
