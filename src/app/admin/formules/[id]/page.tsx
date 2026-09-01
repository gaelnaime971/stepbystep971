import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Bandeau } from "@/components/Bandeau";
import { Pastille } from "@/components/Pastille";
import { formuleParId, nombreDeVentes } from "@/lib/formules/lecture";
import { LIBELLE_TYPE, prixLisible, validiteLisible } from "@/lib/formules/format";
import { etatPublication } from "@/lib/formules/types";
import { FormulaireAffichage, FormulaireTarif } from "./formulaires";

export const metadata: Metadata = { title: "Formule — Step by Step" };

export default async function PageFormule({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const formule = await formuleParId(id);
  if (!formule) notFound();

  const ventes = await nombreDeVentes(id);
  const fige = ventes > 0;
  const etat = etatPublication(formule);

  return (
    <>
      <p className="mb-4 text-[15px]">
        <Link href="/admin/formules" className="text-framboise-deep underline underline-offset-[3px]">
          Retour aux formules
        </Link>
      </p>

      <div className="mb-7 flex flex-wrap items-center gap-3">
        <h2>{formule.name}</h2>
        {etat === "publiee" && <Pastille ton="dispo">Achetable</Pastille>}
        {etat === "non_publiee" && <Pastille ton="bientot">Pas achetable</Pastille>}
        {etat === "desactivee" && <Pastille ton="complet">Retirée de la vente</Pastille>}
        {etat === "archivee" && <Pastille ton="complet">Archivée</Pastille>}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="flex flex-col gap-6">
          <section className="rounded-md border border-sable bg-white p-[22px]">
            <h3 className="mb-5">Ce que la cliente voit</h3>
            <FormulaireAffichage formule={formule} />
          </section>

          <section className="rounded-md border border-sable bg-white p-[22px]">
            <h3 className="mb-2">Tarif</h3>

            {fige ? (
              <>
                <Bandeau ton="attention" titre="Ce tarif est figé">
                  <p>
                    {ventes === 1
                      ? "Une cliente a acheté cette formule."
                      : `${ventes} clientes ont acheté cette formule.`}{" "}
                    Son prix, son nombre de séances et sa durée de validité ne
                    peuvent plus changer.
                  </p>
                  <p className="mt-2">
                    C&apos;est volontaire : une cliente qui a payé 70 € pour 8
                    séances doit garder exactement ce qu&apos;elle a acheté. Si
                    le prix changeait sous ses pieds, son historique de paiement
                    ne voudrait plus rien dire, et Stripe refuserait de toute
                    façon de modifier un tarif déjà facturé.
                  </p>
                  <p className="mt-2">
                    Pour appliquer un nouveau tarif : crée une nouvelle formule à
                    partir de celle-ci, puis archive celle-ci. Les abonnées en
                    cours restent sur leur ancien tarif jusqu&apos;à ce
                    qu&apos;elles changent elles-mêmes.
                  </p>
                </Bandeau>

                <dl className="mt-5 flex flex-col gap-3 text-[15px]">
                  {[
                    ["Prix", prixLisible(formule.price_cents)],
                    ["Prix barré", formule.compare_at_price_cents ? prixLisible(formule.compare_at_price_cents) : "aucun"],
                    ["Séances", String(formule.sessions_count)],
                    ["Validité", validiteLisible(formule.validity_interval)],
                    ["Type", LIBELLE_TYPE[formule.kind]],
                  ].map(([cle, valeur]) => (
                    <div key={cle} className="flex justify-between gap-4">
                      <dt className="text-plume-deep">{cle}</dt>
                      <dd className="font-semibold">{valeur}</dd>
                    </div>
                  ))}
                </dl>

                <Link
                  href={`/admin/formules/nouvelle?depuis=${formule.id}`}
                  className="mt-5 inline-flex items-center justify-center rounded-sm bg-framboise px-[22px] py-[13px] text-[15px] font-semibold text-white transition-colors hover:bg-framboise-deep"
                >
                  Créer une nouvelle formule à partir de celle-ci
                </Link>
              </>
            ) : (
              <>
                <p className="mb-5 text-[15px] text-plume-deep">
                  Personne n&apos;a encore acheté cette formule : tu peux encore
                  corriger son tarif. Un nouveau prix sera créé chez Stripe et
                  l&apos;ancien désactivé — un prix Stripe ne se modifie jamais.
                </p>
                <FormulaireTarif formule={formule} />
              </>
            )}
          </section>
        </div>

        <aside className="flex flex-col gap-6">
          <section className="rounded-md border border-sable bg-white p-[22px]">
            <h3 className="mb-4">Chez Stripe</h3>
            {formule.stripe_price_id ? (
              <dl className="flex flex-col gap-3 text-[13px]">
                <div>
                  <dt className="text-plume-deep">Produit</dt>
                  <dd className="break-all font-mono">{formule.stripe_product_id}</dd>
                </div>
                <div>
                  <dt className="text-plume-deep">Prix</dt>
                  <dd className="break-all font-mono">{formule.stripe_price_id}</dd>
                </div>
              </dl>
            ) : (
              <p className="text-[15px] text-ambre">
                Cette formule n&apos;existe pas encore chez Stripe. Tes clientes
                ne peuvent pas l&apos;acheter. Publie-la depuis la liste des
                formules.
              </p>
            )}
          </section>

          <section className="rounded-md border border-sable bg-white p-[22px]">
            <h3 className="mb-4">Ventes</h3>
            <p className="chiffre text-4xl text-framboise">{ventes}</p>
            <p className="mt-1 text-[13px] text-plume-deep">
              {ventes === 0
                ? "Aucune vente pour l'instant."
                : ventes === 1
                  ? "commande passée sur cette formule"
                  : "commandes passées sur cette formule"}
            </p>
          </section>
        </aside>
      </div>
    </>
  );
}
