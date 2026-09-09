-- 0008 — la valeur d'enum existe, et les six anciennes n'ont pas bouge.

select
  'valeur refund_processed presente' as controle,
  case when 'refund_processed' = any (
         select unnest(enum_range(null::public.email_template))::text)
       then 'OK' else 'ECHEC' end as verdict
union all
select
  'les 6 valeurs d''origine sont intactes',
  case when (select count(*) from unnest(enum_range(null::public.email_template)) v
              where v::text in ('purchase_confirmation','booking_confirmation',
                                'course_canceled','expiry_warning',
                                'payment_failed','subscription_ended')) = 6
       then 'OK' else 'ECHEC' end
union all
select
  'aucune valeur inattendue',
  case when (select count(*) from unnest(enum_range(null::public.email_template))) = 7
       then 'OK' else 'ECHEC' end;

-- Attendu : trois OK.
