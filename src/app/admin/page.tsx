import type { Metadata } from "next";
import { profilCourant } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Administration — Step by Step" };

export default async function PageAdmin() {
  const profil = await profilCourant();
  if (!profil) return null; // Le layout a deja redirige.

  return (
    <>
      <h2 className="mb-2">Bonjour {profil.first_name}</h2>
      <p className="text-plume">
        Le planning, les clientes et les ventes arrivent ici.
      </p>
    </>
  );
}
