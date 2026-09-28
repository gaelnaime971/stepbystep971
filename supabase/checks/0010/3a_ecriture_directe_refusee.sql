-- 0010 — contre-épreuve 1/3. Une cliente ne peut pas écrire un consentement
-- en direct, donc pas non plus au nom d'une autre.
--
-- Un seul ordre par fichier : la première erreur avorte la transaction, et
-- les suivantes ne rendraient plus qu'un « current transaction is aborted »
-- qui ne prouve rien.

set local role authenticated;

insert into public.charte_acceptations (user_id, version, autorisation_image)
values (gen_random_uuid(), 'v-test', true);

-- ATTENDU : ERROR 42501 — permission denied for table charte_acceptations.
-- Si cet ordre PASSE, ne déploie pas : n'importe quelle cliente pourrait
-- inscrire un « J'autorise » au nom d'une autre.
