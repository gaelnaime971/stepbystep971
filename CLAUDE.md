# Step by Step — plateforme de réservation de cours de step

## Le projet en une phrase

Oriane donne des cours de step en Guadeloupe. Ses clientes achètent des séances en ligne, puis les placent elles-mêmes dans son planning depuis leur compte.

Client : Step by Step Coaching (SIRET 915 127 534 00013). Prestataire : Omega Investment (devis 2026015).

## Les trois surfaces

| Surface | Route | Pour qui |
|---|---|---|
| Vitrine publique | `/` | Visiteuses non connectées |
| Espace cliente | `/compte` | Clientes connectées |
| Espace admin | `/admin` | Oriane uniquement |

Le planning des cours est **visible publiquement** sur la vitrine (ça rend l'offre concrète), mais réserver exige un compte.

## Stack

- Next.js 15, App Router, TypeScript, `src/`, alias `@/*`
- Tailwind CSS v4 (config-in-CSS dans `globals.css`, pas de `tailwind.config.js`)
- Supabase : auth + Postgres + RLS
- Stripe : paiements uniques, abonnements, codes promo, portail client
- Resend : emails transactionnels
- Vercel : hébergement, domaine `stepbystep-guadeloupe.fr`

## Règle métier centrale

**Tout est un solde de séances.** Peu importe la formule achetée, la cliente est créditée de N séances portant une date d'expiration. Réserver un cours consomme 1 séance. Annuler dans les délais la restitue.

Les trois familles de formules ne changent que la façon de recharger ce solde.

### Les six formules

| Formule | Séances | Validité | Prix | Paiement |
|---|---|---|---|---|
| À la carte | 1 | 1 mois | 15 € | unique |
| Abonnement 4 séances | 4 | 4 semaines | 50 € | récurrent |
| Abonnement 8 séances | 8 | 4 semaines | 70 € | récurrent |
| Pack 5 séances | 5 | 3 mois | 70 € (au lieu de 75 €) | unique |
| Pack 15 séances | 15 | 3 mois | 200 € (au lieu de 225 €) | unique |
| Pack 30 séances | 30 | 3 mois | 400 € (au lieu de 450 €) | unique |

### Les règles à ne jamais casser

1. **Expiration stricte.** Les séances non consommées à l'échéance sont perdues. Aucun report, jamais.
2. **Abonnement = reset, pas cumul.** À chaque prélèvement, le solde repart à N séances. Il ne s'additionne pas au reliquat.
3. **L'abonnement est en 4 semaines, pas en mois.** Côté Stripe : `interval: week, interval_count: 4`. Ne jamais le créer en `monthly`.
4. **Consommation par expiration la plus proche.** Si la cliente cumule plusieurs soldes (un abonnement et un pack), on décrémente d'abord celui qui expire le plus tôt.
5. **Pas de réservation au-delà de l'expiration.** Impossible de réserver un cours qui tombe après la date de validité du solde qui le financerait.
6. **Annulation cliente : 24 h avant le cours**, avec recrédit automatique. Ce délai est un **paramètre modifiable par formule** dans l'admin, pas une constante en dur.
7. **Cours annulé par Oriane** : recrédit automatique de toutes les inscrites + email.
8. **Capacité** définie par Oriane à la création du cours. Au-delà, le cours est « complet ». **Pas de liste d'attente.**
9. **Pas de pointage de présence.** Oriane voit qui est inscrit, c'est tout.
10. **Prix immuables.** On ne modifie jamais le prix d'une formule existante : on en crée une nouvelle et on archive l'ancienne. Les abonnées en cours ne migrent pas.

### Pouvoirs d'Oriane sur une fiche cliente

Ajouter ou retirer une séance à la main, désinscrire une cliente d'un cours, consulter l'historique. Ce sont des gestes de rattrapage, ils doivent être tracés.

## Les lieux

Les Abymes, Le Moule, Jarry. Gérés en table, pas en enum figé — elle en ouvrira d'autres.

## Direction artistique

**Source de vérité : `maquettes/tokens.css`.** Les variables passent dans `globals.css` sous `@theme`. N'invente aucune couleur, aucune taille, aucune police qui n'y figure pas.

- Framboise `#D81840` — issu de son logo. Accents, boutons, prix, chiffres.
- Noir `#1B1B1D`, ivoire `#FAF6F4`, sable `#EFE7E4`.
- Vert `#1F8F63` (place disponible), ambre `#B9741A` (expire bientôt), gris (complet).
- Titres et chiffres : Archivo, italique, 700. Texte courant : Karla.

Le rose ponctue, il ne recouvre pas. Les photos portent l'identité, pas les aplats de couleur.

Les trois fichiers HTML de `maquettes/` sont des **références visuelles**, pas du code à porter tel quel. Lis-les pour la structure et le style, réécris en composants React propres.

## Ton et écriture

**Tutoiement partout** : interface, emails, messages d'erreur. C'est la voix d'Oriane.

Sa communauté s'appelle la **Team Super Nana**. Son événement annuel, la **Fitness Academy**. Utilise ces noms plutôt que des termes génériques : « Rejoindre la team » plutôt que « S'inscrire ».

Écriture : phrases courtes, verbe d'action sur les boutons, pas de majuscules décoratives, pas de point d'exclamation dans les messages système. Un bouton « Je réserve » produit une confirmation « Réservé ».

Les erreurs disent ce qui s'est passé et quoi faire. Jamais d'excuse, jamais de vague.

## Emails (Resend)

Confirmation d'achat, confirmation de réservation, annulation d'un cours par Oriane, alerte de fin de validité. Pas de SMS.

## Méthode de travail

- Le schéma de base de données et les RLS **avant** tout écran.
- Une étape = un commit revertable. Pas de gros chantier en une passe.
- Un audit avant chaque gros bloc, un rapport après.
- Ne généralise pas prématurément : on extrait une primitive quand le troisième usage apparaît, pas avant.
- Stripe en mode test pendant tout le développement. Les clés sont lues depuis les variables d'environnement — passer en production ne doit jamais demander de toucher au code.
- Ne modifie jamais le dossier `maquettes/`.

## Hors périmètre (devis complémentaire)

Liste d'attente, SMS, application mobile native, comptabilité, gestion de plusieurs intervenantes, maintenance. Si le besoin surgit, signale-le, ne l'implémente pas.