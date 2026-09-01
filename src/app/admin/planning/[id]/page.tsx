import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Bandeau } from "@/components/Bandeau";
import { ConfirmerAction } from "@/components/ConfirmerAction";
import { Pastille } from "@/components/Pastille";
import { enCreneau, enDateAnnee, enJourLong } from "@/lib/dates";
import { annulerCours, desinscrire } from "@/lib/planning/actions";
import { coursParId, inscritesDuCours, tousLesLieux } from "@/lib/planning/lecture";
import { dateLocale } from "@/lib/planning/dates";
import { FormulaireModification } from "./formulaire";

export const metadata: Metadata = { title: "Cours — Step by Step" };

function heureLocale(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/Guadeloupe",
  }).format(new Date(iso));
}

/** Le motif, partage par les deux chemins d'annulation. */
function ChampMotif() {
  return (
    <div>
      <label htmlFor="motif" className="mb-1.5 block text-sm font-semibold">
        Motif <span className="ml-1.5 font-normal text-plume-deep">facultatif</span>
      </label>
      <input
        id="motif"
        name="motif"
        type="text"
        placeholder="Salle indisponible"
        className="w-full rounded-sm border border-sable-deep bg-white px-[13px] py-3 text-[16px]"
      />
      <p className="mt-1.5 text-[13px] text-plume-deep">
        Il apparaît dans le mail que reçoivent les inscrites.
      </p>
    </div>
  );
}

export default async function PageCours({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ message?: string; ton?: string }>;
}) {
  const { id } = await params;
  const { message, ton } = await searchParams;

  const cours = await coursParId(id);
  if (!cours) notFound();

  const [inscrites, lieux] = await Promise.all([inscritesDuCours(id), tousLesLieux()]);
  const lieu = lieux.find((l) => l.id === cours.location_id);
  const annule = cours.status === "canceled";
  const passe = cours.starts_at <= new Date().toISOString();

  return (
    <>
      <p className="mb-4 text-[15px]">
        <Link href="/admin/planning" className="text-framboise-deep underline underline-offset-[3px]">
          Retour au planning
        </Link>
      </p>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h2 className="first-letter:uppercase">{enJourLong(cours.starts_at)}</h2>
        {annule && <Pastille ton="complet">Annulé</Pastille>}
        {!annule && cours.seats_taken >= cours.capacity && (
          <Pastille ton="complet">Complet</Pastille>
        )}
      </div>

      {message && (
        <div className="mb-6">
          <Bandeau ton={ton === "erreur" ? "erreur" : "succes"}>{message}</Bandeau>
        </div>
      )}

      {annule && (
        <div className="mb-6">
          <Bandeau ton="attention" titre="Ce cours est annulé">
            Les inscrites ont été recréditées automatiquement.
            {cours.cancellation_reason && ` Motif : ${cours.cancellation_reason}.`}
          </Bandeau>
        </div>
      )}

      <div className="grid items-start gap-5 lg:grid-cols-[1fr_340px]">
        <div className="flex flex-col gap-5">
          {/* Les inscrites ------------------------------------------- */}
          <section className="rounded-md border border-sable bg-white p-[22px]">
            <div className="mb-4 flex items-center justify-between gap-3.5">
              <h3>Les inscrites</h3>
              <span className="chiffre text-lg">
                {cours.seats_taken}/{cours.capacity}
              </span>
            </div>

            {inscrites.length === 0 ? (
              <p className="py-6 text-center text-[15px] text-plume-deep">
                Personne d&apos;inscrite pour l&apos;instant.
              </p>
            ) : (
              inscrites.map((i) => (
                <div
                  key={i.bookingId}
                  className="flex items-center justify-between gap-3 border-b border-sable py-3.5 last:border-b-0"
                >
                  <div className="flex items-center gap-3">
                    <span
                      aria-hidden="true"
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-framboise-wash text-[13px] font-semibold text-framboise-deep"
                    >
                      {`${i.prenom[0] ?? ""}${i.nom[0] ?? ""}`.toUpperCase()}
                    </span>
                    <div>
                      <p className="text-[15px]">
                        {i.prenom} {i.nom}
                      </p>
                      <p className="text-[13px] text-plume-deep">
                        {i.email}
                        {i.telephone && ` · ${i.telephone}`}
                      </p>
                    </div>
                  </div>

                  {!annule && !passe && (
                    <ConfirmerAction
                      action={desinscrire}
                      declencheur="Désinscrire"
                      champs={{ coursId: cours.id, reservationId: i.bookingId }}
                      avertissement={
                        <>
                          {i.prenom} perd sa place et récupère sa séance. Elle
                          n&apos;est pas prévenue automatiquement : préviens-la.
                        </>
                      }
                      confirmer={`Oui, désinscrire ${i.prenom}`}
                    />
                  )}
                </div>
              ))
            )}

            {inscrites.length > 0 && !annule && !passe && (
              <p className="mt-3.5 text-[13px] text-plume-deep">
                Désinscrire rend sa séance à la cliente, sans condition de délai.
                Le geste est tracé.
              </p>
            )}
          </section>

          {/* Modification -------------------------------------------- */}
          {!annule && (
            <section className="rounded-md border border-sable bg-white p-[22px]">
              <h3 className="mb-5">Modifier le cours</h3>
              <FormulaireModification
                cours={{
                  id: cours.id,
                  location_id: cours.location_id,
                  date: dateLocale(cours.starts_at),
                  debut: heureLocale(cours.starts_at),
                  fin: heureLocale(cours.ends_at),
                  capacity: cours.capacity,
                  seats_taken: cours.seats_taken,
                }}
                lieux={lieux
                  .filter((l) => l.is_active || l.id === cours.location_id)
                  .map((l) => ({ valeur: l.id, libelle: l.name }))}
              />
            </section>
          )}
        </div>

        <aside className="flex flex-col gap-5">
          <section className="rounded-md border border-sable bg-white p-[22px]">
            <h3 className="mb-4">Le cours</h3>
            <dl className="flex flex-col gap-3 text-[15px]">
              {[
                ["Lieu", lieu?.name ?? "Lieu supprimé"],
                ["Date", enDateAnnee(cours.starts_at)],
                ["Horaire", enCreneau(cours.starts_at, cours.ends_at)],
                ["Places", `${cours.seats_taken} sur ${cours.capacity}`],
              ].map(([cle, valeur]) => (
                <div key={cle} className="flex justify-between gap-3">
                  <dt className="text-plume-deep">{cle}</dt>
                  <dd className="text-right font-medium">{valeur}</dd>
                </div>
              ))}
            </dl>
            {cours.recurrence_group_id && (
              <p className="mt-4 text-[13px] text-plume-deep">
                Ce cours fait partie d&apos;une série. Le modifier ou l&apos;annuler
                ne touche que cette séance.
              </p>
            )}
          </section>

          {!annule && !passe && (
            <section className="rounded-md border border-sable bg-white p-[22px]">
              <h3 className="mb-2">Annuler le cours</h3>
              <p className="mb-4 text-[15px] text-plume-deep">
                {inscrites.length === 0
                  ? "Personne n'est inscrite, personne ne sera prévenue."
                  : inscrites.length === 1
                    ? "L'inscrite récupère sa séance automatiquement et reçoit un mail."
                    : `Les ${inscrites.length} inscrites récupèrent leur séance automatiquement et reçoivent un mail.`}
              </p>
              {/* Sans inscrite, annuler n'a aucune consequence pour personne :
                  la confirmation serait de la friction pour rien. Des qu'il y a
                  du monde, elle devient necessaire. */}
              {inscrites.length === 0 ? (
                <form action={annulerCours} className="flex flex-col gap-3">
                  <input type="hidden" name="id" value={cours.id} />
                  <ChampMotif />
                  <button
                    type="submit"
                    className="cursor-pointer rounded-sm border border-framboise px-[22px] py-[13px] text-[15px] font-semibold text-framboise transition-colors hover:bg-framboise-wash"
                  >
                    J&apos;annule ce cours
                  </button>
                </form>
              ) : (
                <ConfirmerAction
                  action={annulerCours}
                  variante="danger"
                  declencheur="Annuler ce cours"
                  champs={{ id: cours.id }}
                  avertissement={
                    <>
                      <strong>
                        {inscrites.length} inscrite{inscrites.length > 1 ? "s" : ""}
                      </strong>{" "}
                      {inscrites.length > 1 ? "seront" : "sera"} recréditée
                      {inscrites.length > 1 ? "s" : ""} et prévenue
                      {inscrites.length > 1 ? "s" : ""} par mail. Le cours
                      disparaît du planning. C&apos;est définitif : on ne
                      &laquo;&nbsp;dés-annule&nbsp;&raquo; pas un cours.
                    </>
                  }
                  confirmer="Oui, j'annule ce cours"
                  enfants={<ChampMotif />}
                />
              )}
            </section>
          )}
        </aside>
      </div>
    </>
  );
}
