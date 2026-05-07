-- =============================================================================
-- Migration Phase 1.5 — RPC RGPD : anonymisation art. 17 + match NIR portail
-- =============================================================================
-- D-09 (effacement art. 17 = anonymisation, JAMAIS DELETE patient ni rides).
-- R5 RESEARCH : conservation rides (CSS L114-19, 5 ans) — ce RPC ne touche
-- pas aux courses/billings.
--
-- B-1 fix (revision 2/3) : RPC nir_match_patient_for_legal_request requise
-- par Plan 05 task 5.2 verifyIdentityAction (portail patient).
-- =============================================================================

-- -- Pré-requis : relaxer NOT NULL sur colonnes anonymisables --------------
-- L'anonymisation art. 17 met prenom/nom/date_naissance/adresse_ligne1/ville
-- à NULL. Sans cette ALTER, le UPDATE du RPC échoue. Garde le check_postal
-- (974XX) car la valeur NULL passe le check (`code_postal is null or ...`).
alter table public.patients alter column prenom drop not null;
alter table public.patients alter column nom drop not null;
alter table public.patients alter column date_naissance drop not null;
alter table public.patients alter column adresse_ligne1 drop not null;
alter table public.patients alter column code_postal drop not null;
alter table public.patients alter column ville drop not null;

-- -- public.rgpd_anonymize_patient(uuid, uuid, text) -----------------------
-- Effacement RGPD art. 17 — anonymise un patient sans le supprimer :
--   - Identité directe → NULL (prenom, nom, telephone, adresse, contact_urgence)
--   - NIR : ciphertext + last4 → NULL ; nir_search_hash rehashé avec salt
--     (anti-réidentification cross-org si l'attaquant connaît le hash original)
--   - Consentement SMS → false
--   - archive=true, archive_reason='rgpd.art17.anonymisation'
--   - Suppression notes + contraintes opérationnelles (pas de durée légale)
--   - Rides + billings CONSERVÉS (CSS L114-19, 5 ans)
--   - Audit log patient.anonymized
-- Advisory lock : empêche anonymisations parallèles du même patient.
create or replace function public.rgpd_anonymize_patient(
  p_patient_id uuid,
  p_request_id uuid,
  p_salt text
) returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_org_id uuid;
  v_old_search_hash bytea;
  v_lock_key bigint;
begin
  -- Advisory lock : empêche double-call concurrent du même patient
  v_lock_key := ('x' || substr(md5(p_patient_id::text), 1, 16))::bit(64)::bigint;
  perform pg_advisory_xact_lock(v_lock_key);

  -- Récupération + lock de la ligne patient
  select organization_id, nir_search_hash
    into v_org_id, v_old_search_hash
  from public.patients
  where id = p_patient_id
  for update;

  if v_org_id is null then
    raise exception 'Patient introuvable : %', p_patient_id;
  end if;

  -- Anonymisation : NULL identifiants directs, hash NIR rotated
  update public.patients set
    prenom = null,
    nom = null,
    date_naissance = null,
    genre = null,
    telephone = null,
    telephone_normalized = null,
    adresse_ligne1 = null,
    adresse_ligne2 = null,
    ville = null,
    contact_urgence_nom = null,
    contact_urgence_telephone = null,
    nir_encrypted = null,
    nir_last4 = null,
    nir_search_hash = extensions.digest(
      coalesce(encode(v_old_search_hash, 'hex'), '') || p_salt,
      'sha256'
    ),
    consentement_sms = false,
    consentement_sms_at = null,
    archive = true,
    archive_at = now(),
    archive_reason = 'rgpd.art17.anonymisation',
    updated_at = now()
  where id = p_patient_id;

  -- Suppression PII opérationnelles (pas de durée légale)
  delete from public.patient_constraint where patient_id = p_patient_id;
  delete from public.patient_operational_note where patient_id = p_patient_id;

  -- Audit log
  insert into public.audit_logs
    (organization_id, actor_id, actor_role, action,
     entity_type, entity_id, metadata)
  values (
    v_org_id, auth.uid(), public.current_user_role(),
    'patient.anonymized', 'patient', p_patient_id,
    jsonb_build_object(
      'request_id', p_request_id,
      'retention_basis', 'css_l114_19',
      'anonymized_at', now()
    )
  );
end;
$$;

revoke execute on function public.rgpd_anonymize_patient(uuid, uuid, text) from public, anon;
grant execute on function public.rgpd_anonymize_patient(uuid, uuid, text) to authenticated;

comment on function public.rgpd_anonymize_patient(uuid, uuid, text) is
  'RGPD art. 17 — anonymise un patient (UPDATE only, jamais DELETE). Conserve rides (CSS L114-19).';

-- -- public.nir_match_patient_for_legal_request(uuid, bytea, text, date) ----
-- B-1 fix : portail patient. Compare le NIR fourni (déchiffré côté Edge
-- Function NIR puis hashé à nouveau) au patient cible. Match exact (NIR +
-- nom unaccent + date naissance) dans la même org. Retourne uuid ou NULL.
-- SECURITY DEFINER pour traverser RLS (le portail patient n'a pas de session
-- Supabase authentifiée — le rate-limit est géré côté Server Action).
create or replace function public.nir_match_patient_for_legal_request(
  p_request_id uuid,
  p_nir_search_hash bytea,
  p_nom text,
  p_date_naissance date
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_patient_id uuid;
  v_org_id uuid;
begin
  -- Récupérer organization_id de la requête (sans exposer plus)
  select organization_id into v_org_id
  from public.patient_data_request
  where id = p_request_id;

  if v_org_id is null then
    return null;
  end if;

  -- Match exact NIR + nom (insensible casse + accents) + date naissance,
  -- scoped à l'org de la requête. archive=false (pas de match patient anonymisé).
  select id into v_patient_id
  from public.patients
  where organization_id = v_org_id
    and nir_search_hash = p_nir_search_hash
    and lower(public.unaccent_immutable(nom)) = lower(public.unaccent_immutable(p_nom))
    and date_naissance = p_date_naissance
    and archive = false
  limit 1;

  return v_patient_id;
end;
$$;

revoke all on function public.nir_match_patient_for_legal_request(uuid, bytea, text, date) from public;
grant execute on function public.nir_match_patient_for_legal_request(uuid, bytea, text, date) to authenticated, service_role;

comment on function public.nir_match_patient_for_legal_request(uuid, bytea, text, date) is
  'B-1 fix — Portail patient verifyIdentityAction. SECURITY DEFINER, scoped à l''org de la requête.';
