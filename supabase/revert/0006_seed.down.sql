-- Revert 0006. Ne supprime que les lignes du seed, par leur cle naturelle.
-- Echouera si une formule a deja ete vendue (orders.plan_id est en RESTRICT)
-- ou si un cours reference un lieu : c'est voulu.

delete from public.plans where slug in (
  'a-la-carte', 'abonnement-4', 'abonnement-8', 'pack-5', 'pack-15', 'pack-30');

delete from public.locations where name in ('Les Abymes', 'Le Moule', 'Jarry');
