import { CHARTE, SOUS_TITRE_CHARTE, TITRE_CHARTE, VERSION_CHARTE } from "@/lib/charte/texte";

/**
 * La charte, rendue en HTML.
 *
 * En HTML et non en PDF : c'est sur un telephone qu'elle sera lue, et un PDF
 * s'y pince et s'y deplace. Le texte est le meme partout — vitrine, signature,
 * profil — parce qu'il vient d'une seule source.
 *
 * `compacte` retire le titre : la page qui l'affiche en a deja un.
 */
export function TexteCharte({ compacte = false }: { compacte?: boolean }) {
  return (
    <div className="text-[15px] leading-[1.65] text-encre-soft sm:text-base">
      {!compacte && (
        <header className="mb-8">
          <h1 className="mb-2">{TITRE_CHARTE}</h1>
          <p className="text-[17px] text-plume-deep">{SOUS_TITRE_CHARTE}</p>
          <p className="mt-2 text-[13px] text-plume-deep">Version {VERSION_CHARTE}</p>
        </header>
      )}

      {CHARTE.map((article) => (
        <section
          key={article.numero || article.titre}
          className={
            article.saillant
              ? "my-6 rounded-md border border-sable-deep bg-white p-5 sm:p-6"
              : "mb-6"
          }
        >
          <h2 className="mb-2.5 font-display text-[19px] font-semibold italic sm:text-[21px]">
            {article.numero && (
              <span className="mr-2 font-texte text-[13px] font-semibold tracking-wide text-framboise not-italic uppercase">
                {article.numero}
              </span>
            )}
            {article.titre}
          </h2>

          {article.texte?.map((p) => (
            <p key={p.slice(0, 40)} className="mb-2.5">{p}</p>
          ))}

          {article.points && <Puces points={article.points} />}

          {article.sections?.map((s) => (
            <div key={s.numero} className="mt-5">
              <h3 className="mb-1.5 text-[15px] font-semibold text-encre sm:text-base">
                {s.numero} — {s.titre}
              </h3>
              {s.texte?.map((p) => (
                <p key={p.slice(0, 40)} className="mb-2.5">{p}</p>
              ))}
              {s.points && <Puces points={s.points} />}
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}

function Puces({ points }: { points: string[] }) {
  return (
    <ul className="flex flex-col gap-2 pl-5">
      {points.map((p) => (
        <li key={p.slice(0, 40)} className="list-disc marker:text-framboise">{p}</li>
      ))}
    </ul>
  );
}
