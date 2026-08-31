"use client";

import Link from "next/link";
import { useActionState } from "react";
import { connexion } from "@/lib/auth/actions";
import { ETAT_INITIAL } from "@/lib/auth/formulaire";
import { Alerte } from "@/components/Alerte";
import { BoutonEnvoi } from "@/components/Bouton";
import { Champ } from "@/components/Champ";

export function FormulaireConnexion({ suite }: { suite: string }) {
  const [etat, action] = useActionState(connexion, ETAT_INITIAL);

  return (
    <>
      <h2 className="mb-2">Te revoilà</h2>
      <p className="mb-7 text-plume">
        Connecte-toi pour placer tes séances dans le planning.
      </p>

      <form action={action} className="flex flex-col gap-4">
        {etat.erreur && <Alerte ton="erreur">{etat.erreur}</Alerte>}

        <input type="hidden" name="suite" value={suite} />

        <Champ
          nom="email"
          libelle="Email"
          type="email"
          autoComplete="email"
          valeurParDefaut={etat.valeurs?.email}
        />
        <Champ
          nom="motDePasse"
          libelle="Mot de passe"
          type="password"
          autoComplete="current-password"
        />

        <BoutonEnvoi enAttente="Connexion…">Je me connecte</BoutonEnvoi>
      </form>

      <p className="mt-5 text-[15px]">
        <Link
          href="/mot-de-passe-oublie"
          className="text-framboise-deep underline underline-offset-[3px]"
        >
          J&apos;ai oublié mon mot de passe
        </Link>
      </p>

      <p className="mt-7 border-t border-sable pt-6 text-[15px] text-plume">
        Pas encore de compte ?{" "}
        <Link
          href="/inscription"
          className="text-framboise-deep underline underline-offset-[3px]"
        >
          Rejoindre la team
        </Link>
      </p>
    </>
  );
}
