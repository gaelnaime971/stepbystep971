-- Verification apres 0003. Attendu : 23 lignes « ok », total 23.

with attendu (indexname) as (values
  ('profiles_search_trgm_idx'),
  ('profiles_email_idx'),
  ('subscriptions_user_idx'),
  ('orders_user_idx'),
  ('orders_paid_idx'),
  ('orders_subscription_idx'),
  ('credit_lots_consumption_idx'),
  ('credit_lots_expiry_sweep_idx'),
  ('credit_lots_subscription_open_idx'),
  ('credit_lots_order_idx'),
  ('credit_lots_user_history_idx'),
  ('courses_planning_idx'),
  ('courses_location_starts_idx'),
  ('courses_recurrence_idx'),
  ('bookings_user_idx'),
  ('bookings_course_idx'),
  ('bookings_credit_lot_idx'),
  ('credit_movements_user_idx'),
  ('credit_movements_lot_idx'),
  ('stripe_events_unprocessed_idx'),
  ('email_log_user_idx'),
  ('audit_log_entity_idx'),
  ('audit_log_created_idx')
),
reel as (
  select indexname::text, tablename::text, indexdef
  from pg_indexes
  where schemaname = 'public'
)
select
  coalesce(a.indexname, r.indexname) as index_name,
  r.tablename,
  case when r.indexname is null then 'MANQUANT' else 'ok' end as verdict,
  r.indexdef
from attendu a
left join reel r on r.indexname = a.indexname
order by (r.indexname is not null), coalesce(a.indexname, r.indexname);
