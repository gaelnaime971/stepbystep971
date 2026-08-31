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

## Formules et Stripe

**Oriane est autonome sur ses formules. Elle n'ouvre jamais le tableau de bord Stripe.** Tout se pilote depuis `/admin/formules` : créer, publier, retirer de la vente, archiver, corriger. Stripe est un exécutant, pas une console d'administration.

### L'ordre des opérations, et pourquoi

**Stripe d'abord, la base ensuite.** À la création, la route serveur crée le produit puis le prix chez Stripe, et n'écrit la ligne `plans` qu'une fois les deux identifiants en main. Une formule enregistrée sans `stripe_price_id` serait visible sur la vitrine et impossible à payer — le pire des deux mondes.

Trois compensations, dans cet ordre de gravité :

1. **Le prix Stripe échoue après le produit** → le produit est archivé avant que l'erreur remonte. Pas de produit orphelin.
2. **La base échoue après Stripe** → le produit *et* le prix sont archivés. C'est le cas du slug déjà pris qui passerait le pré-contrôle par une écriture concurrente.
3. **Stripe échoue d'emblée** → rien n'est écrit nulle part, le message dit « rien n'a été créé, tu peux réessayer ».

Un pré-contrôle d'unicité du slug est fait **avant** d'appeler Stripe : moins cher qu'un aller-retour suivi d'une compensation. La contrainte `plans_slug_key` reste le juge, et son `23505` est traduit en français.

### Deux immuabilités qui se répondent

**Côté base, règle 10** : le prix d'une formule vendue ne change pas, le trigger `plans_guard_immutable` le refuse. L'admin le dit *avant* qu'Oriane essaie — la fiche formule compte les commandes et remplace le formulaire de tarif par l'explication et un bouton « Créer une nouvelle formule à partir de celle-ci ».

**Côté Stripe, un `price` est immuable aussi.** On ne modifie jamais un prix existant : on en crée un nouveau et on désactive l'ancien. Le nouveau prix est créé **avant** la désactivation de l'ancien, pour que la formule ne soit jamais ni à l'un ni à l'autre.

Ces deux règles se rejoignent sur une formule **jamais vendue** : là, le tarif est encore corrigeable. La base l'autorise (aucune commande), et Stripe reçoit un nouveau `price` sur le **même produit** — c'est la même formule, au même nom. Dès la première vente, cette porte se ferme des deux côtés.

Le nom et l'argumentaire, eux, restent modifiables à vie : le produit Stripe est renommé en conséquence. Seul le prix est gravé.

### Règle 3, imposée dans le code

Un abonnement se prélève **toutes les 4 semaines**. Une seule fonction du code fabrique une récurrence Stripe, et elle ne sait produire que `interval: "week", interval_count: 4`. Une assertion la suit, pour qu'une modification future échoue bruyamment au lieu de créer un prélèvement mensuel. Le serveur écrase la validité saisie dans le formulaire quand le type est `subscription` : il ne fait pas confiance à l'interface.

### Une formule sans `stripe_price_id` n'est pas achetable

C'est l'état des 6 formules du seed 0006, et de toute formule dont la publication a échoué. Il se voit à trois endroits : une pastille ambre sur la ligne, un bandeau en tête de liste qui les nomme, et — la vraie protection — **la vitrine ne doit jamais proposer à l'achat une formule dans cet état**. Utilise `estAchetable()`, jamais `is_active` seul.

La synchronisation du seed vers Stripe passe par le bouton « Publier sur Stripe » de chaque ligne, pas par un script. Le chemin de code est le même que celui de la création, donc éprouvé en permanence, et Oriane peut rattraper elle-même un échec.

### Retirer de la vente, archiver

`is_active = false` retire de la vitrine et se défait. `archived_at` est définitif. Dans les deux cas le produit Stripe suit, et dans les deux cas les clientes qui ont acheté gardent leurs séances. La base est écrite **en premier** : c'est elle qui décide ce que la vitrine affiche. Si Stripe ne suit pas, la formule est déjà retirée de la vente et le message le dit.

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

## Contraintes de base de données à ne jamais oublier

**`select('*')` est interdit sur `profiles` et sur `courses`.** Ces deux tables portent une colonne `admin_notes` qui ne doit être lisible ni par une visiteuse, ni par la cliente concernée. La RLS ne sait pas raisonner par colonne : la protection vient d'un `GRANT` colonne par colonne, et le `SELECT` de table a été révoqué. Une requête qui demande `*` échoue. Énumère toujours les colonnes. Oriane lit et écrit ces notes par les RPC `admin_client_notes` / `admin_course_notes`.

**Toute nouvelle table dans `public` doit activer la RLS et révoquer les privilèges par défaut.** Supabase accorde automatiquement tous les verbes à `anon` et `authenticated` sur les tables du schéma `public`, et une table sans RLS y est immédiatement exposée par PostgREST. Deux gestes obligatoires dans la migration qui la crée : `alter table … enable row level security`, puis `revoke insert, update, delete … from anon, authenticated`. Ensuite seulement, on ouvre policy par policy.

**Ne jamais activer `FORCE ROW LEVEL SECURITY`.** `is_admin()` et tous les RPC sont en `SECURITY DEFINER` et reposent sur le fait que le propriétaire des tables contourne la RLS. `FORCE` le soumettrait à son tour : `is_admin()` ne verrait plus rien et toute l'administration se fermerait d'un coup.

**Une anonymisation RGPD n'est pas finie tant que `auth.users` n'a pas été traité.** `anonymize_profile()` ne touche que la table `profiles` : elle y remplace nom, prénom, téléphone, notes et email, et conserve l'`id` parce qu'une commande payée ne s'efface pas. L'email d'origine reste dans `auth.users`, hors de portée d'une fonction Postgres sans rendre le schéma fragile à chaque montée de version Supabase. La route serveur **doit** enchaîner sur l'Admin API : substitution de l'email et bannissement du compte. Une anonymisation à moitié faite est pire que pas d'anonymisation — elle donne la conviction d'avoir effacé ce qui est toujours là.

**Toute nouvelle fonction doit révoquer `EXECUTE` à quatre rôles, puis le réaccorder nommément.** Deux mécanismes se cumulent. Postgres accorde `EXECUTE` à `PUBLIC` par défaut, et Supabase configure en plus le schéma `public` avec un `alter default privileges … grant all on functions to postgres, anon, authenticated, service_role` : chaque fonction créée reçoit donc un `GRANT` **nominatif** à ces trois rôles, qui survit à la révocation faite à `PUBLIC`. Révoquer à `PUBLIC` seul ne suffit pas. Le geste obligatoire est `revoke execute on all functions in schema public from public, anon, authenticated, service_role`, puis un `grant execute` explicite au seul rôle concerné. Une fonction `SECURITY DEFINER` oubliée est appelable avec les droits du propriétaire : c'est ainsi qu'on se fait créditer des séances sans payer. Les fonctions Stripe et cron ne vont jamais à `authenticated`.

**Devenir admin ne passe pas par l'application, et c'est voulu.** `profiles.role` n'est modifiable ni par une policy ni par un RPC : `authenticated` n'a le droit d'écrire que `first_name`, `last_name` et `phone`. Personne ne peut se promouvoir, pas même Oriane. La promotion se fait une fois, à la main, dans le SQL Editor :

```sql
update public.profiles set role = 'admin' where email = 'adresse@exemple.fr';
```

Le compte doit exister au préalable — donc s'être inscrit par `/inscription`. C'est le seul geste d'administration qui reste hors de l'application.


**Un horaire de cours se compose avec l'offset `-04:00`, jamais avec un `Date` local.** La Guadeloupe est à UTC−4 toute l'année, sans changement d'heure. Quand Oriane saisit « 18:30 », l'instant exact est `new Date("2026-09-09T18:30:00-04:00")` — construire un `Date` à partir de la saisie donnerait le fuseau du serveur, c'est-à-dire celui de Vercel, pas le sien. Même règle pour une répétition hebdomadaire : on ajoute 7 jours à la **date calendaire** puis on recompose l'instant, plutôt que d'ajouter 604 800 000 ms. `src/lib/planning/dates.ts` est le seul endroit qui fabrique ces instants.


## Hors périmètre (devis complémentaire)

Liste d'attente, SMS, application mobile native, comptabilité, gestion de plusieurs intervenantes, maintenance. Si le besoin surgit, signale-le, ne l'implémente pas.