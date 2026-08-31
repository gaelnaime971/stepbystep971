-- Totaux. Attendu : 13 / 13 / 0 / 48 / 31 / 1 / 4.
select
  count(*)::int                                             as tables,
  count(*) filter (where c.relrowsecurity)::int             as rls_actives,
  (select count(*)::int from pg_policy p
     join pg_class pc on pc.oid = p.polrelid
     join pg_namespace pn on pn.oid = pc.relnamespace
    where pn.nspname = 'public')                            as policies,
  (select count(*)::int from pg_constraint k
     join pg_class kc on kc.oid = k.conrelid
     join pg_namespace kn on kn.oid = kc.relnamespace
    where kn.nspname = 'public' and k.contype = 'c')        as checks,
  (select count(*)::int from pg_constraint k
     join pg_class kc on kc.oid = k.conrelid
     join pg_namespace kn on kn.oid = kc.relnamespace
    where kn.nspname = 'public' and k.contype = 'f')        as fks,
  (select count(*)::int from pg_constraint k
     join pg_class kc on kc.oid = k.conrelid
     join pg_namespace kn on kn.oid = kc.relnamespace
    where kn.nspname = 'public' and k.contype = 'x')        as exclusions,
  (select count(*)::int from pg_indexes
    where schemaname = 'public' and indexname in (
      'bookings_one_active_per_course',
      'email_log_one_expiry_warning_per_lot',
      'email_log_one_payment_failed_per_invoice',
      'email_log_one_ended_per_subscription'))              as index_partiels
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r';
