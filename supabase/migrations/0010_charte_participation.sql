-- =============================================================================
-- 0010 — La charte de participation
-- Step by Step Coaching
--
-- Jouee sur une base VIVANTE, avec environ 200 comptes et des ventes reelles.
-- Strictement additif : une table, ses index, ses policies, un RPC. Aucune
-- ligne existante n'est touchee, aucun comportement en place n'est modifie.
--
-- DEUX CONSENTEMENTS, JAMAIS FUSIONNES.
--   * l'acceptation du reglement : obligatoire, pas d'acces sans elle ;
--   * l'autorisation de diffusion d'image : un choix explicite, sans valeur
--     par defaut, et un refus ne bloque rien (article 7.4 de la charte).
-- Les fusionner en une seule case viderait le second de sa valeur : un
-- consentement a l'image donne « en meme temps » que l'acces n'est pas libre.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- Pourquoi une ligne existe
-- ---------------------------------------------------------------------------
--
-- La table est en AJOUT SEUL, comme credit_movements. Une cliente qui change
-- d'avis sur son image ne reecrit pas sa ligne : elle en ajoute une. Sans quoi
-- l'etat « elle refusait au moment de la story » serait perdu le jour ou elle
-- accepte, et la trace n'aurait plus aucune valeur probante.
--
-- Mais deux lignes ne disent alors pas la meme chose, et rien ne permettrait de
-- les distinguer : la date d'acceptation de la charte deviendrait celle du
-- dernier changement d'avis. D'ou cette colonne.

create type public.charte_origine as enum (
  'acceptation',      -- signature de la charte, a l'inscription ou au rattrapage
  'changement_image'  -- elle revient sur son seul choix d'image, depuis son profil
);

comment on type public.charte_origine is
  'Ce que la ligne raconte. La date d''acceptation d''une version est celle de sa '
  'ligne « acceptation » ; l''autorisation d''image en vigueur est celle de la '
  'ligne la plus recente, quelle que soit son origine.';


-- ---------------------------------------------------------------------------
-- La table
-- ---------------------------------------------------------------------------

create table public.charte_acceptations (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references public.profiles (id) on delete cascade,

  -- La version vit dans le CODE, pas en base : c'est le texte publie qui fait
  -- foi, et il est versionne avec lui. La base se contente d'enregistrer
  -- laquelle a ete signee.
  version            text not null,

  accepted_at        timestamptz not null default now(),
  autorisation_image boolean not null,
  origine            public.charte_origine not null default 'acceptation',

  -- La trace technique, pour la valeur probante. `inet` plutot que `text` :
  -- Postgres valide la forme, et une adresse mal formee ne s'ecrit pas.
  -- NULLABLE : derriere certains proxys l'adresse n'arrive pas, et un
  -- consentement sans IP vaut mieux qu'un consentement refuse.
  ip                 inet,
  user_agent         text,

  constraint charte_version_non_vide check (btrim(version) <> '')
);

comment on table public.charte_acceptations is
  'AJOUT SEUL : aucune policy UPDATE ni DELETE ne sera creee, pas meme pour '
  'Oriane. Si Oriane publie une v2, on veut savoir qui a signe quoi et quand — '
  'une reecriture effacerait precisement ce qu''on cherche a prouver.';

comment on column public.charte_acceptations.autorisation_image is
  'Choix EXPLICITE, sans valeur par defaut en base non plus : la colonne est '
  'NOT NULL et sans DEFAULT, pour qu''aucun chemin d''ecriture ne puisse omettre '
  'la question et laisser croire a un consentement.';

comment on column public.charte_acceptations.ip is
  'NULL quand l''adresse n''a pas pu etre lue. On enregistre le consentement '
  'quand meme : le bloquer pour un en-tete manquant serait absurde.';


-- ---------------------------------------------------------------------------
-- Les index
-- ---------------------------------------------------------------------------

-- La question posee a CHAQUE ouverture de /compte : « a-t-elle signe, et quoi ? »
-- Elle doit se resoudre sur l'index, sans lire la table.
create index charte_acceptations_user_idx
  on public.charte_acceptations (user_id, accepted_at desc);

-- « Qui a signe la version en cours ? » — le controle d'acces, et la colonne de
-- la liste des clientes.
create index charte_acceptations_version_idx
  on public.charte_acceptations (version, user_id)
  where (origine = 'acceptation');


-- ---------------------------------------------------------------------------
-- Droits et RLS
-- ---------------------------------------------------------------------------
--
-- Supabase accorde tous les verbes a anon et authenticated sur les tables de
-- `public`, et une table sans RLS y est immediatement exposee par PostgREST.
-- Les deux gestes obligatoires, puis on ouvre policy par policy.

alter table public.charte_acceptations enable row level security;

revoke insert, update, delete on public.charte_acceptations from anon, authenticated;

-- Elle lit ses propres lignes — la charte reste consultable depuis son profil,
-- avec la date et la version qu'elle a signees. Oriane lit tout : il lui faut
-- la colonne de statut, et surtout la liste de celles qui refusent leur image.
create policy charte_select_own_or_admin on public.charte_acceptations
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- AUCUNE policy INSERT, UPDATE ni DELETE. Les lignes naissent dans le RPC
-- ci-dessous, qui pose lui-meme `user_id` : une cliente ne peut donc pas
-- inscrire un consentement au nom d'une autre, ni antidater le sien.


-- ---------------------------------------------------------------------------
-- Enregistrer un consentement
-- ---------------------------------------------------------------------------
--
-- `p_autorisation_image` n'a PAS de valeur par defaut. C'est volontaire et
-- c'est le coeur du sujet : un appelant qui oublierait le parametre echoue,
-- au lieu d'enregistrer un « non » — ou pire, un « oui » — que personne n'a
-- exprime.

create or replace function public.accepter_charte(
  p_version            text,
  p_autorisation_image boolean,
  p_origine            public.charte_origine default 'acceptation',
  p_ip                 text default null,
  p_user_agent         text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_id  uuid;
  v_ip  inet;
begin
  if auth.uid() is null then
    raise exception 'Aucune session : connecte-toi avant d''accepter la charte.'
      using errcode = 'SB009';
  end if;
  if p_version is null or btrim(p_version) = '' then
    raise exception 'Version de charte absente.' using errcode = 'SB010';
  end if;
  if p_autorisation_image is null then
    raise exception 'Le choix sur l''image doit etre explicite.' using errcode = 'SB010';
  end if;

  -- Une adresse mal formee ne doit pas faire echouer un consentement : on la
  -- laisse tomber plutot que de refuser la ligne.
  begin
    v_ip := nullif(btrim(coalesce(p_ip, '')), '')::inet;
  exception when others then
    v_ip := null;
  end;

  insert into public.charte_acceptations
    (user_id, version, autorisation_image, origine, ip, user_agent)
  values
    (auth.uid(), btrim(p_version), p_autorisation_image, p_origine,
     v_ip, nullif(btrim(coalesce(p_user_agent, '')), ''))
  returning id into v_id;

  return v_id;
end;
$$;

comment on function public.accepter_charte(text, boolean, public.charte_origine, text, text) is
  'Le seul chemin d''ecriture. `user_id` vient de auth.uid() et non du parametre : '
  'personne ne signe a la place d''une autre. Aucun defaut sur l''autorisation '
  'd''image — un appel incomplet echoue plutot que d''inventer un consentement.';


-- ---------------------------------------------------------------------------
-- Les droits sur la fonction
-- ---------------------------------------------------------------------------
--
-- Deux mecanismes se cumulent : Postgres accorde EXECUTE a PUBLIC par defaut,
-- et Supabase ajoute un GRANT NOMINATIF a anon, authenticated et service_role
-- sur chaque fonction creee dans `public`. Revoquer a PUBLIC seul ne suffit
-- pas — il faut nommer les quatre.

revoke execute on function
  public.accepter_charte(text, boolean, public.charte_origine, text, text)
  from public, anon, authenticated, service_role;

grant execute on function
  public.accepter_charte(text, boolean, public.charte_origine, text, text)
  to authenticated;
