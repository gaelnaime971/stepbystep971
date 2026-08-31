-- ---------------------------------------------------------------------------
-- 2. Triggers. Attendu : 10 lignes « ok ».
-- ---------------------------------------------------------------------------

with attendu (trg, tbl, fonction) as (values
  ('on_auth_user_created',        'users',         'handle_new_user'),
  ('on_auth_user_email_changed',  'users',         'sync_profile_email'),
  ('plans_guard_immutable_trg',   'plans',         'plans_guard_immutable'),
  ('bookings_sync_seats_trg',     'bookings',      'bookings_sync_seats'),
  ('courses_guard_capacity_trg',  'courses',       'courses_guard_capacity'),
  ('profiles_set_updated_at',     'profiles',      'set_updated_at'),
  ('plans_set_updated_at',        'plans',         'set_updated_at'),
  ('subscriptions_set_updated_at','subscriptions', 'set_updated_at'),
  ('orders_set_updated_at',       'orders',        'set_updated_at'),
  ('courses_set_updated_at',      'courses',       'set_updated_at')
),
reel as (
  select t.tgname::text as trg,
         c.relname::text as tbl,
         p.proname::text as fonction,
         n.nspname::text as schema,
         t.tgenabled
  from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
  join pg_namespace n on n.oid = c.relnamespace
  join pg_proc p on p.oid = t.tgfoid
  where not t.tgisinternal
    and n.nspname in ('public', 'auth')
),
juge as (
  select
    coalesce(a.trg, r.trg) as trigger_name,
    r.schema, r.tbl, r.fonction,
    case
      when r.trg is null           then 'MANQUANT'
      when a.trg is null           then 'INATTENDU sur ' || r.schema || '.' || r.tbl
      when r.tbl <> a.tbl          then 'TABLE ' || r.tbl || ' au lieu de ' || a.tbl
      when r.fonction <> a.fonction then 'FONCTION ' || r.fonction || ' au lieu de ' || a.fonction
      when r.tgenabled <> 'O'      then 'DESACTIVE'
      else 'ok'
    end as verdict
  from attendu a
  full join reel r on r.trg = a.trg
)
select * from juge order by (verdict = 'ok'), trigger_name;
