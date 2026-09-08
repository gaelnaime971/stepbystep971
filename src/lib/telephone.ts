/**
 * Le telephone, et la seule limite qui compte : celle de Stripe.
 *
 * `customer.phone` chez Stripe est plafonne a 20 CARACTERES. Rien ne le disait
 * dans le formulaire d'inscription, ou le champ acceptait n'importe quoi — une
 * cliente y a saisi son adresse email, et son paiement a echoue avec un message
 * anglais incomprehensible, sur la page « Quelque chose s'est casse ».
 *
 * Un numero guadeloupeen, meme au format international avec des espaces
 * (« +590 690 12 34 56 », 17 caracteres), tient sans peine dans cette limite.
 */
export const LONGUEUR_TELEPHONE_MAX = 20;

/** Chiffres, espaces, et la ponctuation qu'on ecrit vraiment dans un numero. */
const CARACTERES = /^[0-9+().\s-]+$/;

/** Assez de chiffres pour que ce soit un numero, pas une bribe. */
const CHIFFRES_MINIMUM = 6;

export function telephoneValide(valeur: string): boolean {
  if (valeur.length > LONGUEUR_TELEPHONE_MAX) return false;
  if (!CARACTERES.test(valeur)) return false;
  return (valeur.match(/\d/g) ?? []).length >= CHIFFRES_MINIMUM;
}

/**
 * Ce qu'on ose transmettre a Stripe.
 *
 * Le telephone est facultatif pour Stripe : mieux vaut ne rien envoyer qu'un
 * paiement refuse. Les profils crees avant la validation portent encore des
 * valeurs impossibles, et ils doivent pouvoir payer aujourd'hui.
 */
export function telephonePourStripe(valeur: string | null | undefined): string | undefined {
  const t = (valeur ?? "").trim();
  return t && telephoneValide(t) ? t : undefined;
}

/** Le message montre a la cliente. Il dit quoi faire, pas ce qui a echoue. */
export const MESSAGE_TELEPHONE =
  `Ce numéro n'est pas valide. Chiffres, espaces, + et tirets, ${LONGUEUR_TELEPHONE_MAX} caractères au plus.`;
