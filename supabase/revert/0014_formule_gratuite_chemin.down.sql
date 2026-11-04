-- =============================================================================
-- REVERT 0014 — DESTRUCTIF SI DES INSCRIPTIONS OFFERTES EXISTENT
-- =============================================================================
--
-- Remet `credit_order` dans son etat de 0005, supprime le RPC gratuit, l'index
-- d'unicite, et la branche 'offert' du CHECK.
--
-- LE DERNIER POINT EST LE PIEGE : si des lots `offert` existent deja, le CHECK
-- d'origine les refusera et la migration echouera — ce qui est le bon
-- comportement. Il faut d'abord decider quoi en faire. Pour savoir :
--
--   select count(*) from public.credit_lots where origin = 'offert';
--
-- Les commandes `kind = 'free'` et les mouvements du grand livre ne sont PAS
-- defaits : une seance offerte a ete offerte, et le grand livre est en ajout
-- seul.
--
-- A jouer AVANT 0013.down.

drop function if exists public.prendre_formule_offerte(text);

drop index if exists public.orders_une_seule_gratuite_par_formule;

alter table public.credit_lots
  drop constraint if exists credit_lots_origin_shape;

alter table public.credit_lots
  add constraint credit_lots_origin_shape check (
    case origin
      when 'order' then
        order_id is not null and plan_id is not null and subscription_id is null
      when 'subscription_cycle' then
        subscription_id is not null and plan_id is not null
      when 'admin_grant' then
        granted_by is not null and reason is not null
        and order_id is null and subscription_id is null
    end
  );

-- credit_order revient a la version de 0005 : toute commande non recurrente
-- donne un lot `order`.
create or replace function public.credit_order(p_order_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_order   public.orders%rowtype;
  v_plan    public.plans%rowtype;
  v_lot_id  uuid;
  v_expires timestamptz;
  v_old     record;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'Commande introuvable.' using errcode = 'SB008';
  end if;
  if v_order.status <> 'paid' then
    raise exception 'Commande non payee : rien a crediter.' using errcode = 'SB011';
  end if;

  select id into v_lot_id from public.credit_lots where order_id = p_order_id limit 1;
  if v_lot_id is not null then
    return v_lot_id;
  end if;

  select * into v_plan from public.plans where id = v_order.plan_id;

  if v_order.kind = 'subscription_cycle' then
    for v_old in
      select id, user_id, quantity_remaining
        from public.credit_lots
       where subscription_id = v_order.subscription_id
         and closed_at is null
       for update
    loop
      if v_old.quantity_remaining > 0 then
        insert into public.credit_movements (user_id, credit_lot_id, delta, reason, order_id)
        values (v_old.user_id, v_old.id, -v_old.quantity_remaining, 'subscription_reset', p_order_id);
      end if;
      update public.credit_lots
         set quantity_remaining = 0, closed_at = now(), close_reason = 'superseded'
       where id = v_old.id;
    end loop;

    select current_period_end into v_expires
      from public.subscriptions where id = v_order.subscription_id;
    v_expires := coalesce(v_expires, now() + v_plan.validity_interval);

    insert into public.credit_lots (
      user_id, plan_id, origin, order_id, subscription_id,
      quantity_initial, quantity_remaining, expires_at
    )
    values (
      v_order.user_id, v_order.plan_id, 'subscription_cycle', p_order_id, v_order.subscription_id,
      v_plan.sessions_count, v_plan.sessions_count, v_expires
    )
    returning id into v_lot_id;

    update public.subscriptions
       set payment_failed_at = null, dunning_exhausted_at = null
     where id = v_order.subscription_id;

  else
    insert into public.credit_lots (
      user_id, plan_id, origin, order_id,
      quantity_initial, quantity_remaining, expires_at
    )
    values (
      v_order.user_id, v_order.plan_id, 'order', p_order_id,
      v_plan.sessions_count, v_plan.sessions_count, now() + v_plan.validity_interval
    )
    returning id into v_lot_id;
  end if;

  insert into public.credit_movements (user_id, credit_lot_id, delta, reason, order_id)
  values (v_order.user_id, v_lot_id, v_plan.sessions_count, 'grant', p_order_id);

  return v_lot_id;
end;
$$;

revoke execute on function public.credit_order(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.credit_order(uuid) to service_role;
