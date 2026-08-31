import type { Metadata } from "next";
import Link from "next/link";
import { Bandeau } from "@/components/Bandeau";
import { Pastille } from "@/components/Pastille";
import {
  archiverFormule,
  desactiverFormule,
  publierFormule,
  reactiverFormule,
} from "@/lib/formules/actions";
import { formulesToutes } from "@/lib/formules/lecture";
import { LIBELLE_TYPE, prixLisible, validiteLisible } from "@/lib/formules/format";
import { etatPublication, type Formule } from "@/lib/formules/types";
import { stripeEnModeTest } from "@/lib/stripe/client";

export const metadata: Metadata = { title: "Formules et tarifs — Step by Step" };

function EtatFormule({ formule }: { formule: Formule }) {
  switch (etatPublication(formule)) {
    case "publiee":
      return <Pastille ton="dispo">Achetable</Pastille>;
    case "non_publiee":
      return <Pastille ton="bientot">Pas achetable</Pastille>;
    case "desactivee":
      return <Pastille ton="complet">Retirée de la vente</Pastille>;
    case "archivee":
      return <Pastille ton="complet">Archivée</Pastille>;
  }
}

function BoutonAction({
  action,
  id,
  children,
  confirmation,
}: {
  action: (donnees: FormData) => Promise<void>;
  id: string;
  children: React.ReactNode;
  confirmation?: string;
}) {
  return (
    <form action={action} className="inline">
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        formNoValidate
        className="cursor-pointer rounded-sm border border-sable-deep bg-white px-3.5 py-2 text-sm font-semibold text-encre transition-colors hover:bg-sable"
        title={confirmation}
      >
        {children}
      </button>
    </form>
  );
}

export default async function PageFormules({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; ton?: string }>;
}) {
  const { message, ton } = await searchParams;
  const formules = await formulesToutes();
  const aPublier = formules.filter((f) => etatPublication(f) === "non_publiee");

  return (
    <>
      <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="mb-2">Formules et tarifs</h2>
          <p className="text-plume">
            Tout se pilote d&apos;ici. Tu n&apos;as jamais besoin d&apos;ouvrir
            Stripe.
          </p>
        </div>
        <Link
          href="/admin/formules/nouvelle"
          className="inline-flex items-center justify-center rounded-sm bg-framboise px-[22px] py-[13px] text-[15px] font-semibold text-white transition-colors hover:bg-framboise-deep"
        >
          Créer une formule
        </Link>
      </div>

      <div className="mb-6 flex flex-col gap-3">
        {message && (
          <Bandeau ton={ton === "erreur" ? "erreur" : "succes"}>{message}</Bandeau>
        )}

        {aPublier.length > 0 && (
          <Bandeau
            ton="attention"
            titre={
              aPublier.length === 1
                ? "Une formule n'est pas achetable"
                : `${aPublier.length} formules ne sont pas achetables`
            }
          >
            {aPublier.map((f) => f.name).join(", ")} — pas encore publiée
            {aPublier.length > 1 ? "s" : ""} sur Stripe. Tant que c&apos;est le
            cas, tes clientes ne peuvent pas les acheter. Clique sur « Publier »
            sur chaque ligne.
          </Bandeau>
        )}

        {stripeEnModeTest() && (
          <Bandeau ton="attention">
            Stripe est en mode test. Les paiements ne sont pas réels.
          </Bandeau>
        )}
      </div>

      <div className="overflow-x-auto rounded-md border border-sable bg-white">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {["Formule", "Type", "Séances", "Validité", "Prix", "État", ""].map((t) => (
                <th
                  key={t}
                  className="border-b border-sable px-3 py-2.5 text-left text-[13px] font-semibold text-plume"
                >
                  {t}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {formules.map((f) => {
              const etat = etatPublication(f);
              return (
                <tr key={f.id} className={f.archived_at ? "opacity-60" : ""}>
                  <td className="border-b border-sable px-3 py-3.5 text-[15px]">
                    <Link href={`/admin/formules/${f.id}`} className="font-semibold underline underline-offset-[3px]">
                      {f.name}
                    </Link>
                    {f.is_highlighted && (
                      <span className="ml-2">
                        <Pastille ton="rose">Le plus choisi</Pastille>
                      </span>
                    )}
                    {f.tagline && <p className="text-[13px] text-plume">{f.tagline}</p>}
                  </td>
                  <td className="border-b border-sable px-3 py-3.5 text-[15px]">
                    {LIBELLE_TYPE[f.kind]}
                  </td>
                  <td className="border-b border-sable px-3 py-3.5">
                    <span className="chiffre text-lg">{f.sessions_count}</span>
                  </td>
                  <td className="border-b border-sable px-3 py-3.5 text-[15px]">
                    {validiteLisible(f.validity_interval)}
                  </td>
                  <td className="border-b border-sable px-3 py-3.5 text-[15px]">
                    <span className="chiffre text-lg text-framboise">
                      {prixLisible(f.price_cents)}
                    </span>
                    {f.compare_at_price_cents && (
                      <span className="ml-2 text-sable-deep line-through">
                        {prixLisible(f.compare_at_price_cents)}
                      </span>
                    )}
                  </td>
                  <td className="border-b border-sable px-3 py-3.5">
                    <EtatFormule formule={f} />
                  </td>
                  <td className="border-b border-sable px-3 py-3.5">
                    <div className="flex flex-wrap justify-end gap-2">
                      {etat === "non_publiee" && (
                        <BoutonAction action={publierFormule} id={f.id}>
                          Publier sur Stripe
                        </BoutonAction>
                      )}
                      {etat === "publiee" && (
                        <BoutonAction action={desactiverFormule} id={f.id}>
                          Retirer de la vente
                        </BoutonAction>
                      )}
                      {etat === "desactivee" && (
                        <>
                          <BoutonAction action={reactiverFormule} id={f.id}>
                            Remettre en vente
                          </BoutonAction>
                          <BoutonAction action={archiverFormule} id={f.id}>
                            Archiver
                          </BoutonAction>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-[13px] text-plume">
        Retirer de la vente est réversible : la formule disparaît de la vitrine,
        tu peux la remettre quand tu veux. Archiver est définitif. Dans les deux
        cas, les clientes qui ont déjà acheté gardent leurs séances.
      </p>
    </>
  );
}
