-- 0009 — l'invariant du grand livre, AVANT tout remboursement.
--
-- Pour chaque lot : SUM(delta) des mouvements doit egaler quantity_remaining.
-- C'est ce qui permet de reconstruire un solde. Si une ligne sort ici, ne
-- rembourse rien tant que ce n'est pas compris.

select l.id as lot,
       l.quantity_remaining as solde,
       coalesce(sum(m.delta), 0) as somme_des_mouvements,
       l.close_reason
  from public.credit_lots l
  left join public.credit_movements m on m.credit_lot_id = l.id
 group by l.id, l.quantity_remaining, l.close_reason
having l.quantity_remaining <> coalesce(sum(m.delta), 0);

-- Attendu : AUCUNE LIGNE.
