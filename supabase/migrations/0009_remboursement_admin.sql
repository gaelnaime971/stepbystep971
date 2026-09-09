-- =============================================================================
-- 0009 — Le remboursement depuis la fiche cliente
-- Step by Step Coaching
--
-- A PASSER APRES 0008, jamais dans la meme execution : l'index ci-dessous
-- compare `template` a la valeur ajoutee par 0008, et Postgres refuse d'utiliser
-- une valeur d'enum creee dans la transaction courante.
--
-- Jouee sur une base VIVANTE, avec des ventes reelles. Additif : un index et
-- une fonction. Aucune ligne existante n'est touchee, aucun comportement en
-- place n'est modifie.
--
-- CE QUE CETTE MIGRATION NE FAIT PAS. Elle ne remplace pas
-- `revoke_order_credits`, qui reste le chemin du remboursement TOTAL, appele
-- par le webhook `charge.refunded`. Elle couvre le cas que le webhook laisse
-- volontairement de cote : le remboursement PARTIEL, ou le nombre de seances
-- retirees est un arbitrage d'Oriane et non une deduction du montant.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- Un seul email de remboursement par commande
-- ---------------------------------------------------------------------------
--
-- Meme discipline que les trois index de 0002 : la ligne d'email_log est
-- ecrite AVANT l'envoi, c'est elle qui reserve la place. Un double clic ou un
-- rejeu bute sur la contrainte au lieu d'ecrire deux fois a la meme cliente.
--
-- Sur `order_id` et non sur le lot : c'est la commande qui est remboursee, et
-- un remboursement partiel suivi d'un second remboursement partiel de la meme
-- commande reste UN evenement du point de vue de la cliente.

create unique index email_log_one_refund_per_order
  on public.email_log (order_id)
  where (template = 'refund_processed');


-- ---------------------------------------------------------------------------
-- Retirer N seances d'un lot, au titre d'un remboursement
-- ---------------------------------------------------------------------------
--
-- Pourquoi une fonction de plus, alors qu'`admin_revoke_credits_from_lot`
-- existe : celle-ci trace un mouvement `admin_adjust`, qui veut dire « geste
-- manuel d'Oriane ». Un retrait consecutif a un remboursement n'est pas un
-- geste manuel, c'est la contrepartie d'un mouvement d'argent. L'enum porte
-- deja `refund_revoked` pour le dire, et `credit_movements.order_id` pour
-- designer la commande concernee.
--
-- Le grand livre doit se lire sans contexte : deux ans plus tard, personne ne
-- saura reconstituer qu'un `admin_adjust` de -2 correspondait a 30 EUR rendus.

create or replace function public.admin_refund_revoke_from_lot(
  p_credit_lot_id uuid,
  p_quantity      integer,
  p_order_id      uuid,
  p_reason        text
)
returns integer
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_lot public.credit_lots%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Action reservee a l''administratrice.' using errcode = 'SB009';
  end if;
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Indique un nombre de seances superieur a zero.' using errcode = 'SB010';
  end if;
  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'Indique un motif : un remboursement sans motif n''est pas trace.'
      using errcode = 'SB010';
  end if;

  select * into v_lot from public.credit_lots where id = p_credit_lot_id for update;
  if not found then
    raise exception 'Ce lot de seances n''existe pas.' using errcode = 'SB008';
  end if;

  -- Le lot doit appartenir a la commande remboursee. Sans ce controle, une
  -- erreur d'identifiant retirerait des seances payees par un AUTRE achat, que
  -- personne ne rembourse. C'est le genre d'erreur qu'on ne rattrape pas.
  if v_lot.order_id is distinct from p_order_id then
    raise exception 'Ce lot n''a pas ete finance par cette commande.' using errcode = 'SB008';
  end if;

  if v_lot.closed_at is not null then
    raise exception 'Ce lot est deja ferme : il n''y a plus rien a retirer.'
      using errcode = 'SB010';
  end if;
  if v_lot.quantity_remaining < p_quantity then
    raise exception 'Ce lot ne contient que % seance(s) disponible(s).', v_lot.quantity_remaining
      using errcode = 'SB010';
  end if;

  update public.credit_lots
     set quantity_remaining = quantity_remaining - p_quantity,
         -- Un lot vide apres un remboursement est un lot REVOQUE, pas un lot
         -- expire. Le laisser ouvert a zero le ferait ramasser par le balayage
         -- nocturne, qui le cloturerait en 'expired' : le grand livre
         -- raconterait une echeance la ou il y a eu un remboursement.
         closed_at    = case when v_lot.quantity_remaining - p_quantity = 0
                             then now() else closed_at end,
         close_reason = case when v_lot.quantity_remaining - p_quantity = 0
                             then 'revoked'::public.lot_close_reason else close_reason end
   where id = p_credit_lot_id;

  insert into public.credit_movements
    (user_id, credit_lot_id, delta, reason, order_id, actor_id, note)
  values
    (v_lot.user_id, p_credit_lot_id, -p_quantity, 'refund_revoked', p_order_id,
     auth.uid(), p_reason);

  perform public.log_audit(
    'order.partially_refunded', 'orders', p_order_id,
    null,
    jsonb_build_object('credit_lot_id', p_credit_lot_id, 'seances', p_quantity, 'motif', p_reason)
  );

  return p_quantity;
end;
$$;

comment on function public.admin_refund_revoke_from_lot(uuid, integer, uuid, text) is
  'Retrait de seances au titre d''un remboursement PARTIEL. Le total passe par '
  'revoke_order_credits, appele par le webhook charge.refunded — ne pas doubler. '
  'Le nombre de seances est un arbitrage d''Oriane : la moitie d''un pack n''a pas '
  'de traduction evidente en seances, et un remboursement de geste commercial ne '
  'doit rien retirer du tout.';


-- ---------------------------------------------------------------------------
-- Les droits
-- ---------------------------------------------------------------------------
--
-- Deux mecanismes se cumulent : Postgres accorde EXECUTE a PUBLIC par defaut,
-- et Supabase ajoute un GRANT NOMINATIF a anon, authenticated et service_role
-- sur chaque fonction creee dans `public`. Revoquer a PUBLIC seul ne suffit
-- pas — il faut nommer les quatre.
--
-- Puis un seul GRANT : `authenticated`. Le garde is_admin() est DANS la
-- fonction, le GRANT ne suffit pas a s'en servir. Et surtout PAS service_role :
-- le webhook n'a rien a faire ici, c'est `revoke_order_credits` qui lui revient.

revoke execute on function public.admin_refund_revoke_from_lot(uuid, integer, uuid, text)
  from public, anon, authenticated, service_role;

grant execute on function public.admin_refund_revoke_from_lot(uuid, integer, uuid, text)
  to authenticated;
