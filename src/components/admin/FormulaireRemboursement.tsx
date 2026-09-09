import { ConfirmerAction } from "@/components/ConfirmerAction";
import { rembourser } from "@/lib/admin/actions";
import { enDateAnnee } from "@/lib/dates";
import { centimesEnEuros, prixLisible } from "@/lib/formules/format";
import type { AchatDetail } from "@/lib/admin/types";

/**
 * Le remboursement d'UN achat, sur sa ligne.
 *
 * Sur la ligne et non sur la fiche : une cliente a plusieurs achats, et un
 * bouton global obligerait a redesigner lequel dans le formulaire — une
 * occasion de se tromper de commande, pour une erreur qui ne se rattrape pas.
 *
 * Le panneau dit la CONSEQUENCE, chiffree, avant le second clic. Pas
 * « es-tu sure » : personne ne lit « es-tu sure », tout le monde lit
 * « 2 inscriptions seront annulees ».
 */
export function FormulaireRemboursement({
  achat,
  clienteId,
}: {
  achat: AchatDetail;
  clienteId: string;
}) {
  const { impact } = achat;
  const { soldeRevocable, consommeesPassees, coursAVenir, remboursable, prixSeance } = impact;

  const rien = soldeRevocable === 0 && coursAVenir.length === 0;

  return (
    <ConfirmerAction
      variante="danger"
      declencheur="Rembourser"
      confirmer="Je rembourse"
      champs={{ achatId: achat.id, clienteId }}
      avertissement={
        <>
          <p className="font-semibold">
            Si tu rends la totalité, {prixLisible(remboursable)} :
          </p>
          <ul className="mt-2 flex list-disc flex-col gap-1 pl-5">
            <li>
              {soldeRevocable === 0
                ? "aucune séance à retirer de son solde"
                : `${soldeRevocable} séance${soldeRevocable > 1 ? "s" : ""} retirée${soldeRevocable > 1 ? "s" : ""} de son solde`}
            </li>
            <li>
              {coursAVenir.length === 0
                ? "aucune inscription à venir à annuler"
                : `${coursAVenir.length} inscription${coursAVenir.length > 1 ? "s" : ""} annulée${coursAVenir.length > 1 ? "s" : ""}, place${coursAVenir.length > 1 ? "s" : ""} rendue${coursAVenir.length > 1 ? "s" : ""}`}
            </li>
            {consommeesPassees > 0 && (
              <li>
                {consommeesPassees} cours déjà suivi{consommeesPassees > 1 ? "s" : ""} — ils restent
                acquis
              </li>
            )}
          </ul>

          {coursAVenir.length > 0 && (
            <>
              <p className="mt-2.5">Les cours annulés, du plus lointain au plus proche :</p>
              <ul className="mt-1 flex flex-col gap-0.5 pl-5">
                {coursAVenir.map((c) => (
                  <li key={c.bookingId} className="list-disc">
                    {enDateAnnee(c.debut)} — {c.lieu}
                  </li>
                ))}
              </ul>
            </>
          )}

          {rien && (
            <p className="mt-2.5">
              Elle a déjà tout utilisé, et sur des cours passés. L&apos;argent part, son
              solde ne bouge pas.
            </p>
          )}

          <p className="mt-2.5">
            Elle reçoit un email avec le montant et ce qui a été retiré. Ton motif n&apos;y
            figure pas, il reste dans son historique.
          </p>
        </>
      }
      enfants={
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor={`montant-${achat.id}`} className="mb-1.5 block text-sm font-semibold">
                Montant à rendre
              </label>
              <input
                id={`montant-${achat.id}`}
                name="montant"
                type="text"
                inputMode="decimal"
                required
                defaultValue={centimesEnEuros(remboursable)}
                className="w-full rounded-sm border border-sable-deep bg-white px-[13px] py-3 text-[16px]"
              />
              <p className="mt-1.5 text-[13px] text-plume-deep">
                En euros. {prixLisible(remboursable)} au maximum.
              </p>
            </div>

            <div>
              <label htmlFor={`seances-${achat.id}`} className="mb-1.5 block text-sm font-semibold">
                Séances à retirer
              </label>
              <input
                id={`seances-${achat.id}`}
                name="seances"
                type="number"
                min={0}
                max={soldeRevocable + coursAVenir.length}
                defaultValue={soldeRevocable}
                className="w-full rounded-sm border border-sable-deep bg-white px-[13px] py-3 text-[16px]"
              />
              <p className="mt-1.5 text-[13px] text-plume-deep">
                Ignoré si tu rends la totalité — tout part alors.
                {prixSeance !== null && ` Une séance vaut ${prixLisible(prixSeance)} sur cet achat.`}
              </p>
            </div>
          </div>

          <div>
            <label htmlFor={`motif-${achat.id}`} className="mb-1.5 block text-sm font-semibold">
              Motif
            </label>
            <input
              id={`motif-${achat.id}`}
              name="motif"
              type="text"
              required
              placeholder="Erreur de formule, geste commercial…"
              className="w-full rounded-sm border border-sable-deep bg-white px-[13px] py-3 text-[16px]"
            />
            <p className="mt-1.5 text-[13px] text-plume-deep">
              Obligatoire. Il reste dans son historique, elle ne le voit pas.
            </p>
          </div>
        </>
      }
      action={rembourser}
    />
  );
}
