-- Revert 0004.
-- ATTENTION : ce revert ROUVRE la base. Apres l'avoir joue, les 13 tables ont
-- la RLS active sans aucune policy, donc tout est refuse a anon et
-- authenticated — la base est fermee, pas ouverte. Mais les GRANT larges de
-- Supabase sont restaures : ne pas s'arreter dans cet etat en production.

drop policy if exists audit_log_admin_select              on public.audit_log;
drop policy if exists email_log_admin_select              on public.email_log;
drop policy if exists stripe_events_admin_select          on public.stripe_events;
drop policy if exists promo_codes_admin_update            on public.promo_codes;
drop policy if exists promo_codes_admin_select            on public.promo_codes;
drop policy if exists subscriptions_select_own_or_admin   on public.subscriptions;
drop policy if exists orders_select_own_or_admin          on public.orders;
drop policy if exists credit_movements_select_own_or_admin on public.credit_movements;
drop policy if exists credit_lots_select_own_or_admin     on public.credit_lots;
drop policy if exists bookings_select_own_or_admin        on public.bookings;
drop policy if exists courses_admin_delete                on public.courses;
drop policy if exists courses_admin_update                on public.courses;
drop policy if exists courses_admin_insert                on public.courses;
drop policy if exists courses_select_all                  on public.courses;
drop policy if exists plans_admin_update                  on public.plans;
drop policy if exists plans_admin_insert                  on public.plans;
drop policy if exists plans_select_own_history            on public.plans;
drop policy if exists plans_select_active                 on public.plans;
drop policy if exists locations_admin_update              on public.locations;
drop policy if exists locations_admin_insert              on public.locations;
drop policy if exists locations_select_all                on public.locations;
drop policy if exists profiles_update_admin               on public.profiles;
drop policy if exists profiles_update_self                on public.profiles;
drop policy if exists profiles_select_self_or_admin       on public.profiles;

drop function if exists public.is_admin();

-- Restauration des privileges par defaut de Supabase.
grant all on all tables in schema public to anon, authenticated;
