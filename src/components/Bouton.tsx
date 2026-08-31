"use client";

import { useFormStatus } from "react-dom";

/**
 * Bouton d'envoi. Le libelle d'attente est explicite plutot qu'un sablier :
 * on dit ce qui se passe.
 */
export function BoutonEnvoi({
  children,
  enAttente,
}: {
  children: React.ReactNode;
  enAttente: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-sm border border-transparent bg-framboise px-[22px] py-[13px] text-[15px] font-semibold text-white transition-colors hover:bg-framboise-deep disabled:cursor-not-allowed disabled:bg-plume"
    >
      {pending ? enAttente : children}
    </button>
  );
}
