"use client";

import { useActionState } from "react";
import { Alerte } from "@/components/Alerte";
import { BoutonEnvoi } from "@/components/Bouton";
import { Champ, ChampNombre, Selecteur, ZoneTexte } from "@/components/Champ";
import { ConfirmerAction } from "@/components/ConfirmerAction";
import { crediterSeances, retirerSeances } from "@/lib/admin/actions";
import { ETAT_ADMIN_INITIAL } from "@/lib/admin/etat";

function Erreur({ erreur, detail }: { erreur?: string; detail?: string }) {
  if (!erreur) return null;
  return (
    <Alerte ton="erreur">
      {erreur}
      {detail && <span className="mt-1 block font-normal">{detail}</span>}
    </Alerte>
  );
}

export function FormulaireCredit({
  clienteId,
  dateParDefaut,
}: {
  clienteId: string;
  dateParDefaut: string;
}) {
  const [etat, action] = useActionState(crediterSeances, ETAT_ADMIN_INITIAL);
  const v = etat.valeurs ?? {};

  return (
    <form action={action} className="flex flex-col gap-4">
      <Erreur erreur={etat.erreur} detail={etat.detail} />
      <input type="hidden" name="clienteId" value={clienteId} />
      <div className="grid grid-cols-2 gap-3">
        <ChampNombre nom="nombre" libelle="Séances à ajouter" min={1} valeurParDefaut={v.nombre ?? 1} />
        <Champ nom="expire" libelle="Valables jusqu'au" type="date"
          valeurParDefaut={v.expire ?? dateParDefaut} />
      </div>
      <Champ nom="motif" libelle="Motif" valeurParDefaut={v.motif}
        aide="Obligatoire. C'est ce que tu reliras dans six mois." />
      <BoutonEnvoi enAttente="Ajout…">J&apos;ajoute les séances</BoutonEnvoi>
    </form>
  );
}

export function FormulaireRetrait({
  clienteId,
  lots,
}: {
  clienteId: string;
  lots: { valeur: string; libelle: string }[];
}) {
  const [etat, action] = useActionState(retirerSeances, ETAT_ADMIN_INITIAL);
  const v = etat.valeurs ?? {};

  return (
    <form action={action} className="flex flex-col gap-4">
      <Erreur erreur={etat.erreur} detail={etat.detail} />
      <input type="hidden" name="clienteId" value={clienteId} />
      <Selecteur
        nom="lotId"
        libelle="Sur quel lot"
        options={[{ valeur: "", libelle: "Le lot qui expire le plus tard" }, ...lots]}
        valeurParDefaut={v.lotId}
        aide="Le cas courant est de corriger un lot que tu viens d'ajouter."
      />
      <ChampNombre nom="nombre" libelle="Séances à retirer" min={1} valeurParDefaut={v.nombre ?? 1} />
      <Champ nom="motif" libelle="Motif" valeurParDefaut={v.motif} aide="Obligatoire." />
      <BoutonEnvoi enAttente="Retrait…">Je retire les séances</BoutonEnvoi>
    </form>
  );
}

/** Anonymisation RGPD. Confirmation par un mot tape, le geste est definitif. */
export function FormulaireAnonymisation({
  clienteId,
  nom,
  action,
}: {
  clienteId: string;
  nom: string;
  action: (donnees: FormData) => Promise<void>;
}) {
  return (
    <ConfirmerAction
      action={action}
      variante="danger"
      declencheur="Anonymiser ce compte"
      champs={{ clienteId }}
      avertissement={
        <>
          Le nom, l&apos;email, le téléphone et les notes de{" "}
          <strong>{nom}</strong> seront remplacés. Ses achats restent, sans son
          nom : la comptabilité l&apos;exige. C&apos;est définitif.
        </>
      }
      confirmer="J'anonymise"
      enfants={<Champ nom="confirmation" libelle="Écris ANONYMISER pour confirmer" />}
    />
  );
}

export function FormulaireNotes({
  clienteId,
  notes,
  action,
}: {
  clienteId: string;
  notes: string;
  action: (donnees: FormData) => Promise<void>;
}) {
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="clienteId" value={clienteId} />
      <ZoneTexte
        nom="notes"
        libelle="Notes privées"
        requis={false}
        valeurParDefaut={notes}
        lignes={5}
        aide="Elle ne les verra jamais. Personne d'autre que toi n'y a accès."
      />
      <button
        type="submit"
        className="self-start cursor-pointer rounded-sm border border-sable-deep bg-white px-[18px] py-2.5 text-sm font-semibold hover:bg-sable"
      >
        J&apos;enregistre les notes
      </button>
    </form>
  );
}
