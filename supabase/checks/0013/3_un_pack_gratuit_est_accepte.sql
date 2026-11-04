-- 0013 — l'autre moitié. Un pack à 0 € doit passer.
-- Transaction annulée : rien n'est gardé.

begin;

insert into public.plans (slug, name, kind, sessions_count, validity_interval,
                          price_cents, cancellation_deadline_hours, sort_order)
values ('essai-portes-ouvertes', 'Essai portes ouvertes', 'single', 1,
        interval '1 mon', 0, 24, 999);

select slug, kind, price_cents from public.plans where slug = 'essai-portes-ouvertes';

rollback;

-- Attendu : une ligne à 0, puis le rollback l'efface.
-- Vérifie après coup : select count(*) from public.plans where price_cents = 0;  → 0
