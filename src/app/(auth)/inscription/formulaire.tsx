"use client";

import Link from "next/link";
import { useActionState } from "react";
import { inscription } from "@/lib/auth/actions";
import { ETAT_INITIAL } from "@/lib/auth/formulaire";
import { Alerte } from "@/components/Alerte";
import { BoutonEnvoi } from "@/components/Bouton";
import { Champ } from "@/components/Champ";
import { ChoixImage } from "@/components/charte/ChoixImage";

export function FormulaireInscription() {
  const [etat, action] = useActionState(inscription, ETAT_INITIAL);

  if (etat.succes) {
    return (
      <>
        <h2 className="mb-2">Regarde tes mails</h2>
        <p className="mb-7 text-plume-deep">{etat.succes}</p>
        <p className="text-[15px] text-plume-deep">
          Rien reçu ? Le mail met parfois deux minutes, et il lui arrive de
          tomber dans les indésirables.
        </p>
      </>
    );
  }

  return (
    <>
      <h2 className="mb-2">Rejoindre la team</h2>
      <p className="mb-7 text-plume-deep">
        Ton compte te sert à acheter tes séances et à les placer dans le
        planning.
      </p>

      <form action={action} className="flex flex-col gap-4">
        {etat.erreur && <Alerte ton="erreur">{etat.erreur}</Alerte>}

        <div className="grid grid-cols-2 gap-4">
          <Champ
            nom="prenom"
            libelle="Prénom"
            autoComplete="given-name"
            valeurParDefaut={etat.valeurs?.prenom}
          />
          <Champ
            nom="nom"
            libelle="Nom"
            autoComplete="family-name"
            valeurParDefaut={etat.valeurs?.nom}
          />
        </div>

        <Champ
          nom="email"
          libelle="Email"
          type="email"
          autoComplete="email"
          valeurParDefaut={etat.valeurs?.email}
        />
        <Champ
          nom="telephone"
          libelle="Téléphone"
          type="tel"
          requis={false}
          autoComplete="tel"
          valeurParDefaut={etat.valeurs?.telephone}
          aide="Pour te joindre si un cours est annulé."
        />
        <Champ
          nom="motDePasse"
          libelle="Mot de passe"
          type="password"
          autoComplete="new-password"
          aide="8 caractères au minimum."
        />

        {/* Les deux consentements. Jamais fusionnes en une seule case : le
            reglement conditionne le compte, l'image ne conditionne rien. */}
        <div className="border-t border-sable pt-5">
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              name="reglement"
              className="mt-1 h-[18px] w-[18px] shrink-0 accent-framboise"
            />
            <span className="text-[15px] font-semibold">
              J&apos;ai lu et j&apos;accepte la{" "}
              <Link
                href="/charte"
                target="_blank"
                className="text-framboise-deep underline underline-offset-[3px]"
              >
                charte de participation
              </Link>
            </span>
          </label>
          <p className="mt-1.5 pl-[30px] text-[13px] text-plume-deep">
            Les règles des cours : ponctualité, tenue, sécurité, respect du
            matériel. Obligatoire pour créer ton compte.
          </p>
        </div>

        <div className="border-t border-sable pt-5">
          <ChoixImage />
        </div>

        <BoutonEnvoi enAttente="Création…">Je crée mon compte</BoutonEnvoi>
      </form>

      <p className="mt-7 border-t border-sable pt-6 text-[15px] text-plume-deep">
        Tu as déjà un compte ?{" "}
        <Link
          href="/connexion"
          className="text-framboise-deep underline underline-offset-[3px]"
        >
          Se connecter
        </Link>
      </p>
    </>
  );
}
