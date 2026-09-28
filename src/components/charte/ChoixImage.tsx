/**
 * Le choix sur la diffusion d'image.
 *
 * DEUX BOUTONS RADIO, AUCUN COCHE. Pas une case a cocher : une case decochee
 * ressemble a un refus, mais n'est en realite qu'une question sans reponse — et
 * cochee par defaut, elle serait un consentement que personne n'a donne.
 *
 * Les deux options ont le MEME poids visuel. Mettre « J'autorise » en avant
 * ferait du refus un geste contrariant, alors que l'article 7.4 dit qu'il ne
 * bloque rien.
 */
export function ChoixImage({
  valeur,
  legende = "La diffusion de ton image",
}: {
  /** Le choix en cours, pour la modification. `null` = question jamais posee. */
  valeur?: boolean | null;
  legende?: string;
}) {
  const options = [
    { v: "autorise", libelle: "J'autorise", aide: "Oriane peut publier les photos et vidéos où tu apparais." },
    { v: "refuse", libelle: "Je refuse", aide: "Ton image ne sera pas diffusée. Ça ne t'empêche de rien." },
  ];

  return (
    <fieldset className="border-0 p-0">
      <legend className="mb-1 text-sm font-semibold text-encre">{legende}</legend>
      <p className="mb-3 text-[13px] text-plume-deep">
        Article 7. Ce choix est indépendant du règlement, et tu peux en changer
        quand tu veux depuis ton profil.
      </p>

      <div className="flex flex-col gap-2.5">
        {options.map((o) => (
          <label
            key={o.v}
            className="flex cursor-pointer items-start gap-3 rounded-sm border border-sable-deep bg-white px-4 py-3.5 has-[:checked]:border-framboise has-[:checked]:bg-framboise-wash"
          >
            <input
              type="radio"
              name="autorisationImage"
              value={o.v}
              defaultChecked={
                valeur === true ? o.v === "autorise" : valeur === false ? o.v === "refuse" : false
              }
              className="mt-1 h-[18px] w-[18px] shrink-0 accent-framboise"
            />
            <span>
              <span className="block text-[15px] font-semibold">{o.libelle}</span>
              <span className="mt-0.5 block text-[13px] text-plume-deep">{o.aide}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
