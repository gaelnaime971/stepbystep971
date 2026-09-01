import type { Metadata } from "next";
import Link from "next/link";
import { Bandeau } from "@/components/Bandeau";
import { Pastille } from "@/components/Pastille";
import { annuler, reserver } from "@/lib/compte/actions";
import { alertesExpiration, totalNonPlacables } from "@/lib/compte/alertes";
import {
  coursAVenir, formulesLisibles, lieux, lotsActifs, mesReservations, soldeTotal,
} from "@/lib/compte/lecture";
import type { Cours } from "@/lib/compte/types";
import { enCreneau, enDate, enHeure, enJourLong, joursLisibles, joursRestants } from "@/lib/dates";

export const metadata: Metadata = { title: "Mes séances — Step by Step" };

function placesLisibles(c: Cours): { texte: string; complet: boolean } {
  const restantes = c.capacity - c.seats_taken;
  if (restantes <= 0) return { texte: "Complet", complet: true };
  return {
    texte: `${restantes} place${restantes > 1 ? "s" : ""} sur ${c.capacity}`,
    complet: false,
  };
}

export default async function PageMesSeances({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; ton?: string }>;
}) {
  const { message, ton } = await searchParams;

  const [lots, cours, reservations, nomsLieux] = await Promise.all([
    lotsActifs(),
    coursAVenir(),
    mesReservations(),
    lieux(),
  ]);

  const solde = soldeTotal(lots);
  const prochaineEcheance = lots[0]?.expires_at ?? null;
  const formules = await formulesLisibles(lots.map((l) => l.plan_id ?? ""));
  const formuleDuProchainLot = lots[0]?.plan_id
    ? formules.get(lots[0].plan_id)
    : undefined;

  const alertes = alertesExpiration(lots, cours, reservations);
  const perdues = totalNonPlacables(alertes);

  const parCours = new Map(reservations.map((r) => [r.course_id, r]));
  const aVenir = cours.filter((c) => c.status === "scheduled");

  // Regroupement par jour, comme dans la maquette.
  const parJour = new Map<string, Cours[]>();
  for (const c of aVenir) {
    const cle = enJourLong(c.starts_at);
    parJour.set(cle, [...(parJour.get(cle) ?? []), c]);
  }

  const mesResaTriees = reservations
    .map((r) => ({ resa: r, cours: cours.find((c) => c.id === r.course_id) }))
    .filter((x): x is { resa: (typeof reservations)[number]; cours: Cours } => !!x.cours)
    .sort((a, b) => a.cours.starts_at.localeCompare(b.cours.starts_at));

  return (
    <>
      {message && (
        <div className="mb-5">
          <Bandeau ton={ton === "erreur" ? "erreur" : "succes"}>{message}</Bandeau>
        </div>
      )}

      {/* Le solde ------------------------------------------------------- */}
      <section className="grid items-center gap-5 rounded-lg bg-encre p-6 text-white sm:gap-7 sm:p-7 lg:grid-cols-[auto_1fr_auto]">
        <span className="chiffre text-[54px] leading-none text-framboise sm:text-[66px]">{solde}</span>
        <div>
          <p className="font-display text-[22px] font-bold italic">
            {solde === 0
              ? "aucune séance à placer"
              : solde === 1
                ? "séance à placer"
                : "séances à placer"}
          </p>
          <p className="text-[15px] text-[#C4BEC1]">
            {prochaineEcheance
              ? `${formuleDuProchainLot?.name ?? "Ton solde"} — à utiliser avant le ${enDate(prochaineEcheance)}`
              : "Prends une formule pour commencer à réserver."}
          </p>
        </div>
        <Link
          href="/compte/formule"
          className="inline-flex items-center justify-center rounded-sm bg-framboise px-[22px] py-[13px] text-[15px] font-semibold whitespace-nowrap text-white transition-colors hover:bg-framboise-deep"
        >
          {solde === 0 ? "Prendre une formule" : "Ma formule"}
        </Link>
      </section>

      {/* Les alertes d'expiration --------------------------------------- */}
      {alertes.length > 0 && (
        <div className="mt-3.5 flex flex-col gap-3">
          {perdues > 0 && (
            <Bandeau
              ton="attention"
              titre={
                perdues === 1
                  ? "Une séance risque d'être perdue"
                  : `${perdues} séances risquent d'être perdues`
              }
            >
              <p>
                Sur le planning déjà publié, aucun cours ne tombe avant leur
                date de fin de validité — ou ceux qui tombent avant sont
                complets, ou tu y es déjà inscrite. Tu ne peux donc pas les
                poser aujourd&apos;hui.
              </p>
              <p className="mt-2">
                Oriane ajoute des cours régulièrement : reviens voir. Et si rien
                ne s&apos;ouvre à temps, écris-lui.
              </p>
            </Bandeau>
          )}

          {alertes
            .filter((a) => a.nonPlacables === 0 && a.joursAvantEcheance <= 7)
            .map((a) => (
              <Bandeau key={a.lot.id} ton="attention">
                Il te reste {a.lot.quantity_remaining} séance
                {a.lot.quantity_remaining > 1 ? "s" : ""} à poser avant le{" "}
                {enDate(a.lot.expires_at)}, soit{" "}
                {joursLisibles(a.joursAvantEcheance)}. Les séances non utilisées
                ne sont pas reportées.
              </Bandeau>
            ))}
        </div>
      )}

      <div className="mt-7 grid items-start gap-5 sm:mt-8 sm:gap-[22px] lg:grid-cols-[1.65fr_1fr]">
        {/* Les cours à venir ------------------------------------------- */}
        <section className="rounded-md border border-sable bg-white p-5 sm:p-[22px]">
          <div className="mb-4 flex items-baseline justify-between gap-3.5">
            <h3>Les cours à venir</h3>
            <span className="text-[13px] text-plume">
              {aVenir.length} cours au planning
            </span>
          </div>

          {aVenir.length === 0 ? (
            <p className="px-4 py-8 text-center text-[15px] text-plume">
              Aucun cours au planning pour l&apos;instant. Oriane les ajoute
              chaque semaine.
            </p>
          ) : (
            [...parJour.entries()].map(([jour, duJour]) => (
              <div key={jour} className="mb-[22px] last:mb-0">
                <p className="mb-2.5 font-display text-[17px] font-semibold italic first-letter:uppercase">
                  {jour}
                </p>

                {duJour.map((c) => {
                  const resa = parCours.get(c.id);
                  const places = placesLisibles(c);
                  const lieu = nomsLieux.get(c.location_id) ?? "Lieu à préciser";

                  if (resa) {
                    return (
                      <div
                        key={c.id}
                        className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-sm bg-menthe-wash px-3 py-3.5"
                      >
                        <span className="min-w-[62px] font-display text-[17px] font-semibold italic">
                          {enHeure(c.starts_at)}
                        </span>
                        <div className="flex-1">
                          <p className="text-[15px] font-medium">{lieu}</p>
                          <p className="text-sm font-semibold text-menthe">
                            Tu es inscrite
                          </p>
                        </div>
                        <FormulaireAnnuler reservationId={resa.id} />
                      </div>
                    );
                  }

                  return (
                    <div
                      key={c.id}
                      className="flex flex-wrap items-center gap-x-4 gap-y-2.5 border-b border-sable py-3.5 last:border-b-0"
                    >
                      <span className="min-w-[62px] font-display text-[17px] font-semibold italic">
                        {enHeure(c.starts_at)}
                      </span>
                      <div className="flex-1">
                        <p className="text-[15px] font-medium">{lieu}</p>
                        <p className="text-sm text-plume">
                          {places.texte} · {enCreneau(c.starts_at, c.ends_at)}
                        </p>
                      </div>
                      {places.complet ? (
                        <Pastille ton="complet">Complet</Pastille>
                      ) : (
                        <form action={reserver}>
                          <input type="hidden" name="coursId" value={c.id} />
                          <button
                            type="submit"
                            className="cursor-pointer rounded-sm bg-framboise px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-framboise-deep"
                          >
                            Je réserve
                          </button>
                        </form>
                      )}
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </section>

        {/* Mes réservations -------------------------------------------- */}
        <section className="rounded-md border border-sable bg-white p-5 sm:p-[22px]">
          <div className="mb-4 flex items-baseline justify-between gap-3.5">
            <h3>Mes réservations</h3>
          </div>

          {mesResaTriees.length === 0 ? (
            <p className="px-4 py-8 text-center text-[15px] text-plume">
              Tu n&apos;as encore rien réservé.
            </p>
          ) : (
            <>
              {mesResaTriees.map(({ resa, cours: c }) => (
                <div
                  key={resa.id}
                  className="flex items-center justify-between gap-3 border-b border-sable py-3 last:border-b-0"
                >
                  <div>
                    <p className="text-[15px] font-medium first-letter:uppercase">
                      {enJourLong(c.starts_at)}, {enHeure(c.starts_at)}
                    </p>
                    <p className="text-sm text-plume">
                      {nomsLieux.get(c.location_id) ?? "Lieu à préciser"}
                    </p>
                  </div>
                  <FormulaireAnnuler reservationId={resa.id} />
                </div>
              ))}
              <p className="mt-3.5 text-[13px] text-plume">
                Le délai d&apos;annulation dépend de la formule qui a financé la
                séance. Il est rappelé sur{" "}
                <Link href="/compte/formule" className="underline underline-offset-[3px]">
                  ta formule
                </Link>
                . Passé ce délai, la séance est décomptée.
              </p>
            </>
          )}
        </section>
      </div>

      {lots.length > 1 && (
        <section className="mt-[22px] rounded-md border border-sable bg-white p-[22px]">
          <h3 className="mb-4">Le détail de ton solde</h3>
          <p className="mb-4 text-[15px] text-plume">
            Tes séances sont consommées en commençant par celles qui expirent le
            plus tôt.
          </p>
          {lots.map((l) => (
            <div
              key={l.id}
              className="flex items-center justify-between gap-3 border-b border-sable py-3 last:border-b-0"
            >
              <div>
                <p className="text-[15px] font-medium">
                  {formules.get(l.plan_id ?? "")?.name ?? "Séances ajoutées par Oriane"}
                </p>
                <p className="text-sm text-plume">
                  À utiliser avant le {enDate(l.expires_at)}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="chiffre text-lg">{l.quantity_remaining}</span>
                {joursRestants(l.expires_at) <= 7 && (
                  <Pastille ton="bientot">
                    {joursLisibles(joursRestants(l.expires_at))}
                  </Pastille>
                )}
              </div>
            </div>
          ))}
        </section>
      )}
    </>
  );
}

function FormulaireAnnuler({ reservationId }: { reservationId: string }) {
  return (
    <form action={annuler}>
      <input type="hidden" name="reservationId" value={reservationId} />
      <button
        type="submit"
        className="cursor-pointer border-none bg-transparent p-0 text-sm text-plume underline underline-offset-[3px] transition-colors hover:text-framboise-deep"
      >
        Annuler
      </button>
    </form>
  );
}
