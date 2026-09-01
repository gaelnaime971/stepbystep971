import type { Metadata } from "next";
import Link from "next/link";
import { Bandeau } from "@/components/Bandeau";
import { Pastille } from "@/components/Pastille";
import { modifierDelais, modifierMesInfos } from "@/lib/admin/actions";
import { profilCourant } from "@/lib/auth/session";
import { clientServeur } from "@/lib/supabase/server";
import { stripeEnModeTest } from "@/lib/stripe/client";
import { Champ, ChampNombre } from "@/components/Champ";

export const metadata: Metadata = { title: "Paramètres — Step by Step" };

export default async function PageParametres({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; ton?: string }>;
}) {
  const { message, ton } = await searchParams;
  const profil = await profilCourant();
  if (!profil) return null;

  const supabase = await clientServeur();
  const { data: formules } = await supabase
    .from("plans")
    .select("id, name, cancellation_deadline_hours, stripe_price_id, is_active")
    .eq("is_active", true).order("sort_order")
    .returns<{ id: string; name: string; cancellation_deadline_hours: number; stripe_price_id: string | null; is_active: boolean }[]>();

  const { count: lieuxOuverts } = await supabase
    .from("locations").select("*", { count: "exact", head: true }).eq("is_active", true);

  return (
    <>
      <div className="mb-[26px]">
        <h2>Paramètres</h2>
        <p className="mt-1.5 text-plume-deep">Tes informations et les règles du site.</p>
      </div>

      {message && (
        <div className="mb-6">
          <Bandeau ton={ton === "erreur" ? "erreur" : "succes"}>{message}</Bandeau>
        </div>
      )}

      <div className="grid items-start gap-5 lg:grid-cols-[1fr_360px]">
        <div className="flex flex-col gap-5">
          <section className="rounded-md border border-sable bg-white p-[22px]">
            <h3 className="mb-1">Mes informations</h3>
            <p className="mb-5 text-[13px] text-plume-deep">
              Ton nom apparaît en haut de l&apos;administration. Pour changer
              d&apos;email, écris à Gaël.
            </p>
            <form action={modifierMesInfos} className="flex max-w-[440px] flex-col gap-4">
              <div className="grid grid-cols-2 gap-3">
                <Champ nom="prenom" libelle="Prénom" valeurParDefaut={profil.first_name} />
                <Champ nom="nom" libelle="Nom" valeurParDefaut={profil.last_name} />
              </div>
              <Champ nom="telephone" libelle="Téléphone" type="tel" requis={false}
                valeurParDefaut={profil.phone ?? ""} />
              <div>
                <span className="mb-1.5 block text-sm font-semibold">Email</span>
                <div className="rounded-sm border border-sable-deep bg-sable px-[13px] py-[11px] text-[15px] text-plume-deep">
                  {profil.email}
                </div>
              </div>
              <button type="submit"
                className="self-start cursor-pointer rounded-sm bg-framboise px-[22px] py-[13px] text-[15px] font-semibold text-white hover:bg-framboise-deep">
                J&apos;enregistre
              </button>
            </form>
          </section>

          <section className="rounded-md border border-sable bg-white p-[22px]">
            <h3 className="mb-1">Délais d&apos;annulation</h3>
            <p className="mb-5 max-w-[62ch] text-[13px] text-plume-deep">
              Combien d&apos;heures avant le cours une cliente peut encore
              annuler et récupérer sa séance. Le délai dépend de la formule qui
              a financé la séance, pas du cours. Passé ce délai, la séance est
              décomptée.
            </p>
            {(formules ?? []).length === 0 ? (
              <p className="text-[15px] text-plume-deep">
                Aucune formule active.{" "}
                <Link href="/admin/formules" className="text-framboise-deep underline underline-offset-[3px]">
                  Crées-en une
                </Link>{" "}
                pour régler son délai d&apos;annulation.
              </p>
            ) : (
            <form action={modifierDelais} className="flex flex-col gap-4">
              <div className="grid gap-3 sm:grid-cols-2">
                {(formules ?? []).map((f) => (
                  <ChampNombre key={f.id} nom={`delai_${f.id}`} libelle={f.name} min={0}
                    valeurParDefaut={f.cancellation_deadline_hours} aide="en heures" />
                ))}
              </div>
              <button type="submit"
                className="self-start cursor-pointer rounded-sm bg-framboise px-[22px] py-[13px] text-[15px] font-semibold text-white hover:bg-framboise-deep">
                J&apos;enregistre les délais
              </button>
            </form>
            )}
          </section>
        </div>

        <aside className="flex flex-col gap-5">
          <section className="rounded-md border border-sable bg-white p-[22px]">
            <h3 className="mb-4">État du site</h3>
            <dl className="flex flex-col gap-3 text-[15px]">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-plume-deep">Paiements</dt>
                <dd>
                  {stripeEnModeTest() ? (
                    <Pastille ton="bientot">Mode test</Pastille>
                  ) : (
                    <Pastille ton="dispo">En production</Pastille>
                  )}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-plume-deep">Formules en vente</dt>
                <dd className="font-medium">
                  {(formules ?? []).filter((f) => f.stripe_price_id).length} sur {formules?.length ?? 0}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-plume-deep">Lieux ouverts</dt>
                <dd className="font-medium">{lieuxOuverts ?? 0}</dd>
              </div>
            </dl>
            {stripeEnModeTest() && (
              <p className="mt-4 text-[13px] text-ambre">
                Les paiements ne sont pas réels. Tant que ce bandeau est là, le
                site n&apos;encaisse rien.
              </p>
            )}
          </section>

          <section className="rounded-md border border-sable bg-white p-[22px]">
            <h3 className="mb-4">Ce qui se règle ailleurs</h3>
            <ul className="flex flex-col gap-2.5 text-[15px]">
              {[
                ["Prix et contenu des formules", "/admin/formules"],
                ["Lieux des cours", "/admin/lieux"],
                ["Codes promo", "/admin/promos"],
              ].map(([libelle, href]) => (
                <li key={href}>
                  <Link href={href} className="text-framboise-deep underline underline-offset-[3px]">
                    {libelle}
                  </Link>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-[13px] text-plume-deep">
              L&apos;alerte de fin de validité part 3 jours avant l&apos;échéance.
              Pour changer ce délai, écris à Gaël : c&apos;est un réglage du
              serveur.
            </p>
          </section>
        </aside>
      </div>
    </>
  );
}
