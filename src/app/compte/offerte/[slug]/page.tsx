import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Bandeau } from "@/components/Bandeau";
import { PedagogieFormule } from "@/components/PedagogieFormule";
import { profilCourant } from "@/lib/auth/session";
import { prendreFormuleOfferte } from "@/lib/paiement/offerte";
import { clientServeur } from "@/lib/supabase/server";
import { validiteLisible } from "@/lib/formules/format";
import { COLONNES_FORMULE, estAchetable, estGratuite, type Formule } from "@/lib/formules/types";

export const metadata: Metadata = { title: "C'est offert — Step by Step" };

export default async function PageOfferte({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const profil = await profilCourant();
  if (!profil) return null; // Le layout a deja redirige.

  const supabase = await clientServeur();
  const { data: formule } = await supabase
    .from("plans").select(COLONNES_FORMULE).eq("slug", slug).maybeSingle<Formule>();

  if (!formule || !estAchetable(formule)) notFound();
  // Une formule payante n'a rien a faire ici : on renvoie au chemin de paiement.
  if (!estGratuite(formule)) redirect("/compte/formule");

  // Deja prise ? L'index d'unicite de 0014 est le juge, mais le dire AVANT
  // vaut mieux que de laisser le bouton mener a un refus.
  const { count } = await supabase
    .from("orders").select("id", { count: "exact", head: true })
    .eq("user_id", profil.id).eq("plan_id", formule.id).eq("kind", "free");
  const dejaPrise = (count ?? 0) > 0;

  const s = formule.sessions_count > 1 ? "s" : "";

  return (
    <div className="mx-auto max-w-[620px]">
      <h2 className="mb-2">{formule.name}</h2>
      <p className="mb-6 text-[17px] text-plume-deep">
        {formule.tagline ?? `${formule.sessions_count} séance${s}, offerte${s} par Oriane.`}
      </p>

      {dejaPrise ? (
        <>
          <Bandeau ton="attention" titre="Tu l'as déjà prise">
            Cette formule est à une par personne. Tes séances sont déjà sur ton
            compte — il te reste à les placer dans le planning.
          </Bandeau>
          <p className="mt-5">
            <Link
              href="/compte"
              className="inline-flex items-center justify-center rounded-sm bg-framboise px-[22px] py-[15px] text-[15px] font-semibold text-white transition-colors hover:bg-framboise-deep sm:py-[13px]"
            >
              Voir le planning
            </Link>
          </p>
        </>
      ) : (
        <section className="rounded-md border border-sable bg-white p-5 sm:p-[26px]">
          <div className="mb-5 flex items-baseline gap-3">
            <span className="chiffre text-[34px] text-framboise">Offert</span>
            <span className="text-[15px] text-plume-deep">
              {formule.sessions_count} séance{s} · valable{s}{" "}
              {validiteLisible(formule.validity_interval)}
            </span>
          </div>

          {/* Les memes regles qu'a l'achat. Une seance offerte expire comme
              une seance payee, et c'est la chose a ne pas decouvrir apres. */}
          <PedagogieFormule
            forme="bloc"
            kind={formule.kind}
            seances={formule.sessions_count}
            validite={formule.validity_interval}
            delaiHeures={formule.cancellation_deadline_hours}
          />

          <form action={prendreFormuleOfferte} className="mt-6">
            <input type="hidden" name="slug" value={formule.slug} />
            <button
              type="submit"
              className="w-full cursor-pointer rounded-sm bg-framboise px-[22px] py-[15px] text-[15px] font-semibold text-white transition-colors hover:bg-framboise-deep sm:w-auto sm:py-[13px]"
            >
              Je prends mes séances offertes
            </button>
          </form>

          <p className="mt-3 text-[13px] text-plume-deep">
            Aucun paiement, aucune carte à renseigner. Une seule fois par personne.
          </p>
        </section>
      )}
    </div>
  );
}
