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


-- L'index de consommation, celui qui porte les regles 4 et 5, en detail.
-- Attendu : colonnes (user_id, expires_at, issued_at),
--           predicat (quantity_remaining > 0 AND closed_at IS NULL).
select indexdef
from pg_indexes
where schemaname = 'public' and indexname = 'credit_lots_consumption_idx';


-- Totaux. Attendu : index_0003 = 23.
select
  (select count(*)::int from pg_indexes
    where schemaname = 'public' and indexname like '%_idx')  as index_0003,
  (select count(*)::int from pg_indexes
    where schemaname = 'public')                             as index_tous;
-- index_tous inclut les cles primaires, les contraintes UNIQUE de 0002 et les
-- 4 index uniques partiels : ce total n'a pas de valeur attendue simple, il est
-- la pour l'oeil.


-- Aucun index invalide (un CREATE INDEX interrompu en laisse un derriere lui).
-- Attendu : 0 ligne.
select c.relname as index_invalide
from pg_index i
join pg_class c on c.oid = i.indexrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and not i.indisvalid;
