import { Logo } from "@/components/Logo";

export default function LayoutAuth({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-ivoire">
      <header className="border-b border-sable px-6 py-4">
        <div className="mx-auto max-w-shell">
          <Logo hauteur={44} priorite />
        </div>
      </header>

      <main id="contenu" className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-[420px]">{children}</div>
      </main>
    </div>
  );
}
