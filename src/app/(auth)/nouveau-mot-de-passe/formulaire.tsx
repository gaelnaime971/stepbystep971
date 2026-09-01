"use client";

import { useActionState } from "react";
import { changerMotDePasse } from "@/lib/auth/actions";
import { ETAT_INITIAL } from "@/lib/auth/formulaire";
import { Alerte } from "@/components/Alerte";
import { BoutonEnvoi } from "@/components/Bouton";
import { Champ } from "@/components/Champ";

export function FormulaireNouveauMotDePasse() {
  const [etat, action] = useActionState(changerMotDePasse, ETAT_INITIAL);

  return (
    <>
      <h2 className="mb-2">Nouveau mot de passe</h2>
      <p className="mb-7 text-plume-deep">
        Choisis-en un nouveau. Tu resteras connectée juste après.
      </p>

      <form action={action} className="flex flex-col gap-4">
        {etat.erreur && <Alerte ton="erreur">{etat.erreur}</Alerte>}

        <Champ
          nom="motDePasse"
          libelle="Nouveau mot de passe"
          type="password"
          autoComplete="new-password"
          aide="8 caractères au minimum."
        />
        <Champ
          nom="confirmation"
          libelle="Confirme-le"
          type="password"
          autoComplete="new-password"
        />

        <BoutonEnvoi enAttente="Enregistrement…">
          J&apos;enregistre
        </BoutonEnvoi>
      </form>
    </>
  );
}
