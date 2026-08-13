-- =============================================================================
-- Migration — RPC de validation du planning (validation + figeage atomiques)
-- =============================================================================
-- Module 5.12 lot D, robustesse. La Server Action `validatePlanningAction`
-- faisait DEUX écritures séparées : INSERT planning_validations puis INSERT
-- planning_validation_rides. Si le figeage échouait après la validation, la
-- validation persistait SANS instantané, et la re-validation (idempotente) ne
-- re-figeait jamais → l'historique (lot E) classait alors tout le réalisé en
-- « ajoutées ». On rend les deux écritures ATOMIQUES via une fonction plpgsql
-- (une fonction est exécutée dans une seule transaction : tout réussit, ou tout
-- est annulé). Modèle : `record_cgss_invoice_event` (G3 Lot 2).
--
-- SECURITY INVOKER : la RLS s'applique intégralement — les policies INSERT de
-- planning_validations / planning_validation_rides (régulateur ou dirigeant de
-- l'organisation) autorisent l'écriture, et la RLS de SELECT sur `rides` borne
-- l'instantané à l'organisation. Aucune élévation de privilège.
--
-- Idempotence préservée : une validation par (organisation, jour) via l'index
-- unique. Une validation existante → renvoyée telle quelle (already_validated).
-- Une course concurrente qui gagne l'INSERT → l'autre attrape `unique_violation`
-- et renvoie aussi already_validated. Les notifications (push/SMS) restent HORS
-- de cette fonction (best-effort, après commit) — elles ne doivent pas pouvoir
-- annuler une validation déjà écrite.
--
-- Jour en fuseau Réunion (UTC+4, sans heure d'été) : [date 00:00+04, lendemain
-- 00:00+04). « Prévu ferme » = hors brouillon et hors annulées.
-- =============================================================================

create or replace function public.validate_planning_day(p_planning_date date)
returns table (validation_id uuid, already_validated boolean, snapshot_count integer)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_org uuid := public.current_organization_id();
  v_validation_id uuid;
  v_count integer := 0;
  v_start timestamptz := (p_planning_date::text || ' 00:00:00+04')::timestamptz;
  v_end timestamptz := ((p_planning_date + 1)::text || ' 00:00:00+04')::timestamptz;
begin
  if v_org is null then
    raise exception 'Organisation introuvable ou hors périmètre';
  end if;

  -- Déjà validé ? → renvoi idempotent, aucune écriture.
  select id into v_validation_id
    from public.planning_validations
    where organization_id = v_org and planning_date = p_planning_date;
  if v_validation_id is not null then
    return query select v_validation_id, true, 0;
    return;
  end if;

  -- INSERT validation + figeage dans la MÊME transaction (atomicité).
  begin
    insert into public.planning_validations (organization_id, planning_date, validated_by)
      values (v_org, p_planning_date, auth.uid())
      returning id into v_validation_id;
  exception when unique_violation then
    -- Course concurrente : l'autre appel a validé entre-temps → idempotent.
    select id into v_validation_id
      from public.planning_validations
      where organization_id = v_org and planning_date = p_planning_date;
    return query select v_validation_id, true, 0;
    return;
  end;

  insert into public.planning_validation_rides
    (validation_id, organization_id, ride_id, driver_id, vehicle_id, patient_id,
     scheduled_at, status)
  select v_validation_id, v_org, r.id, r.driver_id, r.vehicle_id, r.patient_id,
         r.scheduled_at, r.status
    from public.rides r
    where r.organization_id = v_org
      and r.scheduled_at >= v_start
      and r.scheduled_at < v_end
      and r.status::text <> all (array[
        'brouillon', 'annulee_regulateur', 'annulee_patient',
        'annulee_chauffeur', 'annulee_meteo'
      ]);
  get diagnostics v_count = row_count;

  return query select v_validation_id, false, v_count;
end;
$$;

comment on function public.validate_planning_day(date) is
  'Valide le planning d''un jour (Module 5.12 lot D) : INSERT validation + '
  'figeage de l''instantané des courses prévues, ATOMIQUEMENT (une transaction). '
  'SECURITY INVOKER (RLS appliquée). Idempotent par (organisation, jour). '
  'Notifications push/SMS gérées hors fonction (best-effort, après commit).';

revoke all on function public.validate_planning_day(date) from anon;
grant execute on function public.validate_planning_day(date) to authenticated;
