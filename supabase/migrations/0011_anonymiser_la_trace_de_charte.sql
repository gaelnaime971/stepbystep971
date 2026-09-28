-- =============================================================================
-- 0011 — L'anonymisation efface aussi la trace technique des consentements
-- Step by Step Coaching
--
-- A PASSER APRES 0010, et AVANT que la charte soit ouverte aux clientes.
-- Sinon la premiere anonymisation laissera des adresses IP derriere elle.
--
-- Strictement additif du point de vue des donnees : la fonction est remplacee,
-- aucune ligne n'est touchee par la migration elle-meme.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- Ce qui part, et ce qui reste
-- ---------------------------------------------------------------------------
--
-- L'IP et le user agent sont des donnees personnelles : ils partent.
--
-- La LIGNE de consentement reste, et c'est delibere. C'est une preuve, au meme
-- titre qu'une commande payee : elle etablit qu'un reglement a ete accepte et
-- qu'un choix a ete fait sur la diffusion d'image. L'effacer retournerait
-- l'anonymisation contre la personne qu'elle protege — plus rien n'opposerait
-- un refus d'image a une publication.
--
-- Ce qui reste ne la reidentifie pas : un `user_id` deja anonymise, une date,
-- une version, un booleen.

create or replace function public.anonymize_profile(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  if not public.is_admin() then
    raise exception 'Action reservee a l''administratrice.' using errcode = 'SB009';
  end if;

  update public.profiles
     set first_name  = 'Compte',
         last_name   = 'anonymise',
         phone       = null,
         admin_notes = null,
         email       = 'anonyme+' || p_user_id::text || '@invalide.local'
   where id = p_user_id;

  -- La seule ecriture jamais autorisee sur charte_acceptations, et elle ne
  -- touche QUE la trace technique. Le consentement lui-meme — version, date,
  -- autorisation d'image — n'est pas modifiable, ici comme ailleurs.
  update public.charte_acceptations
     set ip = null,
         user_agent = null
   where user_id = p_user_id
     and (ip is not null or user_agent is not null);

  -- Le journal enregistre QUE l'anonymisation a eu lieu, jamais ce qui a ete
  -- efface : y recopier l'ancien etat annulerait l'effacement.
  perform public.log_audit(
    'profile.anonymized', 'profiles', p_user_id,
    null, jsonb_build_object('anonymized_at', now())
  );
end;
$$;

comment on function public.anonymize_profile(uuid) is
  'Efface l''identite dans profiles et la trace technique des consentements. '
  'GARDE la ligne de consentement : c''est une preuve, et l''effacer priverait '
  'la personne du refus d''image qu''elle a exprime. Ne traite pas auth.users — '
  'la route serveur DOIT enchainer sur l''Admin API.';


-- ---------------------------------------------------------------------------
-- Les droits, reposes apres le remplacement
-- ---------------------------------------------------------------------------
--
-- `create or replace` conserve les droits existants. On les repose quand meme :
-- une fonction rejouee sur une base ou 0005 aurait ete partiellement passe
-- repartirait sinon avec les privileges par defaut de Supabase, c'est-a-dire
-- EXECUTE pour anon, authenticated et service_role.

revoke execute on function public.anonymize_profile(uuid)
  from public, anon, authenticated, service_role;

grant execute on function public.anonymize_profile(uuid) to authenticated;
