"use client";

import { useActionState, useState } from "react";
import { Alerte } from "@/components/Alerte";
import { Bandeau } from "@/components/Bandeau";
import { BoutonEnvoi } from "@/components/Bouton";
import { Case, Champ, ChampNombre, Selecteur, ZoneTexte } from "@/components/Champ";
import { creerFormule } from "@/lib/formules/actions";
import { ETAT_FORMULE_INITIAL } from "@/lib/formules/etat";

const TYPES = [
  { valeur: "single", libelle: "À la carte — paiement unique, une seule séance" },
  { valeur: "subscription", libelle: "Abonnement — prélèvement toutes les 4 semaines" },
  { valeur: "pack", libelle: "Pack — paiement unique, plusieurs séances" },
];

const UNITES = [
  { valeur: "months", libelle: "mois" },
  { valeur: "weeks", libelle: "semaines" },
  { valeur: "days", libelle: "jours" },
];

type Valeurs = Record<string, string>;

export function FormulaireFormule({ valeursInitiales }: { valeursInitiales?: Valeurs }) {
  const [etat, action] = useActionState(creerFormule, ETAT_FORMULE_INITIAL);
  const v: Valeurs = { ...valeursInitiales, ...etat.valeurs };
  const [type, setType] = useState(v.type ?? "single");
  const abonnement = type === "subscription";

  return (
    <form action={action} className="flex max-w-[620px] flex-col gap-5">
      {etat.erreur && (
        <Alerte ton="erreur">
          {etat.erreur}
          {etat.detail && <span className="mt-1 block font-normal">{etat.detail}</span>}
        </Alerte>
      )}

      <Champ nom="nom" libelle="Nom de la formule" valeurParDefaut={v.nom}
        aide="C'est ce que la cliente voit, et le nom du produit chez Stripe." />

      <Champ nom="argumentaire" libelle="Argumentaire" requis={false}
        valeurParDefaut={v.argumentaire}
        aide="Une phrase courte sous le nom. Par exemple : deux fois par semaine." />

      <Selecteur nom="type" libelle="Type" options={TYPES} valeur={type} onChange={setType} />

      <div className="grid grid-cols-2 gap-4">
        <ChampNombre nom="seances" libelle="Nombre de séances" min={1}
          valeurParDefaut={v.seances ?? 1} />

        {abonnement ? (
          <div>
            <span className="mb-1.5 block text-sm font-semibold">Validité</span>
            <div className="rounded-sm border border-sable-deep bg-sable px-[13px] py-[11px] text-[15px] text-plume-deep">
              4 semaines
            </div>
            <p className="mt-1.5 text-[13px] text-plume-deep">
              Un abonnement se recharge toutes les 4 semaines, jamais tous les
              mois. Ce n&apos;est pas modifiable.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-[1fr_auto] items-start gap-2">
            <ChampNombre nom="validiteNombre" libelle="Validité" min={1}
              valeurParDefaut={v.validiteNombre ?? 3} />
            <Selecteur nom="validiteUnite" libelle="&nbsp;" options={UNITES} />
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Champ nom="prix" clavier="decimal" libelle="Prix en euros" valeurParDefaut={v.prix}
          aide="Par exemple 70 ou 70,50." />
        <Champ nom="prixBarre" clavier="decimal" libelle="Prix barré" requis={false}
          valeurParDefaut={v.prixBarre}
          aide="Le tarif d'avant, affiché rayé. Laisse vide s'il n'y a pas de remise." />
      </div>

      <ChampNombre nom="delai" libelle="Délai d'annulation, en heures" min={0}
        valeurParDefaut={v.delai ?? 24}
        aide="En dessous de ce délai, la cliente ne peut plus annuler et la séance est décomptée." />

      <ZoneTexte nom="puces" libelle="Ce que la formule contient" requis={false}
        valeurParDefaut={v.puces} lignes={4}
        aide="Une ligne par point. Ce sont les puces affichées sur la carte de la vitrine." />

      <div className="grid grid-cols-2 items-start gap-4">
        <ChampNombre nom="ordre" libelle="Ordre d'affichage" min={0}
          valeurParDefaut={v.ordre ?? 0}
          aide="Du plus petit au plus grand, sur la vitrine." />
        <Case nom="miseEnAvant" libelle="Le plus choisi"
          coche={v.miseEnAvant === "on"}
          aide="Met la pastille sur cette formule. Une seule à la fois : les autres la perdent." />
      </div>

      <Bandeau ton="attention" titre="Le prix ne sera plus modifiable après la première vente">
        Dès qu&apos;une cliente achète cette formule, son prix, son nombre de
        séances et sa validité sont figés. Pour changer un tarif, tu créeras une
        nouvelle formule et tu archiveras celle-ci. Vérifie donc les montants
        avant d&apos;enregistrer.
      </Bandeau>

      <BoutonEnvoi enAttente="Création chez Stripe…">
        Je crée la formule
      </BoutonEnvoi>
    </form>
  );
}
