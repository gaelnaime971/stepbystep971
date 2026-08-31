/**
 * Les RPC de 0005 levent des exceptions dont le message est en francais, mais
 * ecrit sans accents comme tout le SQL du projet. Ces messages ne doivent pas
 * atteindre une cliente tels quels.
 *
 * Le SQLSTATE sert exactement a ca : le code route, l'application ecrit. C'est
 * aussi le bon endroit — la formulation est une affaire de produit, pas de
 * schema.
 */
const PAR_CODE: Record<string, string> = {
  SB001:
    "Tu n'as plus de séance disponible. Prends une formule pour recharger ton solde.",
  SB002:
    "Tes séances expirent avant ce cours. Réserve un cours plus tôt, ou recharge ton solde.",
  SB003: "Ce cours vient d'afficher complet. Choisis-en un autre.",
  SB004: "Ce cours a été annulé.",
  SB005: "Ce cours a déjà commencé.",
  SB006: "Tu es déjà inscrite à ce cours.",
  SB007:
    "Trop tard pour annuler. Ta séance reste décomptée.",
  SB008: "Cette réservation n'existe plus. Recharge la page.",
  SB009: "Ta session a expiré. Reconnecte-toi.",
};

export function messageReservation(
  code: string | undefined,
  remplacement?: string,
): string {
  if (remplacement) return remplacement;
  if (code && PAR_CODE[code]) return PAR_CODE[code];
  return "Ça n'a pas fonctionné. Recharge la page et réessaie.";
}
