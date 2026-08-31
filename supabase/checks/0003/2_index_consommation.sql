-- L'index de consommation, celui qui porte les regles 4 et 5, en detail.
-- Attendu : colonnes (user_id, expires_at, issued_at),
--           predicat (quantity_remaining > 0 AND closed_at IS NULL).
select indexdef
from pg_indexes
where schemaname = 'public' and indexname = 'credit_lots_consumption_idx';
