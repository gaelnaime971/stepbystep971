-- 0013 — contre-épreuve. Un abonnement à 0 € doit être refusé par la base.
-- Transaction annulée : rien n'est gardé.

begin;

insert into public.plans (slug, name, kind, sessions_count, validity_interval,
                          price_cents, cancellation_deadline_hours, sort_order)
values ('essai-abo-gratuit', 'Essai', 'subscription', 4, interval '28 days',
        0, 24, 999);

rollback;

-- ATTENDU : ERROR 23514 — violates check constraint
-- « plans_gratuite_non_recurrente ».
--
-- Si cet ordre PASSE, ne déploie pas : une cliente s'abonnerait à une formule
-- qui ne se rechargerait jamais, et ne s'en apercevrait qu'au bout de 28 jours.
