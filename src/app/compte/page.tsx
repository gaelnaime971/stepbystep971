import type { Metadata } from "next";
import { profilCourant } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Mon compte — Step by Step" };

export default async function PageCompte() {
  const profil = await profilCourant();
  if (!profil) return null; // Le layout a deja redirige.

  return (
    <>
      <h2 className="mb-2">Salut {profil.first_name}</h2>
      <p className="mb-8 text-plume">
        Ton compte est actif. Tes séances et le planning arrivent ici.
      </p>

      <section className="rounded-md border border-sable bg-white p-[22px]">
        <h3 className="mb-4">Mon profil</h3>
        <dl className="flex flex-col gap-3 text-[15px]">
          <div className="flex justify-between gap-4">
            <dt className="text-plume">Nom</dt>
            <dd>
              {profil.first_name} {profil.last_name}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-plume">Email</dt>
            <dd>{profil.email}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-plume">Téléphone</dt>
            <dd>{profil.phone ?? "non renseigné"}</dd>
          </div>
        </dl>
      </section>
    </>
  );
}
