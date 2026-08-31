-- Revert 0003. Aucun impact fonctionnel : ce fichier ne contenait que du reglage.

drop index if exists public.audit_log_created_idx;
drop index if exists public.audit_log_entity_idx;
drop index if exists public.email_log_user_idx;
drop index if exists public.stripe_events_unprocessed_idx;
drop index if exists public.credit_movements_lot_idx;
drop index if exists public.credit_movements_user_idx;
drop index if exists public.bookings_credit_lot_idx;
drop index if exists public.bookings_course_idx;
drop index if exists public.bookings_user_idx;
drop index if exists public.courses_recurrence_idx;
drop index if exists public.courses_location_starts_idx;
drop index if exists public.courses_planning_idx;
drop index if exists public.credit_lots_user_history_idx;
drop index if exists public.credit_lots_order_idx;
drop index if exists public.credit_lots_subscription_open_idx;
drop index if exists public.credit_lots_expiry_sweep_idx;
drop index if exists public.credit_lots_consumption_idx;
drop index if exists public.orders_subscription_idx;
drop index if exists public.orders_paid_idx;
drop index if exists public.orders_user_idx;
drop index if exists public.subscriptions_user_idx;
drop index if exists public.profiles_email_idx;
drop index if exists public.profiles_search_trgm_idx;
