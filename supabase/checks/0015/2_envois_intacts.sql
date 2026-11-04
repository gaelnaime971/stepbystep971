-- 0015 — les emails déjà tracés ne bougent pas. À comparer avec l'avant.

select template::text as modele, count(*) as envois
  from public.email_log
 group by template
 order by envois desc;

-- Attendu : les mêmes lignes et les mêmes comptes qu'avant la migration.
-- Aucune ligne en « free_confirmation » : le code n'est pas encore déployé.
