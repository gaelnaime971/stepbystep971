"use client";

import { useActionState } from "react";
import { Alerte } from "@/components/Alerte";
import { BoutonEnvoi } from "@/components/Bouton";
import { Case, Champ, ChampNombre, Selecteur, ZoneTexte } from "@/components/Champ";
import { corrigerTarif, modifierFormule } from "@/lib/formules/actions";
import { ETAT_FORMULE_INITIAL } from "@/lib/formules/etat";
import { centimesEnEuros } from "@/lib/formules/format";
import type { Formule } from "@/lib/formules/types";

const UNITES = [
  { valeur: "months", libelle: "mois" },
  { valeur: "weeks", libelle: "semaines" },
  { valeur: "days", libelle: "jours" },
];

function Erreur({ erreur, detail }: { erreur?: string; detail?: string }) {
  if (!erreur) return null;
  return (
    <Alerte ton="erreur">
      {erreur}
      {detail && <span className="mt-1 block font-normal">{detail}</span>}
    </Alerte>
  );
}

export function FormulaireAffichage({ formule }: { formule: Formule }) {
  const [etat, action] = useActionState(modifierFormule, ETAT_FORMULE_INITIAL);

  return (
    <form action={action} className="flex flex-col gap-5">
      <Erreur erreur={etat.erreur} detail={etat.detail} />
      <input type="hidden" name="id" value={formule.id} />

      <Champ nom="nom" libelle="Nom de la formule" valeurParDefaut={formule.name}
        aide="Le nom du produit chez Stripe suit automatiquement." />
      <Champ nom="argumentaire" libelle="Argumentaire" requis={false}
        valeurParDefaut={formule.tagline ?? ""} />
      <ZoneTexte nom="puces" libelle="Ce que la formule contient" requis={false}
        valeurParDefaut={formule.features.join("\n")}
        aide="Une ligne par point." />
      <ChampNombre nom="delai" libelle="Délai d'annulation, en heures" min={0}
        valeurParDefaut={formule.cancellation_deadline_hours} />
      <div className="grid grid-cols-2 items-start gap-4">
        <ChampNombre nom="ordre" libelle="Ordre d'affichage" min={0}
          valeurParDefaut={formule.sort_order} />
        <Case nom="miseEnAvant" libelle="Le plus choisi" coche={formule.is_highlighted}
          aide="Une seule formule à la fois." />
      </div>

      <BoutonEnvoi enAttente="Enregistrement…">J&apos;enregistre</BoutonEnvoi>
    </form>
  );
}

export function FormulaireTarif({ formule }: { formule: Formule }) {
  const [etat, action] = useActionState(corrigerTarif, ETAT_FORMULE_INITIAL);
  const abonnement = formule.kind === "subscription";

  return (
    <form action={action} className="flex flex-col gap-5">
      <Erreur erreur={etat.erreur} detail={etat.detail} />
      <input type="hidden" name="id" value={formule.id} />

      <div className="grid grid-cols-2 gap-4">
        <Champ nom="prix" libelle="Prix en euros"
          valeurParDefaut={centimesEnEuros(formule.price_cents)} />
        <Champ nom="prixBarre" libelle="Prix barré" requis={false}
          valeurParDefaut={
            formule.compare_at_price_cents
              ? centimesEnEuros(formule.compare_at_price_cents)
              : ""
          } />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <ChampNombre nom="seances" libelle="Nombre de séances" min={1}
          valeurParDefaut={formule.sessions_count} />
        {abonnement ? (
          <div>
            <span className="mb-1.5 block text-sm font-semibold">Validité</span>
            <div className="rounded-sm border border-sable-deep bg-sable px-[13px] py-[11px] text-[15px] text-plume">
              4 semaines
            </div>
            <p className="mt-1.5 text-[13px] text-plume">
              Non modifiable sur un abonnement.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-[1fr_auto] items-start gap-2">
            <ChampNombre nom="validiteNombre" libelle="Validité" min={1} valeurParDefaut={3} />
            <Selecteur nom="validiteUnite" libelle="&nbsp;" options={UNITES} />
          </div>
        )}
      </div>

      <BoutonEnvoi enAttente="Mise à jour chez Stripe…">
        Je corrige le tarif
      </BoutonEnvoi>
    </form>
  );
}
