-- Verification apres 0006 — assertions. Attendu : 9 lignes « ok », echecs en tete.

with p as (
  select slug::text, kind::text as kind, sessions_count, validity_interval,
         price_cents, compare_at_price_cents, is_highlighted, is_active,
         stripe_price_id, stripe_product_id
  from public.plans
),
m as (
  select
    (select count(*) from public.locations where is_active)          as nb_lieux,
    (select count(*) from p where is_active)                         as nb_formules,
    -- Regle 3 : un abonnement doit etre stocke en JOURS, pas en mois.
    -- interval '4 weeks' est normalise par Postgres en 28 jours ; interval
    -- '1 month' garde une composante mois. Tester la composante jour ET la
    -- composante mois est le seul moyen de distinguer les deux.
    (select count(*) from p
      where kind = 'subscription'
        and extract(day   from validity_interval) = 28
        and extract(month from validity_interval) = 0)               as abos_en_28_jours,
    (select count(*) from p where kind = 'subscription')             as nb_abos,
    (select count(*) from p
      where kind = 'subscription'
        and extract(month from validity_interval) <> 0)              as abos_en_mois,
    (select count(*) from p
      where stripe_price_id is not null or stripe_product_id is not null)
                                                                     as refs_stripe,
    (select count(*) from p where is_highlighted)                    as nb_mises_en_avant,
    (select coalesce(sum(price_cents), 0) from p)                    as somme_prix_cents,
    (select coalesce(sum(compare_at_price_cents - price_cents), 0)
       from p where compare_at_price_cents is not null)              as somme_economies_cents,
    (select count(*) from p
      where compare_at_price_cents is not null and kind <> 'pack')   as prix_barres_hors_pack
),
a as (
  select 1 as n,
    'les 3 lieux sont actifs' as assertion,
    case when nb_lieux = 3 then 'ok'
         else 'ECHEC — ' || nb_lieux || ' lieux au lieu de 3' end as verdict
  from m
  union all select 2,
    'les 6 formules sont actives',
    case when nb_formules = 6 then 'ok'
         else 'ECHEC — ' || nb_formules || ' formules au lieu de 6' end from m
  union all select 3,
    'il y a exactement 2 abonnements',
    case when nb_abos = 2 then 'ok'
         else 'ECHEC — ' || nb_abos || ' abonnements au lieu de 2' end from m
  union all select 4,
    'REGLE 3 : les 2 abonnements sont en 28 jours exactement',
    case when abos_en_28_jours = 2 then 'ok'
         else 'ECHEC — ' || abos_en_28_jours || ' abonnement(s) sur 2 en 28 jours' end from m
  union all select 5,
    'REGLE 3 : aucun abonnement n''est exprime en mois',
    case when abos_en_mois = 0 then 'ok'
         else 'ECHEC — ' || abos_en_mois || ' abonnement(s) en mois. Cote Stripe cela donnerait un prelevement mensuel au lieu de 4 semaines' end from m
  union all select 6,
    'aucune reference Stripe n''est encore renseignee',
    case when refs_stripe = 0 then 'ok'
         else 'ECHEC — ' || refs_stripe || ' formule(s) portent deja un identifiant Stripe' end from m
  union all select 7,
    'une seule formule porte la pastille « Le plus choisi »',
    case when nb_mises_en_avant = 1 then 'ok'
         else 'ECHEC — ' || nb_mises_en_avant || ' formules mises en avant' end from m
  union all select 8,
    'somme de controle des prix : 805,00 €',
    case when somme_prix_cents = 80500 then 'ok'
         else 'ECHEC — ' || (somme_prix_cents / 100.0)::numeric(10,2) || ' €' end from m
  union all select 9,
    'les prix barres n''existent que sur les packs, pour 80,00 € d''economie cumulee',
    case when prix_barres_hors_pack > 0
           then 'ECHEC — ' || prix_barres_hors_pack || ' prix barre hors pack'
         when somme_economies_cents <> 8000
           then 'ECHEC — ' || (somme_economies_cents / 100.0)::numeric(10,2) || ' € au lieu de 80,00 €'
         else 'ok' end from m
)
select * from a order by (verdict = 'ok'), n;
