-- =============================================================================
-- Migration 06.35 — Réglage organisation : mode de blocage conformité
-- =============================================================================
-- Ajoute la colonne `compliance_blocking_mode` à `organizations` pour
-- régler le comportement du contrôle conformité à la planification
-- (CdC §5.21 lot 3, DEC-114) :
--
--   - 'warn'  (défaut)  : avertissement visible, la régulatrice garde
--                         la main, assignation possible sous sa
--                         responsabilité (RETEX secteur : visibilité
--                         prime sur verrou).
--   - 'block'           : assignation refusée (manuel) ou entité
--                         exclue (optimiseur, via canal `excluded`).
--
-- Granularité GLOBALE par organisation (Q6) — pas de raffinement par
-- type d'échéance V1 (à reconsidérer si besoin émerge).
--
-- Pas de RLS supplémentaire (la table `organizations` a déjà ses
-- policies). L'UPDATE est réservé au dirigeant (defense in depth dans
-- la Server Action `updateComplianceBlockingModeAction`).
-- =============================================================================

alter table public.organizations
  add column compliance_blocking_mode text not null default 'warn'
    check (compliance_blocking_mode in ('warn', 'block'));

comment on column public.organizations.compliance_blocking_mode is
  'CdC §5.21 lot 3 : comportement du contrôle conformité à la planification — warn (défaut, souple) | block (dur). Réglé par le dirigeant dans /admin/conformite.';
