import type { Metadata } from "next";
import Link from "next/link";
import { Bandeau } from "@/components/Bandeau";
import { Champ, ZoneTexte } from "@/components/Champ";
import { Logo } from "@/components/Logo";
import { NavVitrine } from "@/components/vitrine/Nav";
import { accueilSelonRole, profilCourant } from "@/lib/auth/session";
import { envoyerMessage } from "@/lib/contact/actions";
import { signerJeton } from "@/lib/contact/jeton";
import { clientServeur } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Contact — Step by Step Coaching",
  description:
    "Une question sur les cours, les formules ou ta réservation ? Écris à Oriane. Cours aux Abymes, au Moule et à Jarry.",
};

// La page porte un jeton horodaté : elle ne peut pas être mise en cache.
export const dynamic = "force-dynamic";

export default async function PageContact({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; ton?: string }>;
}) {
  const { message, ton } = await searchParams;
  const profil = await profilCourant();

  const supabase = await clientServeur();
  const { data: lieux } = await supabase
    .from("locations").select("id, name, address, city").eq("is_active", true)
    .order("sort_order")
    .returns<{ id: string; name: string; address: string | null; city: string | null }[]>();

  return (
    <>
      <NavVitrine
        destinationCompte={profil ? accueilSelonRole(profil.role) : "/connexion"}
        connectee={!!profil}
      />

      <main id="contenu" className="px-5 py-12 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-shell">
          <div className="mb-10 max-w-[54ch]">
            <h1 className="text-[clamp(30px,6vw,44px)]">Une question ?</h1>
            <p className="mt-4 text-[17px] text-plume-deep">
              Écris-moi. Je réponds moi-même, en général sous 24 heures. Pour
              tout ce qui touche à ta réservation ou à ton solde, pense à
              regarder ton compte d&apos;abord, tout y est.
            </p>
          </div>

          <div className="grid items-start gap-8 lg:grid-cols-[1fr_360px] lg:gap-12">
            <section id="formulaire" className="scroll-mt-20 rounded-md border border-sable bg-white p-5 sm:p-7">
              {message && (
                <div className="mb-6">
                  <Bandeau ton={ton === "erreur" ? "erreur" : "succes"}>{message}</Bandeau>
                </div>
              )}

              <form action={envoyerMessage} className="flex max-w-[520px] flex-col gap-5">
                <input type="hidden" name="jeton" value={signerJeton()} />

                {/* Champ piège. Caché aux humaines, pas aux robots. */}
                <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
                  <label htmlFor="site">Ne remplis pas ce champ</label>
                  <input id="site" name="site" type="text" tabIndex={-1} autoComplete="off" />
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <Champ nom="nom" libelle="Ton prénom et ton nom" autoComplete="name"
                    valeurParDefaut={profil ? `${profil.first_name} ${profil.last_name}` : ""} />
                  <Champ nom="email" libelle="Ton email" type="email"
                    valeurParDefaut={profil?.email ?? ""} autoComplete="email" />
                </div>

                <ZoneTexte nom="message" libelle="Ton message" lignes={6}
                  aide="Dis-moi ce dont tu as besoin. Si c'est une question sur un cours, précise la date et le lieu." />

                <button type="submit"
                  className="inline-flex cursor-pointer items-center justify-center rounded-sm bg-framboise px-[22px] py-[15px] text-[15px] font-semibold text-white transition-colors hover:bg-framboise-deep sm:self-start sm:py-[13px]">
                  J&apos;envoie mon message
                </button>

                <p className="text-[13px] text-plume-deep">
                  Ton message arrive directement dans la boîte d&apos;Oriane. Elle
                  te répond à l&apos;adresse que tu donnes ici.
                </p>
              </form>
            </section>

            <aside className="flex flex-col gap-5">
              <section className="rounded-md border border-sable bg-white p-5 sm:p-[22px]">
                <h3 className="mb-4">Où on se retrouve</h3>
                {(lieux ?? []).length === 0 && (
                  <p className="py-3 text-[15px] text-plume-deep">
                    Les lieux sont en cours de mise à jour. Demande-moi où on se
                    retrouve, je te réponds tout de suite.
                  </p>
                )}
                {(lieux ?? []).map((l) => (
                  <div key={l.id} className="border-b border-sable py-3 last:border-b-0">
                    <p className="text-[15px] font-medium">{l.name}</p>
                    <p className="text-[13px] text-plume-deep">
                      {[l.address, l.city].filter(Boolean).join(", ") || "Adresse communiquée à l'inscription"}
                    </p>
                  </div>
                ))}
                <p className="mt-4 text-[13px] text-plume-deep">
                  Les horaires changent chaque semaine.{" "}
                  <Link href="/#planning" className="text-framboise-deep underline underline-offset-[3px]">
                    Vois le planning
                  </Link>
                  .
                </p>
              </section>

              <section className="rounded-md border border-sable bg-white p-5 sm:p-[22px]">
                <h3 className="mb-4">Autrement</h3>
                <ul className="flex flex-col gap-3 text-[15px]">
                  <li>
                    <a href="mailto:sbscoaching28@gmail.com"
                      className="text-framboise-deep underline underline-offset-[3px]">
                      sbscoaching28@gmail.com
                    </a>
                  </li>
                  {process.env.NEXT_PUBLIC_INSTAGRAM_URL && (
                    <li>
                      <a href={process.env.NEXT_PUBLIC_INSTAGRAM_URL}
                        target="_blank" rel="noopener noreferrer"
                        className="text-framboise-deep underline underline-offset-[3px]">
                        Instagram
                      </a>
                    </li>
                  )}
                </ul>
              </section>
            </aside>
          </div>
        </div>
      </main>

      <footer className="mt-16 bg-encre px-5 pt-12 pb-8 text-sm text-[#9A9096] sm:px-6">
        <div className="mx-auto flex max-w-shell flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Logo clair hauteur={44} />
            <p className="mt-3">Cours de step en Guadeloupe</p>
          </div>
          <p>Step by Step Coaching — Hegesippe Oriane (EI) — Siret 915 127 534 00013.</p>
        </div>
      </footer>
    </>
  );
}
