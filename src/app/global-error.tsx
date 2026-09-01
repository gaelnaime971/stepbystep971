"use client";

/**
 * Dernier filet : une erreur dans la coquille racine elle-meme. Ni police, ni
 * feuille de style ne sont garanties ici — tout est en ligne.
 */
export default function ErreurGlobale({ reset }: { reset: () => void }) {
  return (
    <html lang="fr">
      <body style={{ margin: 0, background: "#FAF6F4", color: "#1B1B1D",
        fontFamily: "system-ui, -apple-system, Helvetica, Arial, sans-serif" }}>
        <div style={{ maxWidth: 520, margin: "0 auto", padding: "80px 24px" }}>
          <p style={{ fontStyle: "italic", fontWeight: 700, fontSize: 19, margin: 0 }}>
            Step <span style={{ color: "#D81840" }}>by</span> Step
          </p>
          <h1 style={{ fontStyle: "italic", fontSize: 32, lineHeight: 1.1, margin: "32px 0 12px" }}>
            Le site ne répond plus
          </h1>
          <p style={{ fontSize: 17, lineHeight: 1.6, color: "#3A3A3E", margin: "0 0 32px" }}>
            Une panne est en cours. Réessaie dans un instant, ou écris à
            sbscoaching28@gmail.com.
          </p>
          <button type="button" onClick={reset}
            style={{ background: "#D81840", color: "#fff", border: 0, borderRadius: 6,
              padding: "15px 22px", fontSize: 15, fontWeight: 600, cursor: "pointer" }}>
            Réessayer
          </button>
        </div>
      </body>
    </html>
  );
}
