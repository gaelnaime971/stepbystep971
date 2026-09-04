const QUESTIONS: [string, string][] = [
  [
    "Je n'ai jamais fait de Fitness Step, je peux venir ?",
    "Oui, c'est l'idée : les cours sont ouverts et accessibles à tous. Les mouvements sont montrés, décortiqués et adaptés. Prends une séance à la carte pour tester.",
  ],
  [
    "Comment je réserve ma place ?",
    "Tu achètes une formule et tes séances sont ensuite créditées. Depuis ton compte personnel, tu ouvres le planning et tu cliques sur les cours qui te conviennent. Chaque inscription retire une séance de ton solde.",
  ],
  [
    "Et si j'ai un empêchement ?",
    "Tu peux annuler jusqu'à 24 heures avant le cours : la séance revient alors sur ton solde. Passé ce délai, elle est décomptée. Ce délai dépend de ta formule.",
  ],
  [
    "Mes séances non utilisées sont perdues ?",
    "À la fin de la période, oui. Un abonnement se recharge à chaque prélèvement et un pack est valable 3 mois. Choisis la formule qui colle à ton rythme réel plutôt qu'à celui que tu vises.",
  ],
  [
    "Je peux arrêter mon abonnement ?",
    "À tout moment, depuis ton compte, en deux clics. Tu gardes tes séances jusqu'à la fin de la période déjà payée.",
  ],
];

/**
 * `<details>` natif : l'accordeon fonctionne sans une ligne de JavaScript, y
 * compris au clavier et pour un lecteur d'ecran.
 */
export function Faq() {
  return (
    <div>
      {QUESTIONS.map(([question, reponse], i) => (
        <details key={question} open={i === 0} className="group border-b border-sable py-[18px]">
          <summary className="flex cursor-pointer list-none items-baseline justify-between gap-4 font-display text-[18px] font-semibold italic [&::-webkit-details-marker]:hidden">
            {question}
            <span
              aria-hidden="true"
              className="font-texte text-[22px] leading-none font-normal text-framboise not-italic"
            >
              <span className="group-open:hidden">+</span>
              <span className="hidden group-open:inline">–</span>
            </span>
          </summary>
          <p className="mt-3 max-w-[62ch] text-encre-soft">{reponse}</p>
        </details>
      ))}
    </div>
  );
}
