-- Totaux. Attendu : index_0003 = 23.
select
  (select count(*)::int from pg_indexes
    where schemaname = 'public' and indexname like '%_idx')  as index_0003,
  (select count(*)::int from pg_indexes
    where schemaname = 'public')                             as index_tous;
-- index_tous inclut les cles primaires, les contraintes UNIQUE de 0002 et les
-- 4 index uniques partiels : ce total n'a pas de valeur attendue simple, il est
-- la pour l'oeil.
