-- ---------------------------------------------------------------------------
-- 2. Assertions de securite. Attendu : 18 lignes « ok », echecs en tete.
-- ---------------------------------------------------------------------------

with pol as (
  select c.relname::text as t, p.polcmd
  from pg_policy p
  join pg_class c on c.oid = p.polrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
),
tbl as (
  select c.oid, c.relname::text as t, c.relrowsecurity, c.relforcerowsecurity
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
),
fn as (
  select p.prosecdef, p.provolatile, p.proconfig
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'is_admin'
),
m as (
  select
    (select count(*) from pol where t = 'bookings'
       and polcmd in ('a','w','d','*'))                              as bookings_write_pol,
    (select count(*) from pol where t = 'credit_movements'
       and polcmd in ('w','d','*'))                                  as cm_wd_pol,
    (select count(*) from pol where t = 'credit_movements'
       and polcmd in ('a','*'))                                      as cm_ins_pol,
    (select count(*) from pol where t = 'credit_lots'
       and polcmd in ('a','w','d','*'))                              as cl_write_pol,
    (select count(*) from pol
      where t in ('orders','subscriptions','stripe_events','email_log','audit_log')
        and polcmd in ('a','w','d','*'))                             as journaux_write_pol,
    (select count(*) from tbl
      where has_table_privilege('anon', oid, 'insert')
         or has_table_privilege('anon', oid, 'update')
         or has_table_privilege('anon', oid, 'delete'))              as anon_write_tables,
    (select count(*) from tbl)                                       as nb_tables,
    (select count(*) from tbl where not relrowsecurity)              as rls_off,
    (select count(*) from tbl where relforcerowsecurity)             as rls_forced,
    (select count(*) from fn)                                        as fn_count,
    (select bool_and(prosecdef) from fn)                             as fn_secdef,
    (select bool_and(provolatile = 's') from fn)                     as fn_stable,
    (select bool_and(proconfig is not null and exists (
        select 1 from unnest(proconfig) cfg where left(cfg, 12) = 'search_path='))
       from fn)                                                      as fn_searchpath
),
a as (
  select 1 as n,
    'bookings : aucune policy INSERT / UPDATE / DELETE' as assertion,
    case when bookings_write_pol = 0 then 'ok'
         else 'ECHEC — ' || bookings_write_pol || ' policy d''ecriture' end as verdict
  from m
  union all select 2,
    'bookings : authenticated sans privilege INSERT',
    case when not has_table_privilege('authenticated','public.bookings','insert')
         then 'ok' else 'ECHEC — privilege INSERT accorde' end from m
  union all select 3,
    'bookings : authenticated sans privilege DELETE',
    case when not has_table_privilege('authenticated','public.bookings','delete')
         then 'ok' else 'ECHEC — privilege DELETE accorde' end from m
  union all select 4,
    'bookings : authenticated sans privilege UPDATE',
    case when not has_table_privilege('authenticated','public.bookings','update')
         then 'ok' else 'ECHEC — privilege UPDATE accorde' end from m
  union all select 5,
    'credit_movements : aucune policy UPDATE ni DELETE, pour personne',
    case when cm_wd_pol = 0 then 'ok'
         else 'ECHEC — ' || cm_wd_pol || ' policy UPDATE/DELETE' end from m
  union all select 6,
    'credit_movements : aucun privilege UPDATE / DELETE pour anon ni authenticated',
    case when not (has_table_privilege('anon','public.credit_movements','update')
                or has_table_privilege('anon','public.credit_movements','delete')
                or has_table_privilege('authenticated','public.credit_movements','update')
                or has_table_privilege('authenticated','public.credit_movements','delete'))
         then 'ok' else 'ECHEC — le grand livre est modifiable' end from m
  union all select 7,
    'credit_movements : aucune policy INSERT (les mouvements naissent dans les RPC)',
    case when cm_ins_pol = 0 then 'ok' else 'ECHEC' end from m
  union all select 8,
    'credit_lots : aucune policy d''ecriture',
    case when cl_write_pol = 0 then 'ok'
         else 'ECHEC — ' || cl_write_pol || ' policy d''ecriture' end from m
  union all select 9,
    'orders / subscriptions / stripe_events / email_log / audit_log : lecture seule',
    case when journaux_write_pol = 0 then 'ok'
         else 'ECHEC — ' || journaux_write_pol || ' policy d''ecriture' end from m
  union all select 10,
    'anon : aucun privilege d''ecriture sur aucune table',
    case when anon_write_tables = 0 then 'ok'
         else 'ECHEC — ' || anon_write_tables || ' table(s) ecrivables par anon' end from m
  union all select 11,
    'profiles : anon ne lit rien',
    case when not has_table_privilege('anon','public.profiles','select')
          and not has_column_privilege('anon','public.profiles','email','select')
         then 'ok' else 'ECHEC — anon lit profiles' end from m
  union all select 12,
    'profiles.admin_notes : illisible par anon et par authenticated',
    case when not has_column_privilege('anon','public.profiles','admin_notes','select')
          and not has_column_privilege('authenticated','public.profiles','admin_notes','select')
         then 'ok' else 'ECHEC — les notes privees fuient' end from m
  union all select 13,
    'courses.admin_notes : illisible par anon et par authenticated',
    case when not has_column_privilege('anon','public.courses','admin_notes','select')
          and not has_column_privilege('authenticated','public.courses','admin_notes','select')
         then 'ok' else 'ECHEC — les notes privees fuient' end from m
  union all select 14,
    'profiles.role : non modifiable par authenticated',
    case when not has_column_privilege('authenticated','public.profiles','role','update')
         then 'ok' else 'ECHEC — une cliente peut se promouvoir admin' end from m
  union all select 15,
    'plans et locations : aucun DELETE possible (regle 10, historique des lieux)',
    case when not (has_table_privilege('authenticated','public.plans','delete')
                or has_table_privilege('authenticated','public.locations','delete')
                or has_table_privilege('anon','public.plans','delete')
                or has_table_privilege('anon','public.locations','delete'))
         then 'ok' else 'ECHEC — suppression possible' end from m
  union all select 16,
    'RLS active sur les 13 tables, FORCE sur aucune',
    case when rls_off > 0
           then 'ECHEC — RLS absente sur ' || rls_off || ' table(s)'
         when rls_forced > 0
           then 'ECHEC — FORCE RLS active : is_admin() et les RPC sont casses'
         when nb_tables <> 13
           then 'ECHEC — ' || nb_tables || ' tables au lieu de 13'
         else 'ok' end from m
  union all select 17,
    'is_admin() : SECURITY DEFINER, STABLE, search_path fige',
    case when fn_count = 0        then 'ECHEC — fonction absente'
         when not fn_secdef       then 'ECHEC — pas SECURITY DEFINER'
         when not fn_stable       then 'ECHEC — pas STABLE'
         when not fn_searchpath   then 'ECHEC — search_path non fige'
         else 'ok' end from m
  union all select 18,
    'contre-epreuve : la cliente lit son profil et modifie son prenom, anon voit les places',
    case when has_column_privilege('authenticated','public.profiles','first_name','select')
          and has_column_privilege('authenticated','public.profiles','first_name','update')
          and has_column_privilege('anon','public.courses','seats_taken','select')
          and has_table_privilege('anon','public.locations','select')
         then 'ok'
         else 'ECHEC — l''application ne peut plus lire ce dont elle a besoin' end from m
)
select * from a order by (verdict = 'ok'), n;
