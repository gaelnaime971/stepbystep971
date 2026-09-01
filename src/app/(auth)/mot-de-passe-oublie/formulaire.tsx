"use client";

import Link from "next/link";
import { useActionState } from "react";
import { demanderNouveauMotDePasse } from "@/lib/auth/actions";
import { ETAT_INITIAL } from "@/lib/auth/formulaire";
import { Alerte } from "@/components/Alerte";
import { BoutonEnvoi } from "@/components/Bouton";
import { Champ } from "@/components/Champ";

export function FormulaireMotDePasseOublie() {
  const [etat, action] = useActionState(
    demanderNouveauMotDePasse,
    ETAT_INITIAL,
  );

  return (
    <>
      <h2 className="mb-2">Mot de passe oublié</h2>
      <p className="mb-7 text-plume-deep">
        Donne-moi ton email, je t&apos;envoie un lien pour en choisir un
        nouveau.
      </p>

      <form action={action} className="flex flex-col gap-4">
        {etat.erreur && <Alerte ton="erreur">{etat.erreur}</Alerte>}
        {etat.succes && <Alerte ton="succes">{etat.succes}</Alerte>}

        <Champ
          nom="email"
          libelle="Email"
          type="email"
          autoComplete="email"
          valeurParDefaut={etat.valeurs?.email}
        />

        <BoutonEnvoi enAttente="Envoi…">Envoie-moi le lien</BoutonEnvoi>
      </form>

      <p className="mt-7 border-t border-sable pt-6 text-[15px]">
        <Link
          href="/connexion"
          className="text-framboise-deep underline underline-offset-[3px]"
        >
          Retour à la connexion
        </Link>
      </p>
    </>
  );
}
