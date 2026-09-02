# Requêtes de vérification

Une requête par fichier : l'éditeur SQL de Supabase n'affiche que le résultat
de la dernière instruction d'un buffer, donc un fichier multi-requêtes cache
tout sauf sa fin.

Ordre : après avoir joué `migrations/000N`, lance les fichiers de `checks/000N`
dans l'ordre de leur numéro.

| Dossier | Fichiers | Ce qui doit sortir |
|---|---|---|
| `0001` | 3 | 2 extensions dans `extensions`, 12 types, 42 valeurs |
| `0002` | 4 | 13 tables `ok`, 13 RLS, 0 policy, 48 CHECK, 31 FK, 1 exclusion, 4 index partiels |
| `0003` | 4 | 23 index `ok`, aucun index invalide |
| `0004` | 4 | 24 policies `ok`, 18 assertions `ok` |
| `0005` | 6 | 26 fonctions `ok`, 10 triggers `ok`, 9 assertions `ok` |
| `0006` | 3 | 3 lieux `ok`, 6 formules `ok`, 2 abonnements à 28 jours |
| `0007` | 3 | 6 contrôles `ok`, tous les cours existants sans niveau, lecture cliente qui passe |

Les fichiers `1_…` et `2_…` rendent un verdict par ligne : tout doit dire `ok`,
et le tri met les problèmes en tête. Les fichiers suivants sont du détail à
parcourir des yeux, ou du diagnostic à lancer quand une assertion tombe.
