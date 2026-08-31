-- Verification apres 0006 — les six formules. Attendu : 6 lignes « ok ».
-- Les prix sont compares en CENTIMES, la colonne prix_euros n'est la que pour
-- l'oeil. Les validites sont comparees a des intervalles, pas a du texte.

with attendu (slug, kind, seances, validite, prix_cents, prix_barre_cents, mise_en_avant) as (values
  ('a-la-carte',   'single',        1, interval '1 month',   1500, null::integer, false),
  ('abonnement-4', 'subscription',  4, interval '4 weeks',   5000, null::integer, false),
  ('abonnement-8', 'subscription',  8, interval '4 weeks',   7000, null::integer, true),
  ('pack-5',       'pack',          5, interval '3 months',  7000,  7500,         false),
  ('pack-15',      'pack',         15, interval '3 months', 20000, 22500,         false),
  ('pack-30',      'pack',         30, interval '3 months', 40000, 45000,         false)
),
reel as (
  select
    p.slug::text                     as slug,
    p.kind::text                     as kind,
    p.sessions_count                 as seances,
    p.validity_interval              as validite,
    p.price_cents                    as prix_cents,
    p.compare_at_price_cents         as prix_barre_cents,
    p.is_highlighted                 as mise_en_avant,
    p.cancellation_deadline_hours    as delai_h,
    p.stripe_price_id,
    p.is_active,
    p.sort_order,
    p.currency
  from public.plans p
),
juge as (
  select
    coalesce(a.slug, r.slug) as formule,
    r.seances,
    r.prix_cents,
    (r.prix_cents / 100.0)::numeric(10,2) as prix_euros,
    r.validite::text as validite,
    r.prix_barre_cents,
    case
      when r.slug is null then 'MANQUANTE'
      when a.slug is null then 'INATTENDUE'
      when r.kind <> a.kind
        then 'TYPE ' || r.kind || ' au lieu de ' || a.kind
      when r.seances <> a.seances
        then 'SEANCES ' || r.seances || ' au lieu de ' || a.seances
      when r.validite <> a.validite
        then 'VALIDITE ' || r.validite::text || ' au lieu de ' || a.validite::text
      when r.prix_cents <> a.prix_cents
        then 'PRIX ' || r.prix_cents || ' centimes au lieu de ' || a.prix_cents
      when r.prix_barre_cents is distinct from a.prix_barre_cents
        then 'PRIX BARRE ' || coalesce(r.prix_barre_cents::text, '(aucun)')
             || ' au lieu de ' || coalesce(a.prix_barre_cents::text, '(aucun)')
      when r.mise_en_avant <> a.mise_en_avant
        then 'MISE EN AVANT ' || r.mise_en_avant::text || ' au lieu de ' || a.mise_en_avant::text
      when r.delai_h <> 24
        then 'DELAI D''ANNULATION ' || r.delai_h || ' h au lieu de 24'
      when r.currency <> 'EUR'
        then 'DEVISE ' || r.currency
      when r.stripe_price_id is not null
        then 'stripe_price_id renseigne, attendu NULL a ce stade'
      when not r.is_active
        then 'INACTIVE'
      else 'ok'
    end as verdict,
    r.sort_order
  from attendu a
  full join reel r on r.slug = a.slug
)
select * from juge order by (verdict = 'ok'), sort_order nulls last, formule;
