-- 0011 — contrôle de fond, à relancer après chaque anonymisation.
-- Aucun compte anonymisé ne doit garder d'adresse IP ni de user agent.

select c.user_id,
       count(*)                                as lignes,
       count(c.ip)                             as avec_ip,
       count(c.user_agent)                     as avec_user_agent
  from public.charte_acceptations c
  join public.profiles p on p.id = c.user_id
 where p.last_name = 'anonymise'
   and (c.ip is not null or c.user_agent is not null)
 group by c.user_id;

-- Attendu : AUCUNE LIGNE.
