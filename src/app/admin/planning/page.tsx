import type { Metadata } from "next";
import Link from "next/link";
import { Bandeau } from "@/components/Bandeau";
import { Pastille } from "@/components/Pastille";
import { enHeure, enJourCourt } from "@/lib/dates";
import { coursEntre, tousLesLieux } from "@/lib/planning/lecture";
import {
  aujourdHui, dateLocale, grilleMois, JOURS_COURTS, moisDe, moisLisible, moisSuivant, semaineDe,
} from "@/lib/planning/dates";
import type { CoursAdmin } from "@/lib/planning/types";

export const metadata: Metadata = { title: "Planning des cours — Step by Step" };

function tauxRemplissage(c: CoursAdmin): number {
  return Math.round((c.seats_taken / c.capacity) * 100);
}

export default async function PagePlanning({
  searchParams,
}: {
  searchParams: Promise<{ mois?: string; message?: string; ton?: string }>;
}) {
  const { mois: moisParam, message, ton } = await searchParams;
  const jour = aujourdHui();
  const mois = /^\d{4}-\d{2}$/.test(moisParam ?? "") ? moisParam! : moisDe(jour);

  const cases = grilleMois(mois);
  const semaine = semaineDe(jour);

  const [duMois, deLaSemaine, lieux] = await Promise.all([
    coursEntre(cases[0].date, cases.at(-1)!.date),
    coursEntre(semaine[0], semaine.at(-1)!),
    tousLesLieux(),
  ]);

  const nomLieu = new Map(lieux.map((l) => [l.id, l.name]));

  const parJour = new Map<string, CoursAdmin[]>();
  for (const c of duMois) {
    const cle = dateLocale(c.starts_at);
    parJour.set(cle, [...(parJour.get(cle) ?? []), c]);
  }

  const duJour = deLaSemaine.filter((c) => dateLocale(c.starts_at) === jour);

  return (
    <>
      <div className="mb-[26px] flex flex-wrap items-start justify-between gap-5">
        <div>
          <h2>Planning des cours</h2>
          <p className="mt-1.5 text-plume">
            {duJour.length === 0
              ? "Aucun cours aujourd'hui."
              : duJour.length === 1
                ? "Un cours aujourd'hui."
                : `${duJour.length} cours aujourd'hui.`}
          </p>
        </div>
        <Link
          href="/admin/planning/nouveau"
          className="inline-flex items-center justify-center rounded-sm bg-framboise px-[22px] py-[13px] text-[15px] font-semibold text-white transition-colors hover:bg-framboise-deep"
        >
          Créer un cours
        </Link>
      </div>

      {message && (
        <div className="mb-6">
          <Bandeau ton={ton === "erreur" ? "erreur" : "succes"}>{message}</Bandeau>
        </div>
      )}

      {/* Les cours du jour — en tête sur téléphone, c'est ce qu'Oriane
          regarde avant d'arriver en salle. */}
      <section className="mb-6 rounded-md border border-sable bg-white p-[22px]">
        <div className="mb-4 flex items-center justify-between gap-3.5">
          <h3>Aujourd&apos;hui</h3>
          <span className="text-[13px] text-plume">{enJourCourt(`${jour}T12:00:00-04:00`)}</span>
        </div>
        {duJour.length === 0 ? (
          <p className="py-4 text-[15px] text-plume">Rien au planning aujourd&apos;hui.</p>
        ) : (
          duJour.map((c) => (
            <Link
              key={c.id}
              href={`/admin/planning/${c.id}`}
              className="flex items-center gap-4 border-b border-sable py-3.5 last:border-b-0"
            >
              <span className="min-w-[62px] font-display text-[17px] font-semibold italic">
                {enHeure(c.starts_at)}
              </span>
              <span className="flex-1 text-[15px] font-medium">
                {nomLieu.get(c.location_id) ?? "Lieu supprimé"}
              </span>
              {c.status === "canceled" ? (
                <Pastille ton="complet">Annulé</Pastille>
              ) : (
                <span className="chiffre text-lg">
                  {c.seats_taken}/{c.capacity}
                </span>
              )}
            </Link>
          ))
        )}
      </section>

      <div className="grid items-start gap-5 lg:grid-cols-[1.5fr_1fr]">
        {/* Le calendrier — inutilisable sur un écran de téléphone,
            donc masqué en dessous de md. */}
        <section className="hidden rounded-md border border-sable bg-white p-[22px] md:block">
          <div className="mb-4 flex items-center justify-between gap-3.5">
            <h3 className="first-letter:uppercase">{moisLisible(mois)}</h3>
            <div className="flex items-center gap-2.5">
              <Link
                href={`/admin/planning?mois=${moisSuivant(mois, -1)}`}
                aria-label="Mois précédent"
                className="flex h-8 w-8 items-center justify-center rounded-sm border border-sable-deep bg-white text-base hover:bg-sable"
              >
                ‹
              </Link>
              <Link
                href={`/admin/planning?mois=${moisSuivant(mois, 1)}`}
                aria-label="Mois suivant"
                className="flex h-8 w-8 items-center justify-center rounded-sm border border-sable-deep bg-white text-base hover:bg-sable"
              >
                ›
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1">
            {JOURS_COURTS.map((j) => (
              <span key={j} className="pb-1.5 text-center text-[13px] text-plume">
                {j}
              </span>
            ))}

            {cases.map(({ date, horsMois }) => {
              const duCase = parJour.get(date) ?? [];
              return (
                <div
                  key={date}
                  className={`min-h-[76px] rounded-sm p-1.5 ${
                    horsMois
                      ? "border border-transparent bg-ivoire"
                      : "border border-sable bg-white"
                  } ${date === jour ? "outline-2 outline-framboise" : ""}`}
                >
                  <span className="text-[13px] text-plume">{Number(date.slice(8))}</span>
                  {duCase.map((c) => {
                    const complet = c.seats_taken >= c.capacity;
                    return (
                      <Link
                        key={c.id}
                        href={`/admin/planning/${c.id}`}
                        className={`mt-1 block rounded-[4px] px-1.5 py-[3px] text-xs leading-[1.3] font-semibold ${
                          c.status === "canceled"
                            ? "bg-sable text-plume line-through"
                            : complet
                              ? "bg-sable text-plume"
                              : "bg-framboise-wash text-framboise-deep"
                        }`}
                      >
                        {nomLieu.get(c.location_id)?.replace("Les ", "") ?? "?"}{" "}
                        {enHeure(c.starts_at)}
                        {complet && c.status === "scheduled" && " · complet"}
                      </Link>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </section>

        {/* Cette semaine, avec taux de remplissage */}
        <section className="rounded-md border border-sable bg-white p-[22px]">
          <div className="mb-4 flex items-center justify-between gap-3.5">
            <h3>Cette semaine</h3>
          </div>

          {deLaSemaine.length === 0 ? (
            <p className="py-4 text-[15px] text-plume">Aucun cours cette semaine.</p>
          ) : (
            deLaSemaine.map((c) => (
              <Link
                key={c.id}
                href={`/admin/planning/${c.id}`}
                className="flex items-center gap-3.5 border-b border-sable py-3.5 last:border-b-0"
              >
                <span className="min-w-[104px] text-[15px] font-medium first-letter:uppercase">
                  {enJourCourt(c.starts_at)}, {enHeure(c.starts_at)}
                </span>
                <span className="flex-1 text-[15px] text-plume">
                  {nomLieu.get(c.location_id) ?? "Lieu supprimé"}
                </span>
                {c.status === "canceled" ? (
                  <Pastille ton="complet">Annulé</Pastille>
                ) : (
                  <>
                    <span className="h-1.5 w-[92px] overflow-hidden rounded-full bg-sable">
                      <span
                        className="block h-full bg-framboise"
                        style={{ width: `${Math.min(100, tauxRemplissage(c))}%` }}
                      />
                    </span>
                    <span className="min-w-[42px] text-right text-[13px] text-plume">
                      {c.seats_taken}/{c.capacity}
                    </span>
                  </>
                )}
              </Link>
            ))
          )}
          <p className="mt-3.5 text-[13px] text-plume">
            Clique sur un cours pour voir la liste des inscrites.
          </p>
        </section>
      </div>
    </>
  );
}
