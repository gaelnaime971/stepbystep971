import type { Metadata } from "next";
import { Bandeau } from "@/components/Bandeau";
import { BoutonAchat } from "@/components/BoutonAchat";
import { Pastille } from "@/components/Pastille";
import { PedagogieFormule } from "@/components/PedagogieFormule";
import { ouvrirPortail } from "@/lib/compte/actions";
import {
  formulesEnVente, formulesLisibles, lotsActifs, lotsParIds, mesAchats,
  mesReservations, monAbonnement,
} from "@/lib/compte/lecture";
import type { Abonnement } from "@/lib/compte/types";
import { enDate, enDateAnnee } from "@/lib/dates";
import { prixLisible } from "@/lib/formules/format";

export const metadata: Metadata = { title: "Ma formule — Step by Step" };

function etatAbonnement(a: Abonnement): {
  ton: "dispo" | "bientot" | "complet";
  libelle: string;
  explication: string;
} {
  if (a.dunning_exhausted_at || a.status === "unpaid") {
    return {
      ton: "complet",
      libelle: "Paiement en échec",
      explication:
        "Les tentatives de prélèvement ont toutes échoué. Ton abonnement ne se rechargera pas au prochain cycle. Mets à jour ta carte depuis le portail pour le relancer.",
    };
  }
  if (a.payment_failed_at || a.status === "past_due") {
    return {
      ton: "bientot",
      libelle: "Paiement en attente",
      explication:
        "Le dernier prélèvement n'est pas passé. Ta banque et Stripe vont réessayer d'eux-mêmes dans les prochains jours. Tes séances en cours ne bougent pas.",
    };
  }
  if (a.cancel_at_period_end) {
    return {
      ton: "bientot",
      libelle: "Résilié",
      explication: a.current_period_end
        ? `Tu gardes tes séances jusqu'au ${enDate(a.current_period_end)}. Aucun prélèvement après.`
        : "Aucun prélèvement à venir.",
    };
  }
  return {
    ton: "dispo",
    libelle: "En cours",
    explication:
      "À chaque prélèvement, ton solde repart au nombre de séances de la formule. Le reliquat n'est pas reporté.",
  };
}

export default async function PageMaFormule({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; ton?: string }>;
}) {
  const { message, ton } = await searchParams;
  const [abo, achats, lots, enVente, reservations] = await Promise.all([
    monAbonnement(), mesAchats(), lotsActifs(), formulesEnVente(), mesReservations(),
  ]);

  // Les lots qui financent une reservation en cours comptent aussi, meme vides :
  // leur delai d'annulation s'applique encore a la seance deja posee.
  const lotsDesReservations = await lotsParIds(reservations.map((r) => r.credit_lot_id));
  const lotsConcernes = [
    ...new Map([...lots, ...lotsDesReservations].map((l) => [l.id, l])).values(),
  ];

  const formules = await formulesLisibles([
    ...(abo ? [abo.plan_id] : []),
    ...achats.map((a) => a.plan_id),
    ...lotsConcernes.map((l) => l.plan_id ?? ""),
  ]);

  const etat = abo ? etatAbonnement(abo) : null;
  const formuleAbo = abo ? formules.get(abo.plan_id) : undefined;

  // Le delai d'annulation est un parametre PAR FORMULE (regle 6) : on affiche
  // celui de chaque formule qui finance encore des seances, pas un 24 h en dur.
  const delais = [
    ...new Map(
      lotsConcernes
        .map((l) => formules.get(l.plan_id ?? ""))
        .filter((f): f is NonNullable<typeof f> => !!f)
        .map((f) => [f.id, f]),
    ).values(),
  ];

  return (
    <>
      {message && (
        <div className="mb-5">
          <Bandeau ton={ton === "erreur" ? "erreur" : "succes"}>{message}</Bandeau>
        </div>
      )}

      <h2 className="mb-6">Ma formule</h2>

      <div className="grid items-start gap-[22px] lg:grid-cols-[1.4fr_1fr]">
        <div className="flex flex-col gap-[22px]">
          <section className="rounded-md border border-sable bg-white p-[22px]">
            {abo && etat ? (
              <>
                <div className="mb-4 flex flex-wrap items-center gap-3">
                  <h3>{formuleAbo?.name ?? "Abonnement"}</h3>
                  <Pastille ton={etat.ton}>{etat.libelle}</Pastille>
                </div>

                <div className="flex flex-col">
                  {[
                    ["Montant", formuleAbo ? `${prixLisible(formuleAbo.price_cents)} toutes les 4 semaines` : "—"],
                    [
                      abo.cancel_at_period_end ? "Fin de validité" : "Prochain paiement",
                      abo.current_period_end ? enDate(abo.current_period_end) : "—",
                    ],
                  ].map(([cle, valeur]) => (
                    <div key={cle} className="flex justify-between gap-3 py-2.5 text-[15px]">
                      <span className="text-plume-deep">{cle}</span>
                      <span className="font-medium">{valeur}</span>
                    </div>
                  ))}
                </div>

                <p className="mt-3 text-[15px] text-plume-deep">{etat.explication}</p>
              </>
            ) : (
              <>
                <h3 className="mb-2">Tu n&apos;as pas d&apos;abonnement</h3>
                <p className="text-[15px] text-plume-deep">
                  Tes séances viennent d&apos;achats ponctuels, ou tu n&apos;en
                  as pas encore pris. Un abonnement se recharge tout seul toutes
                  les 4 semaines.
                </p>
              </>
            )}

            <form action={ouvrirPortail} className="mt-4">
              <button
                type="submit"
                className="w-full cursor-pointer rounded-sm border border-sable-deep bg-white px-3.5 py-2 text-sm font-semibold text-encre transition-colors hover:bg-sable"
              >
                Gérer mon abonnement
              </button>
            </form>
            <p className="mt-2.5 text-[13px] text-plume-deep">
              Changer de carte, télécharger tes factures ou résilier. Tout se
              passe chez Stripe, en sécurité.
            </p>
          </section>

          {delais.length > 0 && (
            <section className="rounded-md border border-sable bg-white p-5 sm:p-[22px]">
              <h3 className="mb-1">Comment marchent tes séances</h3>
              <p className="mb-5 text-[13px] text-plume-deep">
                Les règles de la formule qui finance ton solde. Elles ne changent
                pas en cours de route.
              </p>
              {delais.map((f) => (
                <div key={f.id} className="border-b border-sable pb-5 last:border-b-0 last:pb-0 [&+&]:pt-5">
                  {delais.length > 1 && (
                    <p className="mb-3 text-[15px] font-semibold">{f.name}</p>
                  )}
                  <PedagogieFormule
                    forme="bloc"
                    kind={f.kind}
                    seances={f.sessions_count}
                    validite={f.validity_interval}
                    delaiHeures={f.cancellation_deadline_hours}
                  />
                </div>
              ))}
            </section>
          )}

          <section className="rounded-md border border-sable bg-white p-[22px]">
            <h3 className="mb-4">Mes achats</h3>
            {achats.length === 0 ? (
              <p className="px-4 py-8 text-center text-[15px] text-plume-deep">
                Aucun achat pour l&apos;instant.
              </p>
            ) : (
              achats.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between gap-3 border-b border-sable py-3 last:border-b-0"
                >
                  <div>
                    <p className="text-[15px] font-medium">
                      {formules.get(a.plan_id)?.name ?? "Formule"}
                    </p>
                    <p className="text-sm text-plume-deep">
                      {a.paid_at ? enDateAnnee(a.paid_at) : enDateAnnee(a.created_at)}
                      {a.kind === "subscription_cycle" && " · prélèvement"}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[15px] font-medium">
                      {prixLisible(a.amount_cents)}
                    </span>
                    {a.status === "refunded" && <Pastille ton="complet">Remboursé</Pastille>}
                    {a.status === "pending" && <Pastille ton="bientot">En attente</Pastille>}
                  </div>
                </div>
              ))
            )}
          </section>
        </div>

        <section className="rounded-md border border-sable bg-white p-[22px]">
          <h3 className="mb-2">Recharger mon solde</h3>
          <p className="mb-4 text-[15px] text-plume-deep">
            Toutes les formules te créditent des séances. Tu les places ensuite
            où tu veux dans le planning.
          </p>
          {enVente.length === 0 ? (
            <p className="text-[15px] text-plume-deep">
              Aucune formule en vente pour l&apos;instant.
            </p>
          ) : (
            enVente.map((f) => (
              <div key={f.id} className="border-b border-sable py-4 last:border-b-0">
                <div className="mb-3 flex items-baseline justify-between gap-3">
                  <span className="text-[15px] font-medium">{f.name}</span>
                  <span className="chiffre text-lg text-framboise">
                    {prixLisible(f.price_cents)}
                  </span>
                </div>
                <BoutonAchat
                  slug={f.slug}
                  variante="ligne"
                  libelle={f.kind === "subscription" ? "Je m'abonne" : "Je prends"}
                />
              </div>
            ))
          )}
          <p className="mt-4 text-[13px] text-plume-deep">
            Paiement par carte, sécurisé par Stripe. Tu pourras entrer un code
            promo à l&apos;étape suivante.
          </p>
        </section>
      </div>
    </>
  );
}
