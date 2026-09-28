-- 0010 — contre-épreuve 2/3. Un consentement ne se réécrit pas.

set local role authenticated;

update public.charte_acceptations set autorisation_image = true;

-- ATTENDU : ERROR 42501 — permission denied.
-- Un refus d'image qui peut être retourné en « oui » n'est pas une preuve.
