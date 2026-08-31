type Props = {
  nom: string;
  libelle: string;
  type?: "text" | "email" | "password" | "tel";
  valeurParDefaut?: string;
  requis?: boolean;
  autoComplete?: string;
  aide?: string;
};

export function Champ({
  nom,
  libelle,
  type = "text",
  valeurParDefaut,
  requis = true,
  autoComplete,
  aide,
}: Props) {
  const idAide = aide ? `${nom}-aide` : undefined;

  return (
    <div>
      <label htmlFor={nom} className="mb-1.5 block text-sm font-semibold">
        {libelle}
        {!requis && <span className="ml-1.5 font-normal text-plume">facultatif</span>}
      </label>
      <input
        id={nom}
        name={nom}
        type={type}
        required={requis}
        defaultValue={valeurParDefaut}
        autoComplete={autoComplete}
        aria-describedby={idAide}
        className="w-full rounded-sm border border-sable-deep bg-white px-[13px] py-[11px] text-[15px] text-encre focus:border-transparent focus:outline-2 focus:outline-offset-[-1px] focus:outline-framboise"
      />
      {aide && (
        <p id={idAide} className="mt-1.5 text-[13px] text-plume">
          {aide}
        </p>
      )}
    </div>
  );
}
