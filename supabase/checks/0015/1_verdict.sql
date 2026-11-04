-- 0015 — la valeur existe, les anciennes sont intactes. Attendu : trois « ok ».

with m as (
  select array(select unnest(enum_range(null::public.email_template))::text) as valeurs
)
select 1 as n, 'free_confirmation est reconnue' as assertion,
       case when 'free_confirmation' = any (valeurs) then 'ok' else 'ECHEC' end as verdict from m
union all select 2, 'les sept valeurs précédentes sont là',
       case when valeurs @> array['purchase_confirmation','booking_confirmation',
                                  'course_canceled','expiry_warning','payment_failed',
                                  'subscription_ended','refund_processed']
            then 'ok' else 'ECHEC — une valeur a disparu' end from m
union all select 3, 'aucune valeur inattendue',
       case when array_length(valeurs, 1) = 8 then 'ok'
            else 'ECHEC — ' || array_length(valeurs, 1) || ' valeurs au lieu de 8' end from m
order by verdict desc, n;
