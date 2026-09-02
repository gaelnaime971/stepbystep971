import Link from "next/link";
import { Pastille } from "@/components/Pastille";
import { enHeure, enJourLong } from "@/lib/dates";
import { libelleNiveau } from "@/lib/niveaux";
import { dateLocale } from "@/lib/planning/dates";
import type { CoursAdmin } from "@/lib/planning/types";

/**
 * Le planning du mois, en liste, pour telephone.
 *
 * La grille de sept colonnes est masquee sous 768 px — elle y est illisible.
 * Mais s'en tenir a « aujourd'hui » et « cette semaine » enfermait Oriane :
 * un cours de la semaine suivante devenait inatteignable, donc ni modifiable
 * ni annulable depuis son telephone. Cette liste couvre le mois entier et
 * partage la navigation `?mois=` de la grille : une seule adresse, deux rendus.
 *
 * Chaque ligne est un lien pleine largeur d'au moins 60 px de haut : elle se
 * touche debout, d'une main, sans viser.
 */
export function ListeMoisMobile({
  cours,
  nomLieu,
  aujourdHui,
  libelleVide,
}: {
  cours: CoursAdmin[];
  nomLieu: Map<string, string>;
  aujourdHui: string;
  libelleVide: string;
}) {
  if (cours.length === 0) {
    return (
      <p className="px-1 py-8 text-center text-[15px] text-plume-deep">{libelleVide}</p>
    );
  }

  const parJour = new Map<string, CoursAdmin[]>();
  for (const c of cours) {
    const cle = dateLocale(c.starts_at);
    parJour.set(cle, [...(parJour.get(cle) ?? []), c]);
  }

  return (
    <div className="flex flex-col gap-5">
      {[...parJour.entries()].map(([jour, duJour]) => {
        const passe = jour < aujourdHui;
        return (
          <div key={jour}>
            <p
              className={`mb-1.5 flex items-baseline gap-2 font-display text-[17px] font-semibold italic first-letter:uppercase ${
                passe ? "text-plume-deep" : ""
              }`}
            >
              {enJourLong(`${jour}T12:00:00-04:00`)}
              {jour === aujourdHui && (
                <span className="font-texte text-[13px] font-semibold text-framboise not-italic">
                  aujourd&apos;hui
                </span>
              )}
            </p>

            <div className="overflow-hidden rounded-md border border-sable bg-white">
              {duJour.map((c) => {
                const complet = c.seats_taken >= c.capacity;
                const taux = Math.min(100, Math.round((c.seats_taken / c.capacity) * 100));
                return (
                  <Link
                    key={c.id}
                    href={`/admin/planning/${c.id}`}
                    className={`flex min-h-[60px] items-center gap-3 border-b border-sable px-3.5 py-3 last:border-b-0 active:bg-sable ${
                      passe ? "opacity-60" : ""
                    }`}
                  >
                    <span className="min-w-[54px] font-display text-[17px] font-semibold italic">
                      {enHeure(c.starts_at)}
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-medium">
                        {nomLieu.get(c.location_id) ?? "Lieu supprimé"}
                      </span>
                      <span className="mt-1 flex flex-wrap items-center gap-2">
                        {c.status === "canceled" ? (
                          <Pastille ton="complet">Annulé</Pastille>
                        ) : (
                          <>
                            <Pastille ton="neutre">{libelleNiveau(c.level)}</Pastille>
                            <span className="inline-flex items-center gap-1.5">
                              <span className="block h-1.5 w-12 overflow-hidden rounded-full bg-sable">
                                <span
                                  className={`block h-full ${complet ? "bg-plume-deep" : "bg-framboise"}`}
                                  style={{ width: `${taux}%` }}
                                />
                              </span>
                              <span className="text-[13px] text-plume-deep tabular-nums">
                                {c.seats_taken}/{c.capacity}
                              </span>
                            </span>
                          </>
                        )}
                      </span>
                    </span>

                    <span aria-hidden="true" className="text-lg text-plume-deep">›</span>
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
