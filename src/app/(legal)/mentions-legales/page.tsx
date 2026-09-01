import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Mentions légales — Step by Step Coaching",
  description: "Éditeur, hébergeur et propriété intellectuelle du site Step by Step Coaching.",
};

export default function PageMentionsLegales() {
  return (
    <>
      <h1>Mentions légales</h1>
      <span className="maj">Dernière mise à jour : septembre 2026</span>

      <h2>L&apos;éditrice du site</h2>
      <dl>
        <dt>Dénomination</dt>
        <dd>Step by Step Coaching</dd>
        <dt>Forme juridique</dt>
        <dd>Entreprise individuelle (micro-entreprise)</dd>
        <dt>Responsable de la publication</dt>
        <dd><span className="aremplir">[Prénom et nom complet d&apos;Oriane]</span></dd>
        <dt>Siège</dt>
        <dd><span className="aremplir">[Adresse complète, code postal, commune — Guadeloupe]</span></dd>
        <dt>SIRET</dt>
        <dd>915 127 534 00013</dd>
        <dt>Code APE</dt>
        <dd><span className="aremplir">[Code APE, probablement 8551Z — enseignement de disciplines sportives et d&apos;activités de loisirs]</span></dd>
        <dt>Numéro de TVA intracommunautaire</dt>
        <dd>
          Sans objet : l&apos;entreprise bénéficie de la franchise en base de TVA
          (article 293 B du Code général des impôts). TVA non applicable.
        </dd>
        <dt>Carte professionnelle d&apos;éducateur sportif</dt>
        <dd><span className="aremplir">[Numéro de carte professionnelle et DRAJES de délivrance — obligatoire pour l&apos;enseignement contre rémunération]</span></dd>
        <dt>Assurance responsabilité civile professionnelle</dt>
        <dd><span className="aremplir">[Assureur, numéro de contrat, étendue géographique]</span></dd>
        <dt>Contact</dt>
        <dd>
          <a href="mailto:sbscoaching28@gmail.com">sbscoaching28@gmail.com</a>
          {" — "}
          <span className="aremplir">[Numéro de téléphone si tu veux l&apos;afficher]</span>
        </dd>
      </dl>

      <h2>L&apos;hébergeur</h2>
      <p>Le site est hébergé par :</p>
      <dl>
        <dt>Vercel Inc.</dt>
        <dd>
          340 S Lemon Ave #4133, Walnut, CA 91789, États-Unis —{" "}
          <a href="https://vercel.com" target="_blank" rel="noopener noreferrer">vercel.com</a>
        </dd>
      </dl>
      <p>
        Les données sont stockées par Supabase, dans l&apos;Union européenne
        (région Paris, eu-west-3). Les paiements sont traités par Stripe
        Payments Europe Ltd, 1 Grand Canal Street Lower, Dublin 2, Irlande. Les
        emails sont acheminés par Resend.
      </p>

      <h2>Propriété intellectuelle</h2>
      <p>
        Le logo, les photographies, les vidéos et les textes de ce site sont la
        propriété de Step by Step Coaching, sauf mention contraire. Toute
        reproduction, même partielle, sans autorisation écrite préalable est
        interdite.
      </p>
      <p>
        Les chorégraphies, programmes et contenus pédagogiques diffusés pendant
        les cours ne peuvent être ni enregistrés ni rediffusés sans accord.
      </p>

      <h2>Photographies prises pendant les cours</h2>
      <p>
        Des photos et vidéos sont parfois prises pendant les cours et lors de la
        Fitness Academy, et publiées sur ce site ou sur les réseaux sociaux. Si
        tu ne souhaites pas y apparaître, dis-le simplement à Oriane : tu peux
        t&apos;y opposer à tout moment, avant comme après publication, et sans
        avoir à te justifier. Écris à{" "}
        <a href="mailto:sbscoaching28@gmail.com">sbscoaching28@gmail.com</a> et
        l&apos;image sera retirée.
      </p>

      <h2>Signaler un contenu</h2>
      <p>
        Pour signaler un contenu illicite ou une erreur sur ce site, écris à{" "}
        <a href="mailto:sbscoaching28@gmail.com">sbscoaching28@gmail.com</a>. La
        demande sera traitée dans les meilleurs délais.
      </p>

      <h2>Droit applicable</h2>
      <p>
        Le présent site est soumis au droit français. En cas de litige, et à
        défaut de résolution amiable, les tribunaux compétents seront ceux du
        ressort du domicile de l&apos;éditrice, sous réserve des dispositions
        protectrices du consommateur.
      </p>
    </>
  );
}
