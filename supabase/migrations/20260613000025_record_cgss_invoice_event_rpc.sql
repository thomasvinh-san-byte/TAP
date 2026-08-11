-- =============================================================================
-- Migration — RPC d'enregistrement d'un retour CGSS (événement + statut, atomique)
-- =============================================================================
-- G3 Lot 2. Enregistre un retour de facturation CGSS de façon ATOMIQUE : insère
-- l'événement dans l'historique append-only ET met à jour le statut courant de
-- la course, en une seule transaction (une fonction plpgsql est atomique). Évite
-- toute divergence entre l'historique (source de vérité) et le cache de statut.
--
-- SECURITY INVOKER : la RLS du Lot 1 s'applique intégralement (insert
-- ride_cgss_invoice_events + update rides réservés régulateur / dirigeant de
-- l'organisation ; l'accès à la course est vérifié par la RLS de SELECT). Les
-- contraintes du Lot 1 (rejet ⇒ motif, famille ⇒ rejet, statut ⇒ CGSS pur)
-- restent en vigueur. Aucun montant (D-09).
--
-- Le statut résultant est fourni par l'appelant (dérivé du type d'événement,
-- source unique côté application) ; la contrainte `check` sur cgss_invoice_status
-- garantit qu'il reste dans la séquence normée.
-- =============================================================================

create or replace function public.record_cgss_invoice_event(
  p_ride_id uuid,
  p_event_type text,
  p_event_date date,
  p_new_status text,
  p_motif text default null,
  p_motif_famille text default null,
  p_complementaire_en_attente boolean default false
) returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_org uuid;
begin
  -- Org de la course. La RLS de SELECT sur rides borne à l'organisation : v_org
  -- reste NULL si l'utilisateur n'a pas accès → on refuse (course « introuvable »).
  select organization_id into v_org from public.rides where id = p_ride_id;
  if v_org is null then
    raise exception 'Course introuvable ou hors périmètre';
  end if;

  insert into public.ride_cgss_invoice_events (
    organization_id, ride_id, event_type, event_date,
    motif, motif_famille, complementaire_en_attente, created_by
  ) values (
    v_org, p_ride_id, p_event_type, p_event_date,
    p_motif, p_motif_famille, coalesce(p_complementaire_en_attente, false), auth.uid()
  );

  update public.rides
    set cgss_invoice_status = p_new_status
    where id = p_ride_id;
end;
$$;

comment on function public.record_cgss_invoice_event(
  uuid, text, date, text, text, text, boolean
) is
  'Enregistre un retour CGSS (Lot 2) : insere l''evenement append-only + met a jour rides.cgss_invoice_status, atomiquement. SECURITY INVOKER (RLS + contraintes Lot 1 appliquees). Aucun montant (D-09).';
