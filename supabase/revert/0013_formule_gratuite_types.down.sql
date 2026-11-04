-- =============================================================================
-- REVERT 0013 — PARTIEL, ET C'EST ASSUME
-- =============================================================================
--
-- Postgres ne sait pas retirer une valeur d'un enum : il faudrait reconstruire
-- le type entier et reecrire toutes les colonnes qui l'utilisent — dont
-- `orders` et `credit_lots`, qui portent de l'argent et des seances. On ne
-- fait pas ca pour deux valeurs inutilisees, qui ne coutent rien.
--
-- Ce fichier remet donc la seule chose qui compte : l'interdiction du prix
-- zero. Il ECHOUERA si une formule gratuite existe deja — ce qui est le bon
-- comportement, il faut d'abord decider quoi en faire.
--
-- Pour savoir avant d'essayer :
--   select id, slug, name from public.plans where price_cents = 0;

alter table public.plans
  drop constraint if exists plans_gratuite_non_recurrente;

alter table public.plans
  drop constraint if exists plans_price_non_negative;

alter table public.plans
  add constraint plans_price_positive check (price_cents > 0);
