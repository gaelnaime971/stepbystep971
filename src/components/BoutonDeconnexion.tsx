import { deconnexion } from "@/lib/auth/actions";

export function BoutonDeconnexion() {
  return (
    <form action={deconnexion}>
      <button
        type="submit"
        className="cursor-pointer rounded-sm border border-white/40 px-[14px] py-2 text-sm font-semibold text-white transition-colors hover:bg-white/10"
      >
        Me déconnecter
      </button>
    </form>
  );
}
