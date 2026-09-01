import type { Metadata } from "next";
import Link from "next/link";
import { Bandeau } from "@/components/Bandeau";
import { Pastille } from "@/components/Pastille";
import { profilCourant } from "@/lib/auth/session";
import { kpis, pointsDAttention } from "@/lib/admin/lecture";
import type { Attention } from "@/lib/admin/types";
import { enHeure, enJourCourt } from "@/lib/dates";
import { prixLisible } from "@/lib/formules/format";
import { aujourdHui, dateLocale, semaineDe } from "@/lib/planning/dates";
import { coursEntre, tousLesLieux } from "@/lib/planning/lecture";

export const metadata: Metadata = { title: "Vue d'ensemble — Step by Step" };

function Kpi({ valeur, libelle, note }: { valeur: string; libelle: string; note?: string }) {
  return (
    <div className="rounded-md border border-sable bg-white px-[18px] py-[17px]">
      <p className="chiffre text-[32px] leading-[1.1]">{valeur}</p>
      <p className="mt-1 text-sm text-plume-deep">{libelle}</p>
      {note && <p className="mt-0.5 text-[13px] text-plume-deep">{note}</p>}
    </div>
  );
}

/** Chaque alerte dit ce qui se passe, et mène à l'écran où la régler. */
function alerte(a: Attention): { texte: string; lien: string; libelleLien: string; grave: boolean } {
  switch (a.type) {
    case "formule_non_publiee":
      return {
        texte: `${a.nombre} formule${a.nombre > 1 ? "s ne sont" : " n'est"} pas achetable${a.nombre > 1 ? "s" : ""} : ${a.nombre > 1 ? "elles n'existent" : "elle n'existe"} pas encore chez Stripe.`,
        lien: "/admin/formules", libelleLien: "Publier", grave: true,
      };
    case "paiement_en_echec":
      return {
        texte: `${a.nombre} abonnement${a.nombre > 1 ? "s" : ""} en échec de paiement. ${a.nombre > 1 ? "Ces clientes ne seront plus rechargées" : "Cette cliente ne sera plus rechargée"}.`,
        lien: "/admin/paiements", libelleLien: "Voir", grave: true,
      };
    case "webhook_non_traite":
      return {
        texte: `${a.nombre} paiement${a.nombre > 1 ? "s" : ""} que Stripe a signalé${a.nombre > 1 ? "s" : ""} mais que le site n'a pas su traiter. Préviens Gaël.`,
        lien: "/admin/paiements", libelleLien: "Voir", grave: true,
      };
    case "seances_expirent":
      return {
        texte: `${a.nombre} séance${a.nombre > 1 ? "s" : ""} expire${a.nombre > 1 ? "nt" : ""} sous 7 jours, chez ${a.clientes} cliente${a.clientes > 1 ? "s" : ""}. Elles reçoivent une alerte automatique.`,
        lien: "/admin/clientes", libelleLien: "Voir les clientes", grave: false,
      };
    case "cours_complet":
      return {
        texte: `${a.nombre} cours complet${a.nombre > 1 ? "s" : ""} dans les 14 jours. Ouvrir un créneau de plus ?`,
        lien: "/admin/planning", libelleLien: "Le planning", grave: false,
      };
    case "cours_vide":
      return {
        texte: `${a.nombre} cours sans personne dans les 3 jours.`,
        lien: "/admin/planning", libelleLien: "Le planning", grave: false,
      };
  }
}

export default async function PageAdmin() {
  const profil = await profilCourant();
  if (!profil) return null;

  const jour = aujourdHui();
  const semaine = semaineDe(jour);

  const [chiffres, attentions, deLaSemaine, lieux] = await Promise.all([
    kpis(), pointsDAttention(), coursEntre(semaine[0], semaine.at(-1)!), tousLesLieux(),
  ]);

  const nomLieu = new Map(lieux.map((l) => [l.id, l.name]));
  const duJour = deLaSemaine.filter((c) => dateLocale(c.starts_at) === jour);
  const inscritesDuJour = duJour.reduce((n, c) => n + c.seats_taken, 0);

  return (
    <>
      <div className="mb-[26px] flex flex-wrap items-start justify-between gap-5">
        <div>
          <h2>Bonjour {profil.first_name}</h2>
          <p className="mt-1.5 text-plume-deep">
            {duJour.length === 0
              ? "Aucun cours aujourd'hui."
              : `${duJour.length} cours aujourd'hui, ${inscritesDuJour} inscrite${inscritesDuJour > 1 ? "s" : ""}.`}
          </p>
        </div>
        <Link
          href="/admin/planning/nouveau"
          className="inline-flex items-center justify-center rounded-sm bg-framboise px-[22px] py-[13px] text-[15px] font-semibold text-white transition-colors hover:bg-framboise-deep"
        >
          Créer un cours
        </Link>
      </div>

      <div className="mb-[30px] grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-3.5">
        <Kpi valeur={prixLisible(chiffres.encaisseCeMois)} libelle="Encaissé ce mois" note="net des remboursements" />
        <Kpi valeur={String(chiffres.clientesActives)} libelle="Clientes actives" note="avec des séances à placer" />
        <Kpi valeur={String(chiffres.abonnementsEnCours)} libelle="Abonnements en cours" />
        <Kpi
          valeur={chiffres.tauxRemplissage === null ? "—" : `${chiffres.tauxRemplissage} %`}
          libelle="Taux de remplissage"
          note={chiffres.coursTrenteJours > 0 ? `sur ${chiffres.coursTrenteJours} cours passés` : "aucun cours passé"}
        />
      </div>

      <section className="mb-6">
        <h3 className="mb-3">Ce qui demande ton attention</h3>
        {attentions.length === 0 ? (
          // Le silence serait ambigu : elle ne saurait pas si le controle a eu
          // lieu. Une bonne nouvelle se dit.
          <Bandeau ton="succes">
            Rien à signaler. Les formules sont en vente, les paiements passent,
            et aucune séance n&apos;expire dans les sept jours.
          </Bandeau>
        ) : (
          <div className="flex flex-col gap-2.5">
            {attentions.map((a) => {
              const v = alerte(a);
              return (
                <div key={a.type}>
                  <Bandeau ton={v.grave ? "erreur" : "attention"}>
                    <span className="flex flex-wrap items-baseline justify-between gap-3">
                      <span>{v.texte}</span>
                      <Link href={v.lien} className="font-semibold underline underline-offset-[3px]">
                        {v.libelleLien}
                      </Link>
                    </span>
                  </Bandeau>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <div className="grid items-start gap-5 lg:grid-cols-[1fr_1fr]">
        <section className="rounded-md border border-sable bg-white p-[22px]">
          <div className="mb-4 flex items-center justify-between gap-3.5">
            <h3>Aujourd&apos;hui</h3>
            <span className="text-[13px] text-plume-deep first-letter:uppercase">
              {enJourCourt(`${jour}T12:00:00-04:00`)}
            </span>
          </div>
          {duJour.length === 0 ? (
            <p className="py-4 text-[15px] text-plume-deep">Rien au planning aujourd&apos;hui.</p>
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

        <section className="rounded-md border border-sable bg-white p-[22px]">
          <h3 className="mb-4">Cette semaine</h3>
          {deLaSemaine.length === 0 ? (
            <p className="py-4 text-[15px] text-plume-deep">Aucun cours cette semaine.</p>
          ) : (
            deLaSemaine.map((c) => (
              <Link
                key={c.id}
                href={`/admin/planning/${c.id}`}
                className="flex items-center gap-3 border-b border-sable py-3 last:border-b-0"
              >
                <span className="min-w-[104px] text-[15px] font-medium first-letter:uppercase">
                  {enJourCourt(c.starts_at)}, {enHeure(c.starts_at)}
                </span>
                <span className="flex-1 text-[15px] text-plume-deep">
                  {nomLieu.get(c.location_id) ?? "—"}
                </span>
                <span className="text-[13px] text-plume-deep tabular-nums">
                  {c.seats_taken}/{c.capacity}
                </span>
              </Link>
            ))
          )}
        </section>
      </div>
    </>
  );
}
