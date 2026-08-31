import type { Metadata } from "next";
import Link from "next/link";
import { Bandeau } from "@/components/Bandeau";
import { Pastille } from "@/components/Pastille";
import { clientServeur } from "@/lib/supabase/server";
import { enDateAnnee } from "@/lib/dates";
import { prixLisible } from "@/lib/formules/format";
import { stripeEnModeTest } from "@/lib/stripe/client";

export const metadata: Metadata = { title: "Paiements — Step by Step" };

const STRIPE = (chemin: string) =>
  `https://dashboard.stripe.com${stripeEnModeTest() ? "/test" : ""}${chemin}`;

const STATUTS: Record<string, { libelle: string; ton: "dispo" | "bientot" | "complet" }> = {
  paid: { libelle: "Payé", ton: "dispo" },
  pending: { libelle: "En attente", ton: "bientot" },
  failed: { libelle: "Échoué", ton: "complet" },
  refunded: { libelle: "Remboursé", ton: "complet" },
  partially_refunded: { libelle: "Partiellement remboursé", ton: "bientot" },
};

export default async function PagePaiements() {
  const supabase = await clientServeur();

  const [commandes, abos, evenements] = await Promise.all([
    supabase.from("orders")
      .select("id, user_id, plan_id, kind, status, amount_cents, refunded_amount_cents, paid_at, created_at, stripe_payment_intent_id, stripe_invoice_id")
      .order("created_at", { ascending: false }).limit(100)
      .returns<{ id: string; user_id: string; plan_id: string; kind: string; status: string; amount_cents: number; refunded_amount_cents: number; paid_at: string | null; created_at: string; stripe_payment_intent_id: string | null; stripe_invoice_id: string | null }[]>(),
    supabase.from("subscriptions")
      .select("id, user_id, plan_id, status, current_period_end, cancel_at_period_end, payment_failed_at, dunning_exhausted_at, stripe_subscription_id")
      .order("created_at", { ascending: false })
      .returns<{ id: string; user_id: string; plan_id: string; status: string; current_period_end: string | null; cancel_at_period_end: boolean; payment_failed_at: string | null; dunning_exhausted_at: string | null; stripe_subscription_id: string }[]>(),
    supabase.from("stripe_events")
      .select("id, type, received_at, error").is("processed_at", null)
      .order("received_at", { ascending: false }).limit(20)
      .returns<{ id: string; type: string; received_at: string; error: string | null }[]>(),
  ]);

  const ids = [
    ...new Set([...(commandes.data ?? []).map((c) => c.user_id), ...(abos.data ?? []).map((a) => a.user_id)]),
  ];
  const idsPlans = [
    ...new Set([...(commandes.data ?? []).map((c) => c.plan_id), ...(abos.data ?? []).map((a) => a.plan_id)]),
  ];

  const [{ data: profils }, { data: formules }] = await Promise.all([
    ids.length
      ? supabase.from("profiles").select("id, first_name, last_name").in("id", ids)
          .returns<{ id: string; first_name: string; last_name: string }[]>()
      : Promise.resolve({ data: [] }),
    idsPlans.length
      ? supabase.from("plans").select("id, name").in("id", idsPlans)
          .returns<{ id: string; name: string }[]>()
      : Promise.resolve({ data: [] }),
  ]);

  const qui = new Map((profils ?? []).map((p) => [p.id, `${p.first_name} ${p.last_name}`]));
  const quoi = new Map((formules ?? []).map((f) => [f.id, f.name]));

  const encaisse = (commandes.data ?? [])
    .filter((c) => c.status === "paid" || c.status === "partially_refunded")
    .reduce((n, c) => n + c.amount_cents - c.refunded_amount_cents, 0);

  return (
    <>
      <div className="mb-[26px]">
        <h2>Paiements</h2>
        <p className="mt-1.5 max-w-[62ch] text-plume">
          Tout ce qui est passé par la caisse. En lecture seule : un
          remboursement ou un litige se traite chez Stripe, avec le lien de
          chaque ligne.
        </p>
      </div>

      {evenements.data?.length ? (
        <div className="mb-6">
          <Bandeau ton="erreur" titre={`${evenements.data.length} paiement${evenements.data.length > 1 ? "s" : ""} non traité${evenements.data.length > 1 ? "s" : ""}`}>
            Stripe a signalé ces événements mais le site n&apos;a pas su les
            traiter. L&apos;argent est encaissé, les séances peuvent manquer.
            Préviens Gaël avec ces identifiants :{" "}
            {evenements.data.map((e) => e.id).join(", ")}.
          </Bandeau>
        </div>
      ) : null}

      <div className="mb-[30px] grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-3.5">
        <div className="rounded-md border border-sable bg-white px-[18px] py-[17px]">
          <p className="chiffre text-[32px] leading-[1.1]">{prixLisible(encaisse)}</p>
          <p className="mt-1 text-sm text-plume">Encaissé depuis le début, net</p>
        </div>
        <div className="rounded-md border border-sable bg-white px-[18px] py-[17px]">
          <p className="chiffre text-[32px] leading-[1.1]">{commandes.data?.length ?? 0}</p>
          <p className="mt-1 text-sm text-plume">Commandes</p>
        </div>
        <div className="rounded-md border border-sable bg-white px-[18px] py-[17px]">
          <p className="chiffre text-[32px] leading-[1.1]">{abos.data?.length ?? 0}</p>
          <p className="mt-1 text-sm text-plume">Abonnements, tous statuts</p>
        </div>
      </div>

      <section className="mb-5 rounded-md border border-sable bg-white p-[22px]">
        <h3 className="mb-4">Les abonnements</h3>
        {!abos.data?.length ? (
          <p className="py-6 text-[15px] text-plume">Aucun abonnement.</p>
        ) : (
          abos.data.map((a) => (
            <div key={a.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-sable py-3.5 last:border-b-0">
              <div>
                <Link href={`/admin/clientes/${a.user_id}`} className="text-[15px] font-medium underline underline-offset-[3px]">
                  {qui.get(a.user_id) ?? "Cliente anonymisée"}
                </Link>
                <p className="text-[13px] text-plume">
                  {quoi.get(a.plan_id) ?? "—"}
                  {a.current_period_end && ` · ${a.cancel_at_period_end || a.status === "canceled" ? "fin le" : "prochain paiement le"} ${enDateAnnee(a.current_period_end)}`}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {a.dunning_exhausted_at ? (
                  <Pastille ton="complet">Paiement en échec</Pastille>
                ) : a.payment_failed_at ? (
                  <Pastille ton="bientot">Paiement en attente</Pastille>
                ) : a.status === "canceled" ? (
                  <Pastille ton="complet">Terminé</Pastille>
                ) : a.cancel_at_period_end ? (
                  <Pastille ton="bientot">Résilié</Pastille>
                ) : (
                  <Pastille ton="dispo">En cours</Pastille>
                )}
                <a
                  href={STRIPE(`/subscriptions/${a.stripe_subscription_id}`)}
                  target="_blank" rel="noopener noreferrer"
                  className="text-[13px] text-plume underline underline-offset-[3px] hover:text-framboise-deep"
                >
                  Stripe ↗
                </a>
              </div>
            </div>
          ))
        )}
      </section>

      <section className="rounded-md border border-sable bg-white p-[22px]">
        <h3 className="mb-4">Les commandes</h3>
        {!commandes.data?.length ? (
          <p className="py-6 text-[15px] text-plume">Aucune commande.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  {["Date", "Cliente", "Formule", "Montant", "Statut", ""].map((t) => (
                    <th key={t} className="border-b border-sable px-2 py-2.5 text-left text-[13px] font-semibold text-plume">
                      {t}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {commandes.data.map((c) => {
                  const s = STATUTS[c.status] ?? { libelle: c.status, ton: "complet" as const };
                  const lien = c.stripe_invoice_id
                    ? STRIPE(`/invoices/${c.stripe_invoice_id}`)
                    : c.stripe_payment_intent_id
                      ? STRIPE(`/payments/${c.stripe_payment_intent_id}`)
                      : null;
                  return (
                    <tr key={c.id}>
                      <td className="border-b border-sable px-2 py-3 text-[13px] whitespace-nowrap text-plume">
                        {enDateAnnee(c.paid_at ?? c.created_at)}
                      </td>
                      <td className="border-b border-sable px-2 py-3 text-[15px]">
                        <Link href={`/admin/clientes/${c.user_id}`} className="underline underline-offset-[3px]">
                          {qui.get(c.user_id) ?? "anonymisée"}
                        </Link>
                      </td>
                      <td className="border-b border-sable px-2 py-3 text-[15px] text-plume">
                        {quoi.get(c.plan_id) ?? "—"}
                        {c.kind === "subscription_cycle" && (
                          <span className="block text-[13px]">prélèvement</span>
                        )}
                      </td>
                      <td className="border-b border-sable px-2 py-3 text-[15px] font-medium whitespace-nowrap tabular-nums">
                        {prixLisible(c.amount_cents)}
                        {c.refunded_amount_cents > 0 && (
                          <span className="block text-[13px] font-normal text-plume">
                            −{prixLisible(c.refunded_amount_cents)}
                          </span>
                        )}
                      </td>
                      <td className="border-b border-sable px-2 py-3">
                        <Pastille ton={s.ton}>{s.libelle}</Pastille>
                      </td>
                      <td className="border-b border-sable px-2 py-3 text-right">
                        {lien && (
                          <a href={lien} target="_blank" rel="noopener noreferrer"
                            className="text-[13px] text-plume underline underline-offset-[3px] hover:text-framboise-deep">
                            Stripe ↗
                          </a>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-4 text-[13px] text-plume">
          Pour rembourser, ouvre la ligne chez Stripe. Le site est prévenu tout
          seul et retire les séances non utilisées.
        </p>
      </section>
    </>
  );
}
