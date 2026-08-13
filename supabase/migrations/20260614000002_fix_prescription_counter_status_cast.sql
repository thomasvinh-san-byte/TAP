-- =============================================================================
-- Migration corrective — cast explicite du statut dans le compteur de prescription
-- =============================================================================
-- Le corps de `rides_prescription_counter()` (20260613000004) compare
-- `old.status = any (cancelled)` et `new.status = any (cancelled)` où `status`
-- est l'enum `ride_status` et `cancelled` un `text[]`. L'opérateur
-- `ride_status = text` n'existe pas (SQLSTATE 42883 : « operator does not exist:
-- ride_status = text ») : tout INSERT/UPDATE sur `rides` liée à une prescription
-- échoue. On force donc la comparaison côté text via `old.status::text` /
-- `new.status::text`. AUCUNE autre modification : logique de delta, idempotence,
-- array `cancelled` (aligné DEC-174, `annulee_meteo` inclus) strictement identiques.
-- La migration d'origine n'est pas touchée ; ce CREATE OR REPLACE prend le relais.
-- =============================================================================

create or replace function public.rides_prescription_counter()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  -- DOIT rester synchronisé avec RIDE_CANCELLED_STATUSES (@tap/shared) + brouillon.
  -- Tout nouveau statut d'annulation s'ajoute ici ET côté app (DEC-174).
  cancelled constant text[] := array['brouillon','annulee_regulateur','annulee_patient','annulee_chauffeur','annulee_meteo'];
  consumes_old boolean := false;
  consumes_new boolean := false;
begin
  if tg_op in ('UPDATE','DELETE') and old.prescription_id is not null then
    consumes_old := not (old.status::text = any (cancelled));
  end if;
  if tg_op in ('INSERT','UPDATE') and new.prescription_id is not null then
    consumes_new := not (new.status::text = any (cancelled));
  end if;

  -- Même prescription (ou NULL des deux côtés) : appliquer le delta de l'état
  -- consommateur uniquement s'il a changé (idempotent).
  if tg_op = 'UPDATE' and (old.prescription_id is not distinct from new.prescription_id) then
    if new.prescription_id is not null and (consumes_new is distinct from consumes_old) then
      update public.prescriptions
        set trajets_consommes = greatest(0, trajets_consommes + (case when consumes_new then 1 else -1 end))
        where id = new.prescription_id;
      perform public.recompute_prescription_status(new.prescription_id);
    end if;
    return new;
  end if;

  -- INSERT / DELETE / changement de prescription : libérer l'ancienne, prendre
  -- la nouvelle.
  if consumes_old then
    update public.prescriptions
      set trajets_consommes = greatest(0, trajets_consommes - 1)
      where id = old.prescription_id;
    perform public.recompute_prescription_status(old.prescription_id);
  end if;
  if consumes_new then
    update public.prescriptions
      set trajets_consommes = trajets_consommes + 1
      where id = new.prescription_id;
    perform public.recompute_prescription_status(new.prescription_id);
  end if;

  return coalesce(new, old);
end; $$;

comment on function public.rides_prescription_counter() is
  'Compteur idempotent de trajets consommés (DEC-163/174) : delta sur transition '
  'de l''état consommateur d''une course (active = ni brouillon ni annulée, météo '
  'incluse). Comparaison de statut castée en text (ride_status::text) car '
  'l''opérateur ride_status = text n''existe pas. Array `cancelled` synchronisé '
  'avec RIDE_CANCELLED_STATUSES (@tap/shared).';
