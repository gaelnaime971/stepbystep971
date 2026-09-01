"use client";

import { useActionState, useState } from "react";
import { Alerte } from "@/components/Alerte";
import { BoutonEnvoi } from "@/components/Bouton";
import { Champ, ChampNombre, Selecteur } from "@/components/Champ";
import { creerPromo } from "@/lib/admin/actions";
import { ETAT_ADMIN_INITIAL } from "@/lib/admin/etat";

const TYPES = [
  { valeur: "percent", libelle: "Un pourcentage de remise" },
  { valeur: "amount", libelle: "Un montant en euros" },
];

const DUREES = [
  { valeur: "once", libelle: "Une seule fois" },
  { valeur: "repeating", libelle: "Pendant plusieurs mois" },
  { valeur: "forever", libelle: "À chaque prélèvement, sans fin" },
];

export function FormulairePromo({ formules }: { formules: { id: string; name: string }[] }) {
  const [etat, action] = useActionState(creerPromo, ETAT_ADMIN_INITIAL);
  const v = etat.valeurs ?? {};
  const [type, setType] = useState(v.type ?? "percent");
  const [duree, setDuree] = useState(v.duree ?? "once");

  return (
    <form action={action} className="flex flex-col gap-5">
      {etat.erreur && (
        <Alerte ton="erreur">
          {etat.erreur}
          {etat.detail && <span className="mt-1 block font-normal">{etat.detail}</span>}
        </Alerte>
      )}

      <Champ nom="code" libelle="Le code" valeurParDefaut={v.code}
        aide="C'est ce que la cliente tapera. En majuscules, sans espace ni accent. Par exemple RENTREE25." />

      <Champ nom="description" libelle="À quoi il sert" requis={false} valeurParDefaut={v.description}
        aide="Pour toi seule, pour t'y retrouver dans six mois." />

      <div className="grid grid-cols-2 gap-3">
        <Selecteur nom="type" libelle="Type de remise" options={TYPES} valeur={type} onChange={setType} />
        <Champ
          nom="valeur"
          clavier="decimal"
          libelle={type === "percent" ? "Pourcentage" : "Montant en euros"}
          valeurParDefaut={v.valeur}
          aide={type === "percent" ? "Par exemple 20 pour −20 %." : "Par exemple 10 pour −10 €."}
        />
      </div>

      <Selecteur nom="duree" libelle="Sur un abonnement, la remise s'applique" options={DUREES}
        valeur={duree} onChange={setDuree}
        aide="Sans effet sur un pack ou une séance à la carte : la remise s'applique une fois." />

      {duree === "repeating" && (
        <ChampNombre nom="mois" libelle="Pendant combien de mois" min={1} valeurParDefaut={v.mois ?? 3} />
      )}

      <div className="grid grid-cols-2 gap-3">
        <ChampNombre nom="maxi" libelle="Nombre d'utilisations" requis={false} min={1}
          valeurParDefaut={v.maxi} aide="Laisse vide pour illimité." />
        <Champ nom="expire" libelle="Expire le" type="date" requis={false}
          valeurParDefaut={v.expire} aide="Vide = sans fin." />
      </div>

      <fieldset className="border-0 p-0">
        <legend className="mb-2 text-sm font-semibold">Limiter à certaines formules</legend>
        <p className="mb-2.5 text-[13px] text-plume-deep">
          Aucune case cochée : le code marche sur tout.
        </p>
        <div className="flex flex-col gap-2">
          {formules.map((f) => (
            <label key={f.id} className="flex cursor-pointer items-center gap-2.5 text-[15px]">
              <input type="checkbox" name="formules" value={f.id} className="h-4 w-4 accent-[#D81840]" />
              {f.name}
            </label>
          ))}
        </div>
      </fieldset>

      <BoutonEnvoi enAttente="Création chez Stripe…">Je crée le code</BoutonEnvoi>
    </form>
  );
}
