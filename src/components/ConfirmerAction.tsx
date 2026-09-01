/**
 * Un geste destructeur demande deux clics.
 *
 * `<details>` plutot qu'une fenetre modale : cela fonctionne sans JavaScript,
 * au clavier et pour un lecteur d'ecran, et le repli est du ressort du
 * navigateur. Le premier clic ouvre et EXPLIQUE ce qui va se passer, le second
 * agit. Refermer, c'est recliquer sur le declencheur, toujours visible.
 *
 * L'avertissement doit dire la CONSEQUENCE, pas « êtes-vous sûr » : personne
 * ne lit « êtes-vous sûr », tout le monde lit « 12 inscrites seront prévenues ».
 */
export function ConfirmerAction({
  action,
  declencheur,
  avertissement,
  confirmer,
  champs = {},
  enfants,
  variante = "discret",
}: {
  action: (donnees: FormData) => Promise<void>;
  declencheur: string;
  avertissement: React.ReactNode;
  confirmer: string;
  champs?: Record<string, string>;
  /** Champs supplémentaires à saisir avant de confirmer. */
  enfants?: React.ReactNode;
  variante?: "discret" | "danger";
}) {
  const styleDeclencheur =
    variante === "danger"
      ? "border-framboise text-framboise hover:bg-framboise-wash"
      : "border-sable-deep text-encre hover:bg-sable";

  return (
    <details className="group">
      <summary
        className={`inline-flex cursor-pointer list-none items-center rounded-sm border bg-white px-[18px] py-3 text-sm font-semibold sm:py-2.5 transition-colors [&::-webkit-details-marker]:hidden ${styleDeclencheur}`}
      >
        {declencheur}
      </summary>

      <form action={action} className="mt-4 flex flex-col gap-3">
        {Object.entries(champs).map(([nom, valeur]) => (
          <input key={nom} type="hidden" name={nom} value={valeur} />
        ))}

        <div className="rounded-sm border-l-[3px] border-ambre bg-ambre-wash px-4 py-3 text-[15px] leading-[1.55] text-ambre-texte">
          {avertissement}
        </div>

        {enfants}

        <button
          type="submit"
          className="self-start cursor-pointer rounded-sm bg-framboise px-[18px] py-3 text-sm font-semibold sm:py-2.5 text-white transition-colors hover:bg-framboise-deep"
        >
          {confirmer}
        </button>
      </form>
    </details>
  );
}
