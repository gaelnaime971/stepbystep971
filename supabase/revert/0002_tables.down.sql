-- Revert 0002. A jouer avant 0001.down.sql.
-- Ordre inverse des dependances ; CASCADE non utilise volontairement, pour que
-- toute dependance oubliee fasse echouer le revert au lieu de detruire en silence.

drop table if exists public.audit_log;
drop table if exists public.email_log;
drop table if exists public.stripe_events;
drop table if exists public.credit_movements;
drop table if exists public.bookings;
drop table if exists public.courses;
drop table if exists public.credit_lots;
drop table if exists public.orders;
drop table if exists public.subscriptions;
drop table if exists public.promo_codes;
drop table if exists public.plans;
drop table if exists public.locations;
drop table if exists public.profiles;
