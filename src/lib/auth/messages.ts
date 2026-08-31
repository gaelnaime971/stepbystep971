/**
 * Traduction des erreurs Supabase.
 *
 * Supabase repond en anglais et en termes techniques. Une erreur dit ce qui
 * s'est passe et quoi faire : jamais d'excuse, jamais de vague, pas de point
 * d'exclamation.
 */
const TRADUCTIONS: ReadonlyArray<[RegExp, string]> = [
  [
    /invalid login credentials/i,
    "Email ou mot de passe incorrect. Vérifie ta saisie.",
  ],
  [
    /email not confirmed/i,
    "Ton compte n'est pas encore confirmé. Ouvre le mail que je t'ai envoyé et clique sur le lien.",
  ],
  [
    /user already registered|already been registered/i,
    "Un compte existe déjà avec cet email. Connecte-toi, ou demande un nouveau mot de passe.",
  ],
  [
    /password should be at least/i,
    "Ton mot de passe doit faire au moins 8 caractères.",
  ],
  [
    /new password should be different/i,
    "Choisis un mot de passe différent de l'ancien.",
  ],
  [
    /for security purposes|rate limit|too many requests/i,
    "Trop de tentatives. Attends quelques minutes avant de réessayer.",
  ],
  [
    /token has expired|invalid or has expired|otp_expired/i,
    "Ce lien a expiré. Demande-en un nouveau.",
  ],
  [
    /unable to validate email|invalid email/i,
    "Cet email n'est pas valide. Vérifie ta saisie.",
  ],
  [
    /auth session missing/i,
    "Ta session a expiré. Reconnecte-toi.",
  ],
];

export function messageErreur(brut: string | undefined | null): string {
  if (!brut) return "Quelque chose n'a pas fonctionné. Réessaie.";
  for (const [motif, texte] of TRADUCTIONS) {
    if (motif.test(brut)) return texte;
  }
  return "Quelque chose n'a pas fonctionné. Réessaie, et écris-moi si ça persiste.";
}
