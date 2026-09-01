import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Jeton anti-robot, sans captcha.
 *
 * Le formulaire porte un jeton signe contenant l'instant ou la page a ete
 * servie. A la reception on verifie la signature, puis on exige un delai
 * plausible : moins de 2 secondes, c'est un robot qui poste sans lire ; plus
 * de 2 heures, c'est un formulaire recolte et rejoue.
 *
 * La signature est ce qui compte : un horodatage nu se falsifie, celui-ci non.
 * Combine au champ piege, cela arrete les robots courants sans imposer un
 * captcha a des clientes qui remplissent un formulaire sur leur telephone.
 */
function cle(): string {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.CRON_SECRET;
  if (!secret) throw new Error("Aucun secret serveur disponible pour signer le formulaire.");
  // Deriver plutot que d'employer le secret tel quel : le jeton part dans une
  // page publique, il ne doit rien apprendre sur la cle d'origine.
  return createHmac("sha256", secret).update("contact-v1").digest("hex");
}

export function signerJeton(): string {
  const t = Date.now().toString(36);
  const s = createHmac("sha256", cle()).update(t).digest("hex").slice(0, 32);
  return `${t}.${s}`;
}

export type Verdict = "ok" | "trop_rapide" | "perime" | "invalide";

export function verifierJeton(jeton: string): Verdict {
  const [t, s] = jeton.split(".");
  if (!t || !s) return "invalide";

  const attendu = createHmac("sha256", cle()).update(t).digest("hex").slice(0, 32);
  const a = Buffer.from(s);
  const b = Buffer.from(attendu);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return "invalide";

  const age = Date.now() - parseInt(t, 36);
  if (age < 2000) return "trop_rapide";
  if (age > 2 * 60 * 60 * 1000) return "perime";
  return "ok";
}
