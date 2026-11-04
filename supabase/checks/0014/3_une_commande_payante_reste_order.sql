-- ---------------------------------------------------------------------------
-- 0014 — LA CONTRE-ÉPREUVE DEMANDÉE.
--
-- credit_order() sur une commande `purchase` doit TOUJOURS rendre un lot
-- d'origine « order ». C'est ce qui vérifie que la branche gratuite n'a pas
-- déteint sur le chemin qui encaisse, plutôt que de l'affirmer.
--
-- Tout se fait dans une transaction annulée : rien n'est gardé. On emprunte
-- l'identifiant d'un compte existant, parce que `profiles.id` référence
-- `auth.users` et qu'on ne peut pas en inventer un.
--
-- Les ordres sont SÉPARÉS, et non enchaînés en CTE : `credit_order` relit la
-- commande avec son propre instantané, et ne verrait pas une ligne insérée
-- dans la même instruction.
-- ---------------------------------------------------------------------------

begin;

create temporary table t_essai on commit drop as
select (select id from public.profiles order by created_at limit 1)  as user_id,
       (select id from public.plans
         where price_cents > 0 and kind <> 'subscription'
         order by sort_order limit 1)                                as plan_id,
       null::uuid as order_id,
       null::uuid as lot_id;

-- Une commande PAYANTE, comme en poserait checkout.session.completed.
with nouvelle as (
  insert into public.orders (user_id, plan_id, kind, status, amount_cents, currency, paid_at)
  select user_id, plan_id, 'purchase', 'paid', 7000, 'EUR', now() from t_essai
  returning id
)
update t_essai set order_id = (select id from nouvelle);

update t_essai set lot_id = public.credit_order(order_id);

select l.origin           as origine_du_lot,
       o.kind             as nature_de_la_commande,
       o.amount_cents     as montant,
       l.quantity_initial as seances,
       m.reason           as mouvement
  from t_essai t
  join public.orders o          on o.id = t.order_id
  join public.credit_lots l     on l.id = t.lot_id
  join public.credit_movements m on m.credit_lot_id = l.id;

rollback;

-- ATTENDU : origine_du_lot = « order », nature = « purchase », montant 7000,
-- mouvement = « grant ».
--
-- Si origine_du_lot vaut « offert », NE DÉPLOIE PAS : la branche gratuite a
-- contaminé le chemin payant.
--
-- Vérifie après coup que le rollback a tout effacé :
--   select count(*) from public.orders
--    where amount_cents = 7000 and created_at > now() - interval '5 minutes';  → 0
