-- 3. Verdict chiffre.
select
  (select count(*) from pg_extension e
     join pg_namespace n on n.oid = e.extnamespace
    where e.extname in ('citext','pg_trgm') and n.nspname = 'extensions')::int as extensions_ok,
  (select count(*) from pg_type t
     join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typtype = 'e')::int as types,
  (select count(*) from pg_enum l
     join pg_type t on t.oid = l.enumtypid
     join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public')::int as valeurs_totales;
-- Attendu : extensions_ok = 2, types = 12, valeurs_totales = 42.
