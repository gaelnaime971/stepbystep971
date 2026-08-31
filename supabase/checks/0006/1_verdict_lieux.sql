-- Verification apres 0006 — les lieux. Attendu : 3 lignes « ok ».

with attendu (nom, ville, rang) as (values
  ('Les Abymes', 'Les Abymes',   1),
  ('Le Moule',   'Le Moule',     2),
  ('Jarry',      'Baie-Mahault', 3)
),
reel as (
  select l.name::text as nom, l.city::text as ville,
         l.sort_order as rang, l.is_active, l.address
  from public.locations l
),
juge as (
  select
    coalesce(a.nom, r.nom) as lieu,
    r.ville, r.rang, r.address as adresse,
    case
      when r.nom is null      then 'MANQUANT'
      when a.nom is null      then 'INATTENDU'
      when r.ville is distinct from a.ville
                              then 'VILLE ' || coalesce(r.ville, '(vide)') || ' au lieu de ' || a.ville
      when r.rang <> a.rang   then 'RANG ' || r.rang || ' au lieu de ' || a.rang
      when not r.is_active    then 'INACTIF'
      else 'ok'
    end as verdict
  from attendu a
  full join reel r on r.nom = a.nom
)
select * from juge order by (verdict = 'ok'), rang nulls last, lieu;
-- `adresse` doit etre vide : Oriane la renseignera depuis l'admin.
