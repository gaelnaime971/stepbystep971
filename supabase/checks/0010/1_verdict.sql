-- ---------------------------------------------------------------------------
-- 0010 — la table, ses protections, ses droits. Attendu : neuf lignes « ok ».
--
-- On interroge has_table_privilege / has_function_privilege plutot que de lire
-- les ACL a la main : c'est ce qui a servi en 0005 et 0009, et cela repond a la
-- question qui compte — « ce role peut-il faire ca ? » — sans dependre de la
-- forme textuelle de l'ACL ni du cas NULL, qui veut dire « ouvert a PUBLIC ».
-- ---------------------------------------------------------------------------

with f as (
  select p.oid
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'accepter_charte'
),
m as (
  select
    (select count(*) from pg_tables
      where schemaname = 'public' and tablename = 'charte_acceptations')      as table_la,
    (select c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = 'charte_acceptations')        as rls,
    (select c.relforcerowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = 'charte_acceptations')        as force_rls,
    (select count(*) from pg_policies
      where schemaname = 'public' and tablename = 'charte_acceptations')       as policies,
    (select count(*) from pg_policies
      where schemaname = 'public' and tablename = 'charte_acceptations'
        and cmd in ('INSERT', 'UPDATE', 'DELETE'))                             as policies_ecriture,
    (select count(*) from pg_indexes
      where schemaname = 'public' and tablename = 'charte_acceptations'
        and indexname in ('charte_acceptations_user_idx',
                          'charte_acceptations_version_idx'))                  as index_la,
    (select count(*) from information_schema.columns
      where table_schema = 'public' and table_name = 'charte_acceptations'
        and column_name = 'autorisation_image'
        and is_nullable = 'NO' and column_default is null)                     as image_stricte,
    (select count(*) from f)                                                   as fonction_la,
    (select count(*) from f where has_function_privilege('authenticated', oid, 'execute'))
                                                                               as f_auth,
    (select count(*) from f where has_function_privilege('anon', oid, 'execute'))
                                                                               as f_anon,
    (select count(*) from f where has_function_privilege('service_role', oid, 'execute'))
                                                                               as f_service,
    (select count(*) from (values ('anon'), ('authenticated')) r(role)
      where has_table_privilege(r.role, 'public.charte_acceptations', 'INSERT')
         or has_table_privilege(r.role, 'public.charte_acceptations', 'UPDATE')
         or has_table_privilege(r.role, 'public.charte_acceptations', 'DELETE'))
                                                                               as ecriture_directe
)
select 1 as n, 'la table existe' as assertion,
       case when table_la = 1 then 'ok' else 'ECHEC — absente' end as verdict from m
union all select 2, 'la RLS est active',
       case when rls then 'ok' else 'ECHEC — table exposee par PostgREST' end from m
union all select 3,
       'FORCE ROW LEVEL SECURITY est bien DESACTIVE',
       case when not force_rls then 'ok'
            else 'ECHEC — FORCE fermerait is_admin() et toute l''administration' end from m
union all select 4, 'une seule policy, en lecture',
       case when policies = 1 and policies_ecriture = 0 then 'ok'
            else 'ECHEC — ' || policies || ' policy(ies), dont ' || policies_ecriture ||
                 ' en ecriture : la table doit rester en ajout seul' end from m
union all select 5, 'ni anon ni authenticated n''ecrivent en direct',
       case when ecriture_directe = 0 then 'ok'
            else 'ECHEC — ' || ecriture_directe || ' role(s) avec INSERT/UPDATE/DELETE' end from m
union all select 6, 'les deux index sont la',
       case when index_la = 2 then 'ok' else 'ECHEC — ' || index_la || '/2' end from m
union all select 7,
       'autorisation_image est NOT NULL et SANS DEFAUT',
       case when image_stricte = 1 then 'ok'
            else 'ECHEC — un defaut inventerait un consentement' end from m
union all select 8, 'la fonction accepter_charte existe',
       case when fonction_la = 1 then 'ok' else 'ECHEC — absente' end from m
union all select 9, 'seul authenticated peut l''appeler',
       case when f_auth = 1 and f_anon = 0 and f_service = 0 then 'ok'
            else 'ECHEC —' ||
                 case when f_auth = 0 then ' authenticated ne peut pas' else '' end ||
                 case when f_anon > 0 then ' anon peut' else '' end ||
                 case when f_service > 0 then ' service_role peut' else '' end ||
                 ' (revocation aux quatre roles oubliee : les privileges par defaut ' ||
                 'de Supabase accordent EXECUTE nominativement)' end from m
order by verdict desc, n;
