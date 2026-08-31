import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Bandeau } from "@/components/Bandeau";
import { Pastille } from "@/components/Pastille";
import { anonymiser, desinscrireDepuisFiche, enregistrerNotes } from "@/lib/admin/actions";
import { ficheCliente } from "@/lib/admin/lecture";
import { clientServeur } from "@/lib/supabase/server";
import { enCreneau, enDate, enDateAnnee, enJourLong, joursRestants } from "@/lib/dates";
import { prixLisible } from "@/lib/formules/format";
import {
  FormulaireAnonymisation, FormulaireCredit, FormulaireNotes, FormulaireRetrait,
} from "./formulaires";

export const metadata: Metadata = { title: "Fiche cliente — Step by Step" };

const MODELES: Record<string, string> = {
  purchase_confirmation: "Confirmation d'achat",
  booking_confirmation: "Confirmation de réservation",
  course_canceled: "Cours annulé",
  expiry_warning: "Alerte de fin de validité",
  payment_failed: "Échec de paiement",
};

const ORIGINES: Record<string, string> = {
  order: "achat",
  subscription_cycle: "abonnement",
  admin_grant: "ajouté par toi",
};

function Bloc({ titre, children, aide }: { titre: string; children: React.ReactNode; aide?: string }) {
  return (
    <section className="rounded-md border border-sable bg-white p-[22px]">
      <h3 className="mb-1">{titre}</h3>
      {aide && <p className="mb-4 text-[13px] text-plume">{aide}</p>}
      {!aide && <div className="mb-4" />}
      {children}
    </section>
  );
}

export default async function PageFicheCliente({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ message?: string; ton?: string }>;
}) {
  const { id } = await params;
  const { message, ton } = await searchParams;

  const fiche = await ficheCliente(id);
  if (!fiche) notFound();

  const { profil, lots, reservations, achats, abonnements, emails, soldeActif } = fiche;

  // admin_notes n'est lisible par aucun SELECT : le GRANT de colonne l'exclut.
  // Ce RPC est le seul chemin.
  const supabase = await clientServeur();
  const { data: notes } = await supabase.rpc("admin_client_notes", { p_user_id: id });

  const nom = `${profil.first_name} ${profil.last_name}`;
  const lotsOuverts = lots.filter((l) => l.quantite > 0 && !l.ferme && l.expire > new Date().toISOString());
  const aVenir = reservations.filter((r) => r.statut === "booked" && r.debut > new Date().toISOString());
  const passees = reservations.filter((r) => !(r.statut === "booked" && r.debut > new Date().toISOString()));
  const dansTroisMois = new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10);

  return (
    <>
      <p className="mb-4 text-[15px]">
        <Link href="/admin/clientes" className="text-framboise-deep underline underline-offset-[3px]">
          Retour aux clientes
        </Link>
      </p>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h2>{nom}</h2>
        {profil.role === "admin" && <Pastille ton="rose">Administratrice</Pastille>}
        {soldeActif === 0 && <Pastille ton="complet">Aucune séance</Pastille>}
      </div>

      {message && (
        <div className="mb-6">
          <Bandeau ton={ton === "erreur" ? "erreur" : "succes"}>{message}</Bandeau>
        </div>
      )}

      <div className="grid items-start gap-5 lg:grid-cols-[1fr_340px]">
        <div className="flex flex-col gap-5">
          {/* Le solde, lot par lot ------------------------------------- */}
          <Bloc
            titre={`Son solde : ${soldeActif} séance${soldeActif > 1 ? "s" : ""}`}
            aide="Les séances sont consommées en commençant par celles qui expirent le plus tôt."
          >
            {lots.length === 0 ? (
              <p className="py-4 text-[15px] text-plume">Aucune séance, jamais.</p>
            ) : (
              lots.map((l) => {
                const actif = l.quantite > 0 && !l.ferme && l.expire > new Date().toISOString();
                const jours = joursRestants(l.expire);
                return (
                  <div key={l.id} className={`flex items-center justify-between gap-3 border-b border-sable py-3 last:border-b-0 ${actif ? "" : "opacity-55"}`}>
                    <div>
                      <p className="text-[15px] font-medium">
                        {l.formule ?? "Séances ajoutées à la main"}
                        <span className="ml-2 text-[13px] font-normal text-plume">
                          {ORIGINES[l.origine] ?? l.origine}
                        </span>
                      </p>
                      <p className="text-[13px] text-plume">
                        {l.ferme
                          ? l.motifFermeture === "superseded"
                            ? `Remplacé par le cycle suivant le ${enDate(l.ferme)}`
                            : `Révoqué le ${enDate(l.ferme)} après remboursement`
                          : l.expire <= new Date().toISOString()
                            ? `Expiré le ${enDate(l.expire)}`
                            : `À utiliser avant le ${enDate(l.expire)}`}
                        {l.motif && ` · ${l.motif}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="chiffre text-lg">
                        {l.quantite}
                        <span className="text-[13px] text-plume">/{l.quantiteInitiale}</span>
                      </span>
                      {actif && jours <= 7 && <Pastille ton="bientot">{jours} j</Pastille>}
                    </div>
                  </div>
                );
              })
            )}
          </Bloc>

          {/* Rattrapages ---------------------------------------------- */}
          <div className="grid gap-5 md:grid-cols-2">
            <Bloc titre="Ajouter des séances" aide="Un geste de rattrapage. Il est tracé au grand livre.">
              <FormulaireCredit clienteId={id} dateParDefaut={dansTroisMois} />
            </Bloc>
            <Bloc titre="Retirer des séances" aide="Pour corriger un ajout de trop.">
              <FormulaireRetrait
                clienteId={id}
                lots={lotsOuverts.map((l) => ({
                  valeur: l.id,
                  libelle: `${l.formule ?? "Ajout manuel"} — ${l.quantite} séance${l.quantite > 1 ? "s" : ""}, jusqu'au ${enDate(l.expire)}`,
                }))}
              />
            </Bloc>
          </div>

          {/* Réservations --------------------------------------------- */}
          <Bloc titre="Ses réservations">
            {aVenir.length === 0 && passees.length === 0 ? (
              <p className="py-4 text-[15px] text-plume">Elle n&apos;a jamais réservé.</p>
            ) : (
              <>
                {aVenir.map((r) => (
                  <div key={r.id} className="flex items-center justify-between gap-3 border-b border-sable py-3">
                    <div>
                      <Link href={`/admin/planning/${r.coursId}`} className="text-[15px] font-medium underline underline-offset-[3px] first-letter:uppercase">
                        {enJourLong(r.debut)}, {enCreneau(r.debut, r.fin)}
                      </Link>
                      <p className="text-[13px] text-plume">{r.lieu}</p>
                    </div>
                    <form action={desinscrireDepuisFiche} className="flex items-center gap-2.5">
                      <input type="hidden" name="clienteId" value={id} />
                      <input type="hidden" name="reservationId" value={r.id} />
                      <label className="flex items-center gap-1.5 text-[13px] text-plume">
                        <input type="checkbox" name="recrediter" defaultChecked className="h-3.5 w-3.5 accent-[#D81840]" />
                        rendre la séance
                      </label>
                      <button type="submit" className="cursor-pointer border-none bg-transparent p-0 text-sm text-plume underline underline-offset-[3px] hover:text-framboise-deep">
                        Désinscrire
                      </button>
                    </form>
                  </div>
                ))}
                {passees.slice(0, 12).map((r) => (
                  <div key={r.id} className="flex items-center justify-between gap-3 border-b border-sable py-3 opacity-60 last:border-b-0">
                    <div>
                      <p className="text-[15px] first-letter:uppercase">
                        {enJourLong(r.debut)}, {enCreneau(r.debut, r.fin)}
                      </p>
                      <p className="text-[13px] text-plume">{r.lieu}</p>
                    </div>
                    <span className="text-[13px] text-plume">
                      {r.statut === "booked"
                        ? "passé"
                        : r.statut === "course_canceled"
                          ? `cours annulé${r.recreditee ? ", recréditée" : ""}`
                          : r.statut === "canceled_by_admin"
                            ? `désinscrite${r.recreditee ? ", recréditée" : ""}`
                            : `annulée${r.recreditee ? ", recréditée" : ", séance perdue"}`}
                    </span>
                  </div>
                ))}
              </>
            )}
          </Bloc>

          {/* Achats --------------------------------------------------- */}
          <Bloc titre="Ses achats">
            {achats.length === 0 ? (
              <p className="py-4 text-[15px] text-plume">Aucun achat.</p>
            ) : (
              achats.map((a) => (
                <div key={a.id} className="flex items-center justify-between gap-3 border-b border-sable py-3 last:border-b-0">
                  <div>
                    <p className="text-[15px] font-medium">{a.formule ?? "Formule supprimée"}</p>
                    <p className="text-[13px] text-plume">
                      {enDateAnnee(a.date)}
                      {a.type === "subscription_cycle" && " · prélèvement"}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[15px] font-medium">{prixLisible(a.montant)}</span>
                    {a.statut === "refunded" && <Pastille ton="complet">Remboursé</Pastille>}
                    {a.statut === "partially_refunded" && (
                      <Pastille ton="bientot">{prixLisible(a.rembourse)} rendus</Pastille>
                    )}
                    {a.statut === "pending" && <Pastille ton="bientot">En attente</Pastille>}
                  </div>
                </div>
              ))
            )}
          </Bloc>

          {/* Emails --------------------------------------------------- */}
          <Bloc titre="Ce qu'elle a reçu" aide="Utile quand elle dit n'avoir rien reçu.">
            {emails.length === 0 ? (
              <p className="py-4 text-[15px] text-plume">Aucun email envoyé.</p>
            ) : (
              emails.map((e) => (
                <div key={e.id} className="flex items-center justify-between gap-3 border-b border-sable py-2.5 last:border-b-0">
                  <div>
                    <p className="text-[15px]">{MODELES[e.modele] ?? e.modele}</p>
                    <p className="text-[13px] text-plume">{e.destinataire}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[13px] text-plume">{enDateAnnee(e.envoyeLe)}</p>
                    {e.erreur && <Pastille ton="complet">Non parti</Pastille>}
                  </div>
                </div>
              ))
            )}
          </Bloc>
        </div>

        {/* Colonne de droite -------------------------------------------- */}
        <aside className="flex flex-col gap-5">
          <Bloc titre="Ses informations">
            <dl className="flex flex-col gap-3 text-[15px]">
              {[
                ["Email", profil.email],
                ["Téléphone", profil.phone ?? "non renseigné"],
                ["Inscrite le", enDateAnnee(profil.created_at)],
              ].map(([cle, valeur]) => (
                <div key={cle} className="flex justify-between gap-3">
                  <dt className="text-plume">{cle}</dt>
                  <dd className="text-right break-all">{valeur}</dd>
                </div>
              ))}
            </dl>
          </Bloc>

          <Bloc titre="Sa formule">
            {abonnements.length === 0 ? (
              <p className="text-[15px] text-plume">Pas d&apos;abonnement. Ses séances viennent d&apos;achats ponctuels.</p>
            ) : (
              abonnements.map((a) => (
                <div key={a.id} className="border-b border-sable py-3 last:border-b-0">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <p className="text-[15px] font-medium">{a.formule ?? "Abonnement"}</p>
                    {a.echecDefinitif ? (
                      <Pastille ton="complet">Paiement en échec</Pastille>
                    ) : a.echecDepuis ? (
                      <Pastille ton="bientot">Paiement en attente</Pastille>
                    ) : a.statut === "canceled" ? (
                      <Pastille ton="complet">Terminé</Pastille>
                    ) : a.resilieALaFin ? (
                      <Pastille ton="bientot">Résilié</Pastille>
                    ) : (
                      <Pastille ton="dispo">En cours</Pastille>
                    )}
                  </div>
                  {a.finPeriode && (
                    <p className="text-[13px] text-plume">
                      {a.resilieALaFin || a.statut === "canceled" ? "Fin de validité" : "Prochain paiement"} le{" "}
                      {enDate(a.finPeriode)}
                    </p>
                  )}
                </div>
              ))
            )}
          </Bloc>

          <Bloc titre="Notes privées">
            <FormulaireNotes clienteId={id} notes={(notes as string) ?? ""} action={enregistrerNotes} />
          </Bloc>

          <Bloc titre="Effacer ses données" aide="Sur demande de sa part, ou après son départ.">
            <FormulaireAnonymisation clienteId={id} nom={nom} action={anonymiser} />
          </Bloc>
        </aside>
      </div>
    </>
  );
}
