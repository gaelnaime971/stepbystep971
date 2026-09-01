import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Conditions générales de vente — Step by Step Coaching",
  description:
    "Formules, validité des séances, réservation, annulation, abonnements et remboursements.",
};

export default function PageCgv() {
  return (
    <>
      <h1>Conditions générales de vente</h1>
      <span className="maj">Dernière mise à jour : septembre 2026</span>

      <p>
        Ces conditions régissent la vente de séances de step par Step by Step
        Coaching, entreprise individuelle immatriculée sous le SIRET
        915 127 534 00013, ci-après « Step by Step », à toute personne majeure
        achetant sur ce site, ci-après « la cliente ».
      </p>
      <p>
        Toute commande vaut acceptation des présentes conditions, dans leur
        version en vigueur au jour de l&apos;achat.
      </p>

      <h2>1. Ce qui est vendu</h2>
      <p>
        Step by Step ne vend pas des cours à date fixe, mais un <strong>solde de
        séances</strong>. Chaque formule crédite un nombre de séances portant une
        date de fin de validité. La cliente place ensuite elle-même ces séances
        sur les cours de son choix, depuis son espace personnel.
      </p>
      <p>
        Une réservation consomme une séance. Une annulation dans les délais la
        restitue.
      </p>

      <h3>Les formules</h3>
      <table>
        <thead>
          <tr><th>Formule</th><th>Séances</th><th>Validité</th><th>Prix</th></tr>
        </thead>
        <tbody>
          <tr><td>À la carte</td><td>1</td><td>1 mois</td><td>15 €</td></tr>
          <tr><td>Abonnement 4 séances</td><td>4</td><td>4 semaines, renouvelé</td><td>50 €</td></tr>
          <tr><td>Abonnement 8 séances</td><td>8</td><td>4 semaines, renouvelé</td><td>70 €</td></tr>
          <tr><td>Pack 5 séances</td><td>5</td><td>3 mois</td><td>70 €</td></tr>
          <tr><td>Pack 15 séances</td><td>15</td><td>3 mois</td><td>200 €</td></tr>
          <tr><td>Pack 30 séances</td><td>30</td><td>3 mois</td><td>400 €</td></tr>
        </tbody>
      </table>
      <p>
        Les prix sont indiqués en euros, toutes taxes comprises. TVA non
        applicable, article 293 B du Code général des impôts. Les prix affichés
        au moment de l&apos;achat sont ceux qui s&apos;appliquent : une
        modification tarifaire ultérieure n&apos;a aucun effet sur les séances
        déjà achetées.
      </p>

      <h2>2. Validité des séances</h2>
      <p>
        Les séances non utilisées à la date de fin de validité sont{" "}
        <strong>perdues</strong>. Elles ne sont ni reportées, ni remboursées, ni
        transférables à une autre personne.
      </p>
      <p>
        Cette règle est rappelée sur la fiche de chaque formule, au moment du
        paiement, et dans l&apos;espace personnel. Un courriel d&apos;alerte est
        envoyé avant l&apos;échéance, à titre de service et sans que son absence
        puisse être opposée à Step by Step.
      </p>
      <p>
        Lorsque plusieurs soldes coexistent, les séances les plus proches de leur
        échéance sont consommées en premier.
      </p>

      <h2>3. Abonnements</h2>
      <p>
        Les abonnements sont prélevés <strong>toutes les 4 semaines</strong>, soit
        28 jours, et non tous les mois calendaires. À chaque prélèvement, le
        solde est <strong>remis</strong> au nombre de séances de la formule : le
        reliquat du cycle précédent n&apos;est pas ajouté, il est annulé.
      </p>
      <p>
        La cliente peut résilier à tout moment depuis son espace personnel, sans
        préavis ni motif. La résiliation prend effet à la fin de la période déjà
        payée : les séances de cette période restent utilisables jusqu&apos;à
        leur date de validité, et aucun nouveau prélèvement n&apos;a lieu.
      </p>
      <p>
        En cas d&apos;échec de prélèvement, plusieurs tentatives automatiques
        sont effectuées. Si toutes échouent, l&apos;abonnement cesse de se
        recharger et la cliente en est informée par courriel. Les séances déjà
        créditées restent utilisables jusqu&apos;à leur échéance.
      </p>

      <h2>4. Réservation et annulation d&apos;un cours</h2>
      <p>
        La réservation se fait depuis l&apos;espace personnel, dans la limite des
        places disponibles. Il n&apos;y a pas de liste d&apos;attente.
      </p>
      <p>
        Une réservation peut être annulée jusqu&apos;à <strong>24 heures</strong>{" "}
        avant le début du cours : la séance revient alors sur le solde. Ce délai
        peut varier selon la formule ; le délai applicable est celui affiché dans
        l&apos;espace personnel.
      </p>
      <p>
        Passé ce délai, la séance est décomptée, que la cliente se présente ou
        non. La place est restée réservée et n&apos;a pas pu être proposée à une
        autre personne.
      </p>
      <p>
        Si Step by Step annule un cours, toutes les inscrites sont recréditées
        automatiquement et prévenues par courriel.
      </p>

      <h2>5. Droit de rétractation</h2>
      <p>
        Conformément aux articles L. 221-18 et suivants du Code de la
        consommation, la cliente dispose d&apos;un délai de{" "}
        <strong>quatorze jours</strong> à compter de la conclusion du contrat
        pour se rétracter, sans motif ni pénalité.
      </p>
      <p>
        Lorsque la cliente demande expressément l&apos;exécution du service avant
        la fin de ce délai — c&apos;est-à-dire lorsqu&apos;elle réserve ou suit un
        cours — elle reste redevable du montant correspondant aux séances déjà
        consommées, au prorata. Le remboursement porte sur les séances non
        utilisées.
      </p>
      <p>
        Pour se rétracter, il suffit d&apos;écrire à{" "}
        <a href="mailto:sbscoaching28@gmail.com">sbscoaching28@gmail.com</a> en
        indiquant nom, date d&apos;achat et formule. Le remboursement intervient
        dans les quatorze jours suivant la demande, par le moyen de paiement
        d&apos;origine.
      </p>
      <p>
        <span className="aremplir">
          [À vérifier avec un juriste : l&apos;article L. 221-28 12° exclut du
          droit de rétractation les activités de loisirs fournies à une date ou
          période déterminée. Selon la lecture retenue, ce droit peut ne pas
          s&apos;appliquer aux cours réservés à une date précise. La rédaction
          ci-dessus est la plus protectrice pour la cliente.]
        </span>
      </p>

      <h2>6. Paiement</h2>
      <p>
        Les paiements sont traités par Stripe. Step by Step n&apos;a jamais accès
        aux numéros de carte : ils sont saisis directement sur les serveurs de
        Stripe, prestataire agréé.
      </p>
      <p>
        Les séances sont créditées dès confirmation du paiement, en général
        immédiatement. Un courriel de confirmation est envoyé. Les factures sont
        accessibles depuis l&apos;espace personnel, via le portail Stripe.
      </p>

      <h2>7. Remboursements</h2>
      <p>
        En dehors du droit de rétractation, les séances achetées ne sont pas
        remboursables. Step by Step peut néanmoins procéder à un remboursement à
        titre commercial, notamment en cas d&apos;empêchement durable et justifié.
      </p>
      <p>
        Un remboursement total annule les séances restantes du solde concerné.
        Les séances déjà consommées ne sont pas reprises, et les cours déjà
        suivis restent acquis.
      </p>

      <h2>8. Accès aux cours et sécurité</h2>
      <p>
        La pratique du step est une activité physique. La cliente déclare être en
        état de la pratiquer et s&apos;engage à signaler à Step by Step toute
        contre-indication, blessure ou grossesse.
      </p>
      <p>
        <span className="aremplir">
          [À décider avec un juriste : exiger ou non un certificat médical ou une
          attestation sur l&apos;honneur, et à partir de quand.]
        </span>
      </p>
      <p>
        Step by Step se réserve le droit de refuser l&apos;accès à un cours en cas
        de retard important, de comportement dangereux ou de non-respect des
        consignes de sécurité, sans que cela ouvre droit à remboursement.
      </p>

      <h2>9. Compte personnel</h2>
      <p>
        Le compte est strictement personnel. Les séances ne peuvent être ni
        cédées, ni partagées, ni utilisées par un tiers. La cliente est
        responsable de la confidentialité de son mot de passe.
      </p>

      <h2>10. Modification des conditions</h2>
      <p>
        Step by Step peut modifier les présentes conditions. La version
        applicable à un achat est celle en vigueur au jour de cet achat. Les
        abonnées en cours sont informées de toute modification substantielle
        avant son entrée en vigueur, et peuvent résilier si elle ne leur convient
        pas.
      </p>

      <h2>11. Réclamations et médiation</h2>
      <p>
        Toute réclamation peut être adressée à{" "}
        <a href="mailto:sbscoaching28@gmail.com">sbscoaching28@gmail.com</a>.
      </p>
      <p>
        Conformément à l&apos;article L. 612-1 du Code de la consommation, la
        cliente peut recourir gratuitement à un médiateur de la consommation en
        vue de la résolution amiable d&apos;un litige.
      </p>
      <p>
        <span className="aremplir">
          [Obligatoire : adhérer à un médiateur de la consommation et indiquer
          ici son nom, son adresse postale et son site. Sans cette mention, les
          CGV sont incomplètes au regard de la loi.]
        </span>
      </p>

      <h2>12. Données personnelles</h2>
      <p>
        Le traitement des données est décrit dans la{" "}
        <Link href="/confidentialite">politique de confidentialité</Link>.
      </p>
    </>
  );
}
