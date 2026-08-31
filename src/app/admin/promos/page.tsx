import type { Metadata } from "next";
import { Bandeau } from "@/components/Bandeau";
import { Pastille } from "@/components/Pastille";
import { basculerPromo } from "@/lib/admin/actions";
import { clientServeur } from "@/lib/supabase/server";
import { enDateAnnee } from "@/lib/dates";
import { prixLisible } from "@/lib/formules/format";
import { FormulairePromo } from "./formulaire";

export const metadata: Metadata = { title: "Codes promo — Step by Step" };

type Promo = {
  id: string; code: string; description: string | null;
  discount_type: string; percent_off: number | null; amount_off_cents: number | null;
  duration: string; duration_in_months: number | null;
  max_redemptions: number | null; times_redeemed: number;
  is_active: boolean; expires_at: string | null; created_at: string;
  restricted_plan_ids: string[] | null;
};

export default async function PagePromos({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; ton?: string }>;
}) {
  const { message, ton } = await searchParams;
  const supabase = await clientServeur();

  const [{ data: promos }, { data: formules }] = await Promise.all([
    supabase.from("promo_codes")
      .select("id, code, description, discount_type, percent_off, amount_off_cents, duration, duration_in_months, max_redemptions, times_redeemed, is_active, expires_at, created_at, restricted_plan_ids")
      .order("is_active", { ascending: false })
      .order("created_at", { ascending: false })
      .returns<Promo[]>(),
    supabase.from("plans").select("id, name").eq("is_active", true)
      .not("stripe_product_id", "is", null).order("sort_order")
      .returns<{ id: string; name: string }[]>(),
  ]);

  const nomFormule = new Map((formules ?? []).map((f) => [f.id, f.name]));

  return (
    <>
      <div className="mb-[26px]">
        <h2>Codes promo</h2>
        <p className="mt-1.5 max-w-[62ch] text-plume">
          Le code est créé chez Stripe et enregistré ici en même temps. Tes
          clientes le saisissent au moment de payer. Tu n&apos;as jamais besoin
          d&apos;ouvrir Stripe.
        </p>
      </div>

      {message && (
        <div className="mb-6">
          <Bandeau ton={ton === "erreur" ? "erreur" : "succes"}>{message}</Bandeau>
        </div>
      )}

      <div className="grid items-start gap-5 lg:grid-cols-[1fr_400px]">
        <section className="rounded-md border border-sable bg-white p-[22px]">
          <h3 className="mb-4">Mes codes</h3>
          {!promos?.length ? (
            <p className="py-8 text-center text-[15px] text-plume">
              Aucun code pour l&apos;instant.
            </p>
          ) : (
            promos.map((p) => (
              <div key={p.id} className={`flex flex-wrap items-center justify-between gap-3 border-b border-sable py-3.5 last:border-b-0 ${p.is_active ? "" : "opacity-60"}`}>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="font-mono text-[15px] font-semibold tracking-wide">{p.code}</span>
                    {p.is_active ? (
                      <Pastille ton="dispo">Actif</Pastille>
                    ) : (
                      <Pastille ton="complet">Désactivé</Pastille>
                    )}
                    <span className="chiffre text-framboise">
                      {p.discount_type === "percent"
                        ? `−${p.percent_off} %`
                        : `−${prixLisible(p.amount_off_cents ?? 0)}`}
                    </span>
                  </div>
                  <p className="mt-1 text-[13px] text-plume">
                    {p.description && `${p.description} · `}
                    {p.times_redeemed} utilisation{p.times_redeemed > 1 ? "s" : ""}
                    {p.max_redemptions ? ` sur ${p.max_redemptions}` : ""}
                    {p.expires_at ? ` · expire le ${enDateAnnee(p.expires_at)}` : ""}
                    {p.duration === "repeating" && ` · ${p.duration_in_months} mois d'abonnement`}
                    {p.duration === "forever" && " · à chaque prélèvement"}
                    {p.restricted_plan_ids?.length
                      ? ` · ${p.restricted_plan_ids.map((i) => nomFormule.get(i) ?? "?").join(", ")}`
                      : ""}
                  </p>
                </div>
                <form action={basculerPromo}>
                  <input type="hidden" name="id" value={p.id} />
                  <button
                    type="submit"
                    className="cursor-pointer rounded-sm border border-sable-deep bg-white px-3.5 py-2 text-sm font-semibold text-encre hover:bg-sable"
                  >
                    {p.is_active ? "Désactiver" : "Réactiver"}
                  </button>
                </form>
              </div>
            ))
          )}
          <p className="mt-4 text-[13px] text-plume">
            Un code ne se supprime pas, il se désactive — des deux côtés, ici et
            chez Stripe. Les achats déjà payés avec ne bougent pas.
          </p>
        </section>

        <section className="rounded-md border border-sable bg-white p-[22px]">
          <h3 className="mb-5">Créer un code</h3>
          <FormulairePromo formules={formules ?? []} />
        </section>
      </div>
    </>
  );
}
