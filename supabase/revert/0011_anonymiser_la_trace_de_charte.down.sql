-- =============================================================================
-- REVERT 0011
-- =============================================================================
--
-- Remet anonymize_profile dans son etat de 0005 : sans l'effacement de la
-- trace technique des consentements.
--
-- NON DESTRUCTIF pour les donnees, mais les IP deja effacees ne reviennent
-- pas — c'etait le but. A ne jouer que si 0010 est lui-meme defait, sans quoi
-- la prochaine anonymisation laissera des adresses IP en base.

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

  perform public.log_audit(
    'profile.anonymized', 'profiles', p_user_id,
    null, jsonb_build_object('anonymized_at', now())
  );
end;
$$;

revoke execute on function public.anonymize_profile(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.anonymize_profile(uuid) to authenticated;
