-- 0008 — les emails deja traces ne sont pas touches par l'ajout de valeur.
-- A comparer avec ce que tu vois AVANT de passer la migration.

select template::text as modele, count(*) as envois
  from public.email_log
 group by template
 order by envois desc;

-- Attendu : les memes lignes et les memes comptes qu'avant. Aucune ligne en
-- 'refund_processed' — rien n'a encore ete envoye.
