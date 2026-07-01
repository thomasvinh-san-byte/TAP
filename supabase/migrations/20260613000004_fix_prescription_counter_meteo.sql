-- =============================================================================
-- Migration corrective — compteur de prescription ignore `annulee_meteo` (DEC-174)
-- =============================================================================
-- CRITIQUE (donnée de remboursement CGSS). Le compteur de trajets idempotent
-- (`rides_prescription_counter`, 20260612000006) utilise un array de statuts
-- « annulés » EN DUR qui n'incluait PAS `annulee_meteo` (valeur d'enum ajoutée
-- en 12.01). Conséquence : une course liée à une prescription annulée pour météo
-- (cyclone) était considérée comme NON annulée → elle restait consommatrice d'un
-- trajet → le trajet n'était PAS rendu au patient. Un bon de 5 trajets passait à
-- 4 restants alors que le transport n'a jamais eu lieu (litige + décompte
-- réglementaire faux).
--
-- D-01 : `CREATE OR REPLACE FUNCTION` — array `cancelled` aligné (ajout de
--        `annulee_meteo`). Logique de delta (consumes_old/new, greatest(0,…))
--        INCHANGÉE → idempotence préservée. Le trigger n'est pas recréé.
-- D-02 : recompute rétroactif des prescriptions déjà faussées par une annulation
--        météo passée (recalcul via la définition canonique « consomme = course
--        ni brouillon ni annulée »). No-op sûr si aucune course annulee_meteo.
-- D-03 : COUPLAGE — cet array DOIT rester synchronisé avec la constante
--        applicative `RIDE_CANCELLED_STATUSES` (@tap/shared, validators/ride.ts).
--        SQL ne peut pas importer la constante TS : tout futur statut d'annulation
--        s'ajoute AUX DEUX endroits (app + ce trigger). Point de vigilance tracé
--        au registre §12.
-- =============================================================================

-- -- D-01 — Fonction corrigée (array aligné, logique inchangée) ----------------
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
    consumes_old := not (old.status = any (cancelled));
  end if;
  if tg_op in ('INSERT','UPDATE') and new.prescription_id is not null then
    consumes_new := not (new.status = any (cancelled));
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
  'incluse). Array `cancelled` synchronisé avec RIDE_CANCELLED_STATUSES (@tap/shared).';

-- -- D-02 — Recompute rétroactif des prescriptions faussées par une annul. météo
-- Recalcul via la définition CANONIQUE (« consomme » = course ni brouillon ni
-- annulée). Set-based, idempotent (rejouable). No-op si aucune course annulee_meteo.
with affected as (
  select distinct prescription_id as id
  from public.rides
  where status = 'annulee_meteo' and prescription_id is not null
),
recount as (
  select a.id,
    (
      select count(*)::int
      from public.rides r
      where r.prescription_id = a.id
        -- `r.status::text` : en SQL simple, un array de littéraux se résout en
        -- text[] → `ride_status <> text` n'existe pas (SQLSTATE 42883). On
        -- compare donc côté text. (Le corps plpgsql plus haut, `= any(text[])`,
        -- est valide au runtime — inchangé.)
        and r.status::text <> all (
          array['brouillon','annulee_regulateur','annulee_patient','annulee_chauffeur','annulee_meteo']
        )
    ) as consommes
  from affected a
)
update public.prescriptions p
  set trajets_consommes = recount.consommes
  from recount
  where p.id = recount.id
    and p.trajets_consommes is distinct from recount.consommes;

-- Recalcul du statut des prescriptions concernées (active/epuisee/expiree).
do $$
declare r record;
begin
  for r in
    select distinct prescription_id as id
    from public.rides
    where status = 'annulee_meteo' and prescription_id is not null
  loop
    perform public.recompute_prescription_status(r.id);
  end loop;
end $$;
