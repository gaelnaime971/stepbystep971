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

type PropsCommunes = {
  nom: string;
  libelle: string;
  aide?: string;
  requis?: boolean;
};

function Enveloppe({
  nom,
  libelle,
  aide,
  requis,
  children,
}: PropsCommunes & { children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={nom} className="mb-1.5 block text-sm font-semibold">
        {libelle}
        {requis === false && (
          <span className="ml-1.5 font-normal text-plume">facultatif</span>
        )}
      </label>
      {children}
      {aide && (
        <p id={`${nom}-aide`} className="mt-1.5 text-[13px] text-plume">
          {aide}
        </p>
      )}
    </div>
  );
}

const STYLE_CHAMP =
  "w-full rounded-sm border border-sable-deep bg-white px-[13px] py-[11px] text-[15px] text-encre focus:border-transparent focus:outline-2 focus:outline-offset-[-1px] focus:outline-framboise disabled:bg-sable disabled:text-plume";

export function ZoneTexte(
  props: PropsCommunes & { valeurParDefaut?: string; lignes?: number },
) {
  return (
    <Enveloppe {...props}>
      <textarea
        id={props.nom}
        name={props.nom}
        rows={props.lignes ?? 4}
        defaultValue={props.valeurParDefaut}
        aria-describedby={props.aide ? `${props.nom}-aide` : undefined}
        className={STYLE_CHAMP}
      />
    </Enveloppe>
  );
}

export function ChampNombre(
  props: PropsCommunes & {
    valeurParDefaut?: string | number;
    min?: number;
    max?: number;
    pas?: number;
    desactive?: boolean;
  },
) {
  return (
    <Enveloppe {...props}>
      <input
        id={props.nom}
        name={props.nom}
        type="number"
        min={props.min}
        max={props.max}
        step={props.pas}
        required={props.requis !== false}
        disabled={props.desactive}
        defaultValue={props.valeurParDefaut}
        aria-describedby={props.aide ? `${props.nom}-aide` : undefined}
        className={STYLE_CHAMP}
      />
    </Enveloppe>
  );
}

export function Selecteur(
  props: PropsCommunes & {
    options: ReadonlyArray<{ valeur: string; libelle: string }>;
    valeur?: string;
    onChange?: (valeur: string) => void;
    desactive?: boolean;
  },
) {
  return (
    <Enveloppe {...props}>
      <select
        id={props.nom}
        name={props.nom}
        value={props.valeur}
        disabled={props.desactive}
        onChange={props.onChange ? (e) => props.onChange!(e.target.value) : undefined}
        aria-describedby={props.aide ? `${props.nom}-aide` : undefined}
        className={STYLE_CHAMP}
      >
        {props.options.map((o) => (
          <option key={o.valeur} value={o.valeur}>
            {o.libelle}
          </option>
        ))}
      </select>
    </Enveloppe>
  );
}

export function Case({
  nom,
  libelle,
  aide,
  coche,
}: {
  nom: string;
  libelle: string;
  aide?: string;
  coche?: boolean;
}) {
  return (
    <div>
      <label className="flex cursor-pointer items-start gap-2.5 text-[15px]">
        <input
          type="checkbox"
          name={nom}
          defaultChecked={coche}
          className="mt-1 h-4 w-4 accent-[#D81840]"
        />
        <span className="font-semibold">{libelle}</span>
      </label>
      {aide && <p className="mt-1.5 ml-[26px] text-[13px] text-plume">{aide}</p>}
    </div>
  );
}
