import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Confidentialité — Step by Step Coaching",
  description:
    "Quelles données sont collectées, pourquoi, combien de temps, et comment exercer tes droits.",
};

export default function PageConfidentialite() {
  return (
    <>
      <h1>Politique de confidentialité</h1>
      <span className="maj">Dernière mise à jour : septembre 2026</span>

      <p>
        Cette page explique quelles informations Step by Step Coaching recueille
        te concernant, pourquoi, combien de temps elles sont gardées, et ce que
        tu peux exiger à leur sujet.
      </p>

      <h2>Qui est responsable</h2>
      <p>
        Step by Step Coaching, entreprise individuelle, SIRET 915 127 534 00013,{" "}
        <span className="aremplir">[adresse complète]</span>. Contact :{" "}
        <a href="mailto:sbscoaching28@gmail.com">sbscoaching28@gmail.com</a>.
      </p>
      <p>
        Aucun délégué à la protection des données n&apos;a été désigné : au vu de
        la taille de l&apos;activité, ce n&apos;est pas obligatoire.
      </p>

      <h2>Ce qui est collecté, et pourquoi</h2>
      <table>
        <thead>
          <tr><th>Données</th><th>Pourquoi</th><th>Base légale</th></tr>
        </thead>
        <tbody>
          <tr>
            <td>Prénom, nom, adresse email</td>
            <td>Créer ton compte, t&apos;identifier, t&apos;envoyer les confirmations</td>
            <td>Exécution du contrat</td>
          </tr>
          <tr>
            <td>Numéro de téléphone, si tu le donnes</td>
            <td>Te joindre si un cours est annulé au dernier moment</td>
            <td>Intérêt légitime</td>
          </tr>
          <tr>
            <td>Solde de séances, réservations, historique</td>
            <td>Faire fonctionner le service que tu as acheté</td>
            <td>Exécution du contrat</td>
          </tr>
          <tr>
            <td>Commandes, montants, factures</td>
            <td>Tenir la comptabilité et répondre au fisc</td>
            <td>Obligation légale</td>
          </tr>
          <tr>
            <td>Notes internes d&apos;Oriane</td>
            <td>Adapter les cours, se souvenir d&apos;une blessure ou d&apos;une contrainte</td>
            <td>Intérêt légitime</td>
          </tr>
          <tr>
            <td>Journal des courriels envoyés</td>
            <td>Vérifier qu&apos;un message t&apos;est bien parti</td>
            <td>Intérêt légitime</td>
          </tr>
        </tbody>
      </table>

      <h3>Ce qui n&apos;est pas collecté</h3>
      <p>
        Aucun numéro de carte bancaire ne transite par ce site ni n&apos;y est
        stocké : la saisie se fait directement chez Stripe. Il n&apos;y a ni
        traceur publicitaire, ni outil de mesure d&apos;audience, ni revente de
        données à qui que ce soit.
      </p>

      <h3>Notes internes</h3>
      <p>
        Oriane peut noter, sur ta fiche, des éléments utiles à ta pratique — une
        blessure, une préférence, un aménagement. Ces notes lui sont réservées,
        techniquement inaccessibles depuis ton compte. Tu peux à tout moment
        demander à savoir ce qu&apos;elles contiennent, à les faire corriger ou
        supprimer.
      </p>
      <p>
        Ces notes ne doivent contenir aucune donnée de santé détaillée. Si tu
        souhaites qu&apos;une information médicale soit prise en compte, dis-la
        de vive voix plutôt que de la faire consigner.
      </p>

      <h2>Combien de temps</h2>
      <dl>
        <dt>Compte et historique de pratique</dt>
        <dd>
          Tant que ton compte existe, puis 3 ans après ta dernière activité, sauf
          si tu demandes l&apos;effacement plus tôt.
        </dd>
        <dt>Commandes et factures</dt>
        <dd>
          10 ans, comme l&apos;impose le Code de commerce. Ce délai
          s&apos;applique même si tu demandes l&apos;effacement : la loi prime.
        </dd>
        <dt>Notes internes</dt>
        <dd>Effacées en même temps que ton compte.</dd>
        <dt>Messages envoyés depuis le formulaire de contact</dt>
        <dd>Conservés dans la boîte mail d&apos;Oriane, sans stockage sur le site.</dd>
      </dl>

      <h2>Qui d&apos;autre y a accès</h2>
      <p>
        Trois prestataires techniques, chacun pour ce qui le concerne, et aucun
        n&apos;a le droit d&apos;utiliser tes données à ses propres fins :
      </p>
      <ul>
        <li>
          <strong>Supabase</strong> — hébergement de la base, dans
          l&apos;Union européenne (Paris).
        </li>
        <li>
          <strong>Vercel</strong> — hébergement du site. Certains traitements
          techniques peuvent avoir lieu hors de l&apos;Union européenne, encadrés
          par les clauses contractuelles types de la Commission.
        </li>
        <li>
          <strong>Stripe</strong> — paiements, facturation et portail client.
        </li>
        <li>
          <strong>Resend</strong> — acheminement des courriels.
        </li>
      </ul>

      <h2>Cookies</h2>
      <p>
        Ce site dépose un seul cookie, celui qui te garde connectée à ton compte.
        Il est strictement nécessaire au fonctionnement du service et ne demande
        donc pas ton consentement. Il n&apos;y a aucun cookie publicitaire ni de
        mesure d&apos;audience, et donc aucune bannière à cliquer.
      </p>

      <h2>Tes droits</h2>
      <p>
        Le règlement européen sur la protection des données te donne le droit
        d&apos;accéder à tes données, de les faire corriger, de les faire
        effacer, d&apos;en limiter l&apos;usage, de t&apos;opposer à certains
        traitements, et de les récupérer dans un format lisible.
      </p>
      <p>
        Écris à{" "}
        <a href="mailto:sbscoaching28@gmail.com">sbscoaching28@gmail.com</a>. Une
        réponse te sera apportée sous un mois.
      </p>
      <p>
        Une limite à connaître : l&apos;effacement ne peut pas porter sur les
        commandes payées, que la loi comptable impose de conserver 10 ans. Dans
        ce cas, ton nom, ton email et ton téléphone sont remplacés par des
        valeurs neutres, et seule la trace comptable subsiste, sans lien avec ton
        identité.
      </p>
      <p>
        Si la réponse ne te convient pas, tu peux saisir la CNIL —{" "}
        <a href="https://www.cnil.fr" target="_blank" rel="noopener noreferrer">cnil.fr</a>.
      </p>

      <h2>Photographies</h2>
      <p>
        Des photos et vidéos sont parfois prises pendant les cours. Tu peux
        t&apos;opposer à ta présence sur ces images à tout moment, avant comme
        après publication, sans avoir à te justifier.
      </p>

      <h2>Sécurité</h2>
      <p>
        Les échanges avec ce site sont chiffrés. Les données de chaque cliente
        sont isolées au niveau de la base : ton compte ne peut techniquement pas
        lire celui d&apos;une autre. Les mots de passe ne sont jamais stockés en
        clair.
      </p>
      <p>
        En cas de violation de données susceptible de créer un risque pour tes
        droits, tu seras prévenue et la CNIL notifiée, dans les délais prévus par
        le règlement.
      </p>
    </>
  );
}
