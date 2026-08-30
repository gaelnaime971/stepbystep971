-- Revert 0001. A jouer apres 0002.down.sql.

drop type if exists public.email_template;
drop type if exists public.promo_duration;
drop type if exists public.promo_discount_type;
drop type if exists public.order_status;
drop type if exists public.order_kind;
drop type if exists public.booking_status;
drop type if exists public.course_status;
drop type if exists public.credit_reason;
drop type if exists public.lot_close_reason;
drop type if exists public.lot_origin;
drop type if exists public.plan_kind;
drop type if exists public.user_role;

-- Volontairement non supprimees : d'autres schemas Supabase peuvent en dependre.
-- drop extension if exists pg_trgm;
-- drop extension if exists citext;
