-- ---------------------------------------------------------------------------
-- 3. Assertions de securite. Attendu : 9 lignes « ok », echecs en tete.
-- ---------------------------------------------------------------------------

with f as (
  select p.oid, p.proname::text as fname, p.prosecdef, p.proconfig, p.proacl
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
),
m as (
  select
    (select count(*) from f)                                        as nb_fonctions,
    (select count(*) from f where prosecdef
       and (proconfig is null or not exists (
         select 1 from unnest(proconfig) cfg where left(cfg, 12) = 'search_path=')))
                                                                    as secdef_sans_searchpath,
    (select count(*) from f
      where has_function_privilege('anon', oid, 'execute')
        and fname <> 'is_admin')                                    as anon_execute_hors_is_admin,
    (select count(*) from f
      where has_function_privilege('authenticated', oid, 'execute')) as auth_execute,
    (select count(*) from f
      where has_function_privilege('service_role', oid, 'execute'))  as service_execute,
    (select count(*) from f
      where fname in ('credit_order','revoke_order_credits',
                      'apply_subscription_payment_failed','expire_credit_lots',
                      'lots_expiring_soon')
        and (has_function_privilege('authenticated', oid, 'execute')
          or has_function_privilege('anon', oid, 'execute')))        as stripe_exposees,
    (select count(*) from f
      where fname in ('log_audit','set_updated_at')
        and (has_function_privilege('authenticated', oid, 'execute')
          or has_function_privilege('anon', oid, 'execute')))        as internes_exposees,
    (select count(*) from f
      where has_function_privilege('service_role', oid, 'execute')
        and fname not in ('credit_order','revoke_order_credits',
                          'apply_subscription_payment_failed','expire_credit_lots',
                          'lots_expiring_soon'))                     as service_hors_stripe,
    -- Attention au cas NULL : une proacl vide ne signifie pas « aucun droit »
    -- mais « droits par defaut », et le defaut d'une FONCTION inclut EXECUTE
    -- pour PUBLIC. Une fonction sans ACL est donc grande ouverte.
    (select count(*) from f
      where proacl is null
         or exists (select 1 from unnest(proacl) ac where ac::text like '=%'))
                                                                     as executables_par_public
),
a as (
  select 1 as n,
    'les 26 fonctions attendues sont presentes' as assertion,
    case when nb_fonctions = 26 then 'ok'
         else 'ECHEC — ' || nb_fonctions || ' fonctions au lieu de 26' end as verdict
  from m
  union all select 2,
    'toute SECURITY DEFINER a un search_path fige',
    case when secdef_sans_searchpath = 0 then 'ok'
         else 'ECHEC — ' || secdef_sans_searchpath || ' fonction(s) sans search_path' end from m
  union all select 3,
    'anon n''execute que is_admin()',
    case when anon_execute_hors_is_admin = 0 then 'ok'
         else 'ECHEC — anon peut appeler ' || anon_execute_hors_is_admin || ' autre(s) fonction(s)' end from m
  union all select 4,
    'authenticated execute exactement 14 fonctions',
    case when auth_execute = 14 then 'ok'
         else 'ECHEC — ' || auth_execute || ' au lieu de 14' end from m
  union all select 5,
    'service_role n''execute QUE les 5 fonctions Stripe et cron',
    case when service_hors_stripe > 0
           then 'ECHEC — ' || service_hors_stripe || ' fonction(s) hors Stripe/cron (revocation a service_role oubliee : les privileges par defaut de Supabase accordent EXECUTE nominativement, revoquer a PUBLIC ne suffit pas)'
         when service_execute <> 5
           then 'ECHEC — ' || service_execute || ' fonctions Stripe/cron au lieu de 5'
         else 'ok' end from m
  union all select 6,
    'AUCUNE fonction Stripe/cron n''est appelable depuis le navigateur',
    case when stripe_exposees = 0 then 'ok'
         else 'ECHEC — ' || stripe_exposees || ' fonction(s) qui creditent sans verifier de paiement sont exposees' end from m
  union all select 7,
    'log_audit et set_updated_at ne sont appelables par personne',
    case when internes_exposees = 0 then 'ok'
         else 'ECHEC — le journal d''audit est ecrivable directement' end from m
  union all select 8,
    'contre-epreuve : la cliente peut bien appeler book_course et cancel_booking',
    case when has_function_privilege('authenticated', 'public.book_course(uuid)', 'execute')
          and has_function_privilege('authenticated', 'public.cancel_booking(uuid)', 'execute')
         then 'ok' else 'ECHEC — plus personne ne peut reserver' end from m
  union all select 9,
    'aucune fonction n''est executable par PUBLIC',
    case when executables_par_public = 0 then 'ok'
         else 'ECHEC — ' || executables_par_public || ' fonction(s) ouvertes a PUBLIC (ACL vide = droits par defaut = EXECUTE pour PUBLIC)' end from m
)
select * from a order by (verdict = 'ok'), n;
