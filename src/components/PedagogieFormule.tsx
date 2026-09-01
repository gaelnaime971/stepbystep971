import { validiteLisible } from "@/lib/formules/format";

type Props = {
  kind: string;
  seances: number;
  validite: string;
  delaiHeures: number;
  /** `carte` sur la vitrine, repliée. `bloc` sur « Ma formule », dépliée. */
  forme?: "carte" | "bloc";
};

/**
 * Les regles de la maison, dites avant l'achat.
 *
 * Ce ne sont pas des conditions generales : ce sont les trois choses qui
 * feront reagir une cliente le jour ou elles s'appliquent — l'expiration sans
 * report, le reset de l'abonnement, le delai d'annulation. Les dire avant
 * evite le litige apres. Ton factuel, jamais culpabilisant : on explique une
 * mecanique, on ne fait pas la morale.
 */
export function PedagogieFormule({ kind, seances, validite, delaiHeures, forme = "carte" }: Props) {
  const abonnement = kind === "subscription";

  const points: [string, string][] = abonnement
    ? [
        [
          "Ton solde repart à zéro à chaque prélèvement",
          `Toutes les 4 semaines, tu es recréditée de ${seances} séances. Ce qui reste du cycle précédent n'est pas ajouté : le compteur repart à ${seances}, pas plus.`,
        ],
        [
          "Tu peux arrêter quand tu veux",
          "Deux clics depuis ton compte, sans préavis ni justification. Tu gardes tes séances jusqu'à la fin de la période déjà payée.",
        ],
        [
          `Annulation jusqu'à ${delaiHeures} h avant le cours`,
          `Tu récupères ta séance sur ton solde. Passé ce délai, elle est décomptée — la place est restée bloquée pour toi.`,
        ],
      ]
    : [
        [
          `Tes séances sont valables ${validiteLisible(validite)}`,
          `Le compte à rebours démarre à l'achat. Passé cette date, les séances que tu n'as pas utilisées sont perdues : il n'y a pas de report.`,
        ],
        [
          "Tu choisis tes cours toi-même",
          "Aucune date n'est imposée. Tu ouvres le planning depuis ton compte et tu places tes séances où ça t'arrange, dans le lieu qui te va.",
        ],
        [
          `Annulation jusqu'à ${delaiHeures} h avant le cours`,
          `Tu récupères ta séance sur ton solde. Passé ce délai, elle est décomptée — la place est restée bloquée pour toi.`,
        ],
      ];

  const contenu = (
    <div className="flex flex-col gap-3">
      {points.map(([titre, texte]) => (
        <div key={titre}>
          <p className="text-[14px] font-semibold text-encre">{titre}</p>
          <p className="mt-0.5 text-[14px] leading-[1.55] text-plume">{texte}</p>
        </div>
      ))}
      <p className="text-[13px] text-plume">
        Choisis la formule qui colle à ton rythme réel plutôt qu&apos;à celui que
        tu vises. En cas de doute, prends plus petit.
      </p>
    </div>
  );

  if (forme === "bloc") return contenu;

  // Le libelle replie porte deja le fait qui compte. Une visiteuse qui
  // n'ouvre jamais le panneau — la majorite — doit tout de meme lire la regle
  // qui la surprendra plus tard.
  const resume = abonnement
    ? `Rechargé tous les 28 jours, sans cumul`
    : `Valables ${validiteLisible(validite)}, sans report`;

  return (
    <details className="group mt-4 border-t border-sable pt-3">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-left text-[14px] font-semibold text-framboise-deep [&::-webkit-details-marker]:hidden">
        <span>
          {resume}
          <span className="ml-1.5 font-normal text-plume">en savoir plus</span>
        </span>
        <span aria-hidden="true" className="shrink-0 text-lg leading-none">
          <span className="group-open:hidden">+</span>
          <span className="hidden group-open:inline">–</span>
        </span>
      </summary>
      <div className="mt-3">{contenu}</div>
    </details>
  );
}
