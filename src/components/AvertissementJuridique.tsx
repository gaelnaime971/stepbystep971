import { Bandeau } from "@/components/Bandeau";
import { profilCourant } from "@/lib/auth/session";

/**
 * Les deux mises en garde d'Oriane sur MES brouillons juridiques.
 *
 * Elles vivaient dans le layout de `(legal)`, donc sur toute page du groupe.
 * La charte de participation y est entree, et elle, Oriane l'a ecrite : lui
 * coller « document a faire valider par un juriste » serait faux, et userait
 * un avertissement qui doit rester credible la ou il compte.
 *
 * Il est donc pose page par page, explicitement.
 *
 * VISIBLE D'ORIANE SEULE. Le controle est DANS le composant et non chez
 * l'appelant : une page qui l'oublierait afficherait « document a faire
 * valider par un juriste » a ses clientes, en tete de ses CGV.
 */
export async function AvertissementJuridique() {
  const profil = await profilCourant();
  if (profil?.role !== "admin") return null;

  return (
    <div className="mb-8 flex flex-col gap-3">
      <Bandeau ton="attention" titre="Document à faire valider par un professionnel du droit avant mise en ligne">
        Ce texte est une base sérieuse, écrite à partir de ton activité réelle,
        mais il n&apos;a pas été rédigé par un juriste. Fais-le relire avant de
        t&apos;en servir : c&apos;est ton entreprise qui s&apos;engage.
      </Bandeau>
      <Bandeau ton="erreur" titre="Il te manque un médiateur de la consommation">
        L&apos;article L. 612-1 du code de la consommation <strong>oblige</strong>{" "}
        tout professionnel qui vend à des particuliers à adhérer à un dispositif
        de médiation, et à en indiquer les coordonnées sur son site et ses
        conditions de vente. Sans cela, tes CGV sont incomplètes et tu
        t&apos;exposes à une amende administrative. L&apos;adhésion se fait
        auprès d&apos;un médiateur référencé par la CECMC, pour quelques
        dizaines d&apos;euros par an. C&apos;est à faire avant d&apos;ouvrir les
        ventes.
      </Bandeau>
    </div>
  );
}
