/**
 * Ce qu'on montre a Oriane quand une erreur n'a pas de traduction.
 *
 * Le message brut de Postgres ou de Stripe est en anglais et parle de
 * contraintes et de colonnes : il ne l'aide pas et l'inquiete. Le detail part
 * dans les journaux du serveur, ou Gael le retrouvera ; elle ne recoit qu'un
 * code court a lui citer.
 */
export function detailTechnique(
  contexte: string,
  erreur: { code?: string; message?: string } | null | undefined,
): string {
  console.error(`[${contexte}]`, erreur?.code ?? "sans code", erreur?.message ?? "");

  const code = erreur?.code;
  return code
    ? `Si ça se reproduit, donne ce code à Gaël : ${contexte}/${code}.`
    : `Si ça se reproduit, préviens Gaël en lui disant à quel moment : ${contexte}.`;
}
