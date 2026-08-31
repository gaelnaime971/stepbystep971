import Link from "next/link";

export function Marque({ clair = false }: { clair?: boolean }) {
  return (
    <Link
      href="/"
      className={`font-display text-[19px] font-bold italic tracking-[-0.01em] ${
        clair ? "text-white" : "text-encre"
      }`}
    >
      Step <em className="text-framboise">by</em> Step
    </Link>
  );
}
