-- Revert 0005. Les triggers tombent avec leurs fonctions (CASCADE explicite
-- sur les deux fonctions de trigger attachees a auth.users, que DROP FUNCTION
-- ne peut pas retirer autrement).

drop trigger if exists on_auth_user_created       on auth.users;
drop trigger if exists on_auth_user_email_changed on auth.users;
drop trigger if exists plans_guard_immutable_trg  on public.plans;
drop trigger if exists bookings_sync_seats_trg    on public.bookings;
drop trigger if exists courses_guard_capacity_trg on public.courses;
drop trigger if exists profiles_set_updated_at      on public.profiles;
drop trigger if exists plans_set_updated_at         on public.plans;
drop trigger if exists subscriptions_set_updated_at on public.subscriptions;
drop trigger if exists orders_set_updated_at        on public.orders;
drop trigger if exists courses_set_updated_at       on public.courses;

drop function if exists public.lots_expiring_soon(integer);
drop function if exists public.expire_credit_lots();
drop function if exists public.apply_subscription_payment_failed(uuid, text, boolean);
drop function if exists public.revoke_order_credits(uuid, text);
drop function if exists public.credit_order(uuid);
drop function if exists public.admin_mirror_promo_code(
  text, text, text, text, public.promo_discount_type, numeric, integer, text,
  public.promo_duration, integer, integer, uuid[], timestamptz);
drop function if exists public.anonymize_profile(uuid);
drop function if exists public.admin_set_course_notes(uuid, text);
drop function if exists public.admin_course_notes(uuid);
drop function if exists public.admin_set_client_notes(uuid, text);
drop function if exists public.admin_client_notes(uuid);
drop function if exists public.admin_revoke_credits(uuid, integer, text);
drop function if exists public.admin_revoke_credits_from_lot(uuid, integer, text);
drop function if exists public.admin_grant_credits(uuid, integer, timestamptz, text);
drop function if exists public.admin_unbook(uuid, boolean, text);
drop function if exists public.cancel_course(uuid, text);
drop function if exists public.cancel_booking(uuid);
drop function if exists public.book_course(uuid);
drop function if exists public.bookings_sync_seats();
drop function if exists public.plans_guard_immutable();
drop function if exists public.courses_guard_capacity();
drop function if exists public.sync_profile_email();
drop function if exists public.handle_new_user();
drop function if exists public.log_audit(text, text, uuid, jsonb, jsonb);
drop function if exists public.set_updated_at();

-- is_admin() appartient a 0004 : elle survit a ce revert, et les 24 policies
-- avec elle. Ne la supprimer qu'en jouant 0004.down.sql.
--
-- ATTENTION : apres ce revert, seat_taken n'est plus maintenu et le grand livre
-- n'est plus alimente. Ne pas s'arreter dans cet etat si des donnees existent.
