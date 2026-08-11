-- =============================================================================
-- Migration — cycle de vie de la facture CGSS (tiers payant), grain = transport
-- =============================================================================
-- G3 Lot 1 (périmètre A, suivi déclaratif). Pose le MODÈLE du suivi des factures
-- CGSS en tiers payant. Aucune UI, aucune action ici (lots suivants).
--
-- GRAIN = LA COURSE. La norme (retours NOEMIE) fonctionne par facture
-- individuelle (par transport) : le paiement / rejet arrive course par course,
-- pas pour un mois entier. Le statut porte donc sur la course, jamais sur la
-- période mensuelle.
--
-- PÉRIMÈTRE = CGSS PUR. Seules les courses en tiers payant CGSS pur
-- (`payment_status = 'non_concerne'`) suivent ce cycle. Les `a_encaisser` /
-- `encaisse` relèvent de l'encaissement direct (hors périmètre).
--
-- DOCTRINE D-09 STRICTE : AUCUN montant n'est stocké. Le suivi porte sur des
-- ÉTATS, des DATES d'événement et des MOTIFS — jamais des euros. Les montants
-- restent dérivés à la volée par `aggregateFacture`. La part complémentaire en
-- attente (`partiellement_payee`) est un FAIT BOOLÉEN, pas un montant.
--
-- FORME (choix documenté) :
--   • `rides.cgss_invoice_status` = ÉTAT COURANT (dénormalisé, requêtable /
--     indexable — le tableau de suivi du Lot 2 filtre par statut sans jointure) ;
--   • `ride_cgss_invoice_events` = HISTORIQUE append-only des retours (une ligne
--     par événement : télétransmission, ARL ±, retours NOEMIE, rejet…), qui gère
--     les RETRANSMISSIONS MULTIPLES (rejet → corriger → retransmettre → …). Le
--     statut courant est maintenu par l'application à l'enregistrement d'un
--     événement (transaction insert + update), lot suivant.
--
-- Additive et rétrocompatible : colonne nullable, table nouvelle, aucun DROP.
-- Facturation mensuelle / caisse / dashboard ne lisent pas ces champs → intacts.
-- =============================================================================

-- -- Section 1 — statut de cycle de vie (état courant sur la course) -----------
-- Séquence réglementaire normée (déduite des retours NOEMIE, non inventée) :
--   a_teletransmettre    facturable, pas encore envoyée (état d'entrée)
--   teletransmise        lot envoyé, en attente d'ARL
--   reception_confirmee  ARL positif (réception technique OK, ≠ validée)
--   rejet_technique      ARL négatif (lot rejeté techniquement → retransmettre)
--   en_traitement_caisse motif NOEMIE « Traitement Caisse » (2e retour attendu)
--   payee                retour NOEMIE paiement (toutes parts réglées)
--   rejetee              retour NOEMIE rejet (avec motif → corriger / retransmettre)
--   partiellement_payee  part obligatoire payée, part complémentaire en attente
alter table public.rides
  add column cgss_invoice_status text
    check (
      cgss_invoice_status is null
      or cgss_invoice_status in (
        'a_teletransmettre', 'teletransmise', 'reception_confirmee', 'rejet_technique',
        'en_traitement_caisse', 'payee', 'rejetee', 'partiellement_payee'
      )
    );

comment on column public.rides.cgss_invoice_status is
  'Statut du cycle de vie de la facture CGSS (tiers payant), par transport. NULL = hors cycle (course non facturable CGSS ou encaissement direct). Aucun montant (D-09).';

-- Cohérence : le cycle de vie CGSS ne concerne QUE les courses en tiers payant
-- CGSS pur (`payment_status = 'non_concerne'`). Une course encaissée en direct
-- ne porte jamais de statut de facture CGSS.
alter table public.rides
  add constraint rides_cgss_status_requires_cgss_pur check (
    cgss_invoice_status is null or payment_status = 'non_concerne'
  );

-- Les données existantes « prennent le défaut » : les courses déjà terminées en
-- CGSS pur entrent au premier état du cycle (à télétransmettre). Non destructif.
update public.rides
  set cgss_invoice_status = 'a_teletransmettre'
  where status = 'terminee'
    and payment_status = 'non_concerne'
    and archive = false
    and cgss_invoice_status is null;

-- Index partiel pour le futur tableau de suivi (Lot 2) : filtre par statut.
create index rides_cgss_invoice_status_idx
  on public.rides (cgss_invoice_status)
  where cgss_invoice_status is not null;

-- -- Section 2 — historique append-only des événements de facturation ----------
create table public.ride_cgss_invoice_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  ride_id uuid not null references public.rides(id) on delete cascade,
  -- Type d'événement du cycle (fait daté). Un rejet porte un motif.
  event_type text not null check (
    event_type in (
      'teletransmission', 'arl_positif', 'arl_negatif', 'traitement_caisse',
      'paiement', 'rejet', 'paiement_partiel'
    )
  ),
  event_date date not null,
  -- Motif de rejet (texte libre) + famille normée (classification exploitable).
  motif text check (motif is null or (length(motif) > 0 and length(motif) <= 500)),
  motif_famille text check (
    motif_famille is null
    or motif_famille in (
      'correction_metier', 'correction_parametrage', 'incident_technique',
      'dossier_caisse', 'ecart_amc_dre'
    )
  ),
  -- Part complémentaire (AMC) en attente pour `partiellement_payee` — FAIT
  -- BOOLÉEN, PAS un montant (D-09). Le montant reste dérivé par aggregateFacture.
  complementaire_en_attente boolean not null default false,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  -- Cohérence : un rejet (ARL négatif ou retour NOEMIE rejet) exige un motif.
  constraint ride_cgss_invoice_events_rejet_requires_motif check (
    event_type not in ('arl_negatif', 'rejet') or motif is not null
  ),
  -- Cohérence : la famille de motif ne s'applique qu'aux rejets.
  constraint ride_cgss_invoice_events_famille_only_on_rejet check (
    motif_famille is null or event_type in ('arl_negatif', 'rejet')
  )
);

comment on table public.ride_cgss_invoice_events is
  'Historique append-only des evenements de facturation CGSS par transport (retours NOEMIE, ARL, retransmissions). Etats/dates/motifs seulement, aucun montant (D-09).';
comment on column public.ride_cgss_invoice_events.complementaire_en_attente is
  'Part complementaire (AMC) en attente : fait booleen pour partiellement_payee. PAS un montant (D-09).';

create index ride_cgss_invoice_events_ride_idx
  on public.ride_cgss_invoice_events (ride_id, event_date);
create index ride_cgss_invoice_events_org_idx
  on public.ride_cgss_invoice_events (organization_id);

-- -- Section 3 — RLS (append-only : select + insert, pas d'update/delete) ------
-- Donnée financière sensible : lecture ET écriture réservées au régulateur /
-- dirigeant de l'organisation (le chauffeur n'y accède pas). Table append-only :
-- pas de policy UPDATE / DELETE → historique des retours immuable.
alter table public.ride_cgss_invoice_events enable row level security;
alter table public.ride_cgss_invoice_events force row level security;

create policy ride_cgss_invoice_events_select_regulateur on public.ride_cgss_invoice_events
  for select to authenticated
  using (
    organization_id = public.current_organization_id()
    and (
      public.has_role('regulateur'::public.user_role)
      or public.has_role('dirigeant'::public.user_role)
    )
  );

create policy ride_cgss_invoice_events_insert_regulateur on public.ride_cgss_invoice_events
  for insert to authenticated
  with check (
    organization_id = public.current_organization_id()
    and (
      public.has_role('regulateur'::public.user_role)
      or public.has_role('dirigeant'::public.user_role)
    )
  );
