import { siteUrl } from "./client";

export type Ligne = [string, string];

export type Contenu = {
  /** Repris comme titre dans le corps, distinct de l'objet. */
  titre: string;
  paragraphes: string[];
  lignes?: Ligne[];
  encadre?: string;
  bouton?: { libelle: string; chemin: string };
  pied?: string[];
};

const COULEURS = {
  framboise: "#D81840",
  encre: "#1B1B1D",
  encreSoft: "#3A3A3E",
  ivoire: "#FAF6F4",
  sable: "#EFE7E4",
  plume: "#7C7076",
  ambreWash: "#FBEEDC",
  ambre: "#7A4A0F",
};

const POLICE = "Karla, 'Helvetica Neue', Helvetica, Arial, sans-serif";
const DISPLAY = "Archivo, 'Helvetica Neue', Helvetica, Arial, sans-serif";

function echapper(t: string): string {
  return t
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/**
 * Rend les deux versions a partir de la MEME structure.
 *
 * C'est le point : une cliente qui lit en texte brut — messagerie
 * professionnelle, images coupees, lecteur d'ecran — doit recevoir la meme
 * information, pas un resume. Deux gabarits separes divergeraient a la
 * premiere modification.
 */
export function rendre(contenu: Contenu): { html: string; texte: string } {
  const url = contenu.bouton ? `${siteUrl()}${contenu.bouton.chemin}` : null;

  // ---- Texte brut --------------------------------------------------------
  const texte = [
    contenu.titre,
    "".padEnd(contenu.titre.length, "="),
    "",
    ...contenu.paragraphes,
    ...(contenu.lignes?.length
      ? ["", ...contenu.lignes.map(([c, v]) => `${c} : ${v}`)]
      : []),
    ...(contenu.encadre ? ["", contenu.encadre] : []),
    ...(url ? ["", `${contenu.bouton!.libelle} : ${url}`] : []),
    ...(contenu.pied?.length ? ["", ...contenu.pied] : []),
    "",
    "—",
    "Step by Step Coaching — cours de Fitness Step en Guadeloupe",
    "Les Abymes, Le Moule, Jarry",
    "Réponds à ce mail, il arrive directement chez Oriane.",
  ].join("\n");

  // ---- HTML --------------------------------------------------------------
  const p = (t: string) =>
    `<p style="margin:0 0 14px;font-size:16px;line-height:1.6;color:${COULEURS.encreSoft};">${echapper(t)}</p>`;

  const lignes = contenu.lignes?.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px;border-collapse:collapse;">
${contenu.lignes
  .map(
    ([c, v]) =>
      `<tr><td style="padding:9px 0;border-bottom:1px solid ${COULEURS.sable};font-size:15px;color:${COULEURS.plume};">${echapper(c)}</td>` +
      `<td align="right" style="padding:9px 0;border-bottom:1px solid ${COULEURS.sable};font-size:15px;font-weight:600;color:${COULEURS.encre};">${echapper(v)}</td></tr>`,
  )
  .join("\n")}
</table>`
    : "";

  const encadre = contenu.encadre
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px;"><tr>
<td style="background:${COULEURS.ambreWash};border-radius:12px;padding:14px 16px;font-size:15px;line-height:1.6;color:${COULEURS.ambre};">${echapper(contenu.encadre)}</td>
</tr></table>`
    : "";

  const bouton = url
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:6px 0 18px;"><tr>
<td style="background:${COULEURS.framboise};border-radius:6px;">
<a href="${url}" style="display:inline-block;padding:13px 22px;font-family:${POLICE};font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">${echapper(contenu.bouton!.libelle)}</a>
</td></tr></table>
<p style="margin:0 0 14px;font-size:13px;line-height:1.6;color:${COULEURS.plume};">Si le bouton ne marche pas : ${url}</p>`
    : "";

  const pied = contenu.pied?.length
    ? contenu.pied
        .map(
          (t) =>
            `<p style="margin:0 0 8px;font-size:13px;line-height:1.6;color:${COULEURS.plume};">${echapper(t)}</p>`,
        )
        .join("\n")
    : "";

  const html = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${echapper(contenu.titre)}</title></head>
<body style="margin:0;padding:0;background:${COULEURS.ivoire};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COULEURS.ivoire};padding:28px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid ${COULEURS.sable};border-radius:18px;">
<tr><td style="background:${COULEURS.encre};border-radius:17px 17px 0 0;padding:18px 26px;">
<span style="font-family:${DISPLAY};font-style:italic;font-weight:700;font-size:19px;color:#ffffff;">Step <span style="color:${COULEURS.framboise};">by</span> Step</span>
</td></tr>
<tr><td style="padding:26px;font-family:${POLICE};">
<h1 style="margin:0 0 16px;font-family:${DISPLAY};font-style:italic;font-weight:700;font-size:26px;line-height:1.1;color:${COULEURS.encre};">${echapper(contenu.titre)}</h1>
${contenu.paragraphes.map(p).join("\n")}
${lignes}
${encadre}
${bouton}
${pied}
</td></tr>
<tr><td style="padding:0 26px 26px;font-family:${POLICE};">
<p style="margin:0;padding-top:18px;border-top:1px solid ${COULEURS.sable};font-size:13px;line-height:1.6;color:${COULEURS.plume};">
Step by Step Coaching — cours de Fitness Step en Guadeloupe<br>Les Abymes, Le Moule, Jarry<br>
Réponds à ce mail, il arrive directement chez Oriane.
</p>
</td></tr>
</table>
</td></tr></table>
</body></html>`;

  return { html, texte };
}
