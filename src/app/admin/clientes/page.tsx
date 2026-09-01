import type { Metadata } from "next";
import Link from "next/link";
import { Bandeau } from "@/components/Bandeau";
import { Pastille } from "@/components/Pastille";
import { clientes } from "@/lib/admin/lecture";
import { enDate, joursRestants } from "@/lib/dates";

export const metadata: Metadata = { title: "Mes clientes — Step by Step" };

export default async function PageClientes({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; message?: string; ton?: string }>;
}) {
  const { q, message, ton } = await searchParams;
  const liste = await clientes(q);

  return (
    <>
      <div className="mb-[26px]">
        <h2>Mes clientes</h2>
        <p className="mt-1.5 text-plume-deep">
          {q
            ? `${liste.length} résultat${liste.length > 1 ? "s" : ""} pour « ${q} »`
            : `${liste.length} cliente${liste.length > 1 ? "s" : ""} inscrite${liste.length > 1 ? "s" : ""}`}
        </p>
      </div>

      {message && (
        <div className="mb-6">
          <Bandeau ton={ton === "erreur" ? "erreur" : "succes"}>{message}</Bandeau>
        </div>
      )}

      {/* Formulaire GET : la recherche vit dans l'URL, donc elle se partage
          et se retrouve dans l'historique du navigateur. */}
      <form method="get" className="mb-5 flex flex-wrap gap-2.5">
        <input
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Un prénom, un nom, un email"
          aria-label="Rechercher une cliente"
          className="w-full max-w-[320px] rounded-sm border border-sable-deep bg-white px-[13px] py-[11px] text-[15px]"
        />
        <button
          type="submit"
          className="cursor-pointer rounded-sm bg-framboise px-[22px] py-[11px] text-[15px] font-semibold text-white transition-colors hover:bg-framboise-deep"
        >
          Rechercher
        </button>
        {q && (
          <Link
            href="/admin/clientes"
            className="inline-flex items-center rounded-sm border border-sable-deep bg-white px-[18px] py-[11px] text-[15px] font-semibold text-encre hover:bg-sable"
          >
            Effacer
          </Link>
        )}
      </form>

      {liste.length === 0 ? (
        <p className="rounded-md border border-sable bg-white px-6 py-10 text-center text-[15px] text-plume-deep">
          {q ? "Personne ne correspond à cette recherche." : "Aucune cliente inscrite pour l'instant."}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-md border border-sable bg-white">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {["Cliente", "Formule", "Séances", "Validité", ""].map((t) => (
                  <th key={t} className="border-b border-sable px-3 py-2.5 text-left text-[13px] font-semibold text-plume-deep">
                    {t}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {liste.map((c) => {
                const jours = c.prochaineEcheance ? joursRestants(c.prochaineEcheance) : null;
                return (
                  <tr key={c.id}>
                    <td className="border-b border-sable px-3 py-3.5">
                      <div className="flex items-center gap-3">
                        <span
                          aria-hidden="true"
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-framboise-wash text-[13px] font-semibold text-framboise-deep"
                        >
                          {`${c.prenom[0] ?? ""}${c.nom[0] ?? ""}`.toUpperCase()}
                        </span>
                        <div>
                          <Link href={`/admin/clientes/${c.id}`} className="text-[15px] font-semibold underline underline-offset-[3px]">
                            {c.prenom} {c.nom}
                          </Link>
                          <p className="text-[13px] text-plume-deep">{c.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="border-b border-sable px-3 py-3.5 text-[15px] text-plume-deep">
                      {c.formule ?? "—"}
                    </td>
                    <td className="border-b border-sable px-3 py-3.5">
                      <span className={`chiffre text-lg ${c.solde === 0 ? "text-plume-deep" : ""}`}>
                        {c.solde}
                      </span>
                    </td>
                    <td className="border-b border-sable px-3 py-3.5 text-[15px]">
                      {c.prochaineEcheance ? (
                        jours !== null && jours <= 7 ? (
                          <Pastille ton="bientot">{enDate(c.prochaineEcheance)}</Pastille>
                        ) : (
                          enDate(c.prochaineEcheance)
                        )
                      ) : (
                        <Pastille ton="complet">Aucune séance</Pastille>
                      )}
                    </td>
                    <td className="border-b border-sable px-3 py-3.5 text-right">
                      <Link
                        href={`/admin/clientes/${c.id}`}
                        className="inline-flex rounded-sm border border-sable-deep bg-white px-4 py-2.5 text-sm font-semibold text-encre hover:bg-sable"
                      >
                        Ouvrir
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
