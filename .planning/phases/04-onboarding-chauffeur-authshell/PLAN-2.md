---
phase: 04-onboarding-chauffeur-authshell
plan: 2
wave: 1
order_in_wave: 1
depends_on: [1]
files_modified:
  - supabase/migrations/20260514000001_driver_invitations.sql
  - supabase/tests/driver_invitations_rls.sql
autonomous: true
requirements:
  - CHAUF-01
  - CHAUF-04
  - NFR-006
estimated_minutes: 45
covers_constraints:
  - C01
schema_push_required: true
---

# PLAN-2 — Migration BDD `driver_invitations` (table + RLS + trigger audit)

## Objectif

Créer la table `public.driver_invitations` dédiée au workflow
d'invitation chauffeur (DEC-025), avec ses 11 colonnes, son index
unique partiel (un seul `pending` actif par email), ses 4 policies RLS
strictes (SELECT invité+destinataire / INSERT dirigeant / UPDATE
destinataire pendant validité / DELETE interdit), et son trigger
d'audit alimentant `audit_logs`. Suivi obligatoire d'un **schema push
cloud** pour rendre la migration effective sur Supabase staging.

Aucun code TS touché — c'est purement SQL + tests pgTAP.

## Files modified

- `supabase/migrations/20260514000001_driver_invitations.sql` — nouvelle migration (à créer)
- `supabase/tests/driver_invitations_rls.sql` — tests pgTAP RLS (nouveau fichier)

## Tasks

### 2.1 Créer la migration `driver_invitations`

Fichier `supabase/migrations/20260514000001_driver_invitations.sql`,
calqué stylistiquement sur `20260512000001_drivers.sql` (sections
commentées, header en-tête refs). Contenu :

**Section 1 — Table**

```sql
create table public.driver_invitations (
  id              uuid primary key default extensions.uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  driver_id       uuid references public.drivers(id) on delete cascade,
  invited_by      uuid not null references auth.users(id) on delete restrict,
  email           text not null check (length(trim(email)) between 3 and 254),
  role            text not null default 'chauffeur' check (role in ('chauffeur')),
  status          text not null default 'pending'
    check (status in ('pending','accepted','expired','revoked')),
  expires_at      timestamptz not null default (now() + interval '24 hours'),
  accepted_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on table public.driver_invitations is
  'Invitations chauffeurs — workflow magic link Supabase. Phase 04 onboarding.';
```

**Section 2 — Index**

```sql
-- Index unique partiel : un seul pending actif par email
-- (empêche le dirigeant d'inviter 2× le même email tant que la 1ʳᵉ
-- invitation est en attente). Les invitations 'accepted' / 'expired' /
-- 'revoked' n'entrent pas dans la contrainte.
create unique index driver_invitations_pending_email_uniq
  on public.driver_invitations (email)
  where status = 'pending';

-- Index opérationnel : liste des invitations d'une organization par status
create index driver_invitations_org_status_idx
  on public.driver_invitations (organization_id, status);

-- Index opérationnel : retrouve l'invitation d'un driver (badge dans
-- drivers-list.client.tsx, Phase 04 §C02)
create index driver_invitations_driver_idx
  on public.driver_invitations (driver_id)
  where driver_id is not null;
```

**Section 3 — RLS forcée + 4 policies**

```sql
alter table public.driver_invitations enable row level security;
alter table public.driver_invitations force row level security;

-- SELECT : émetteur (dirigeant) OR destinataire (par email matché)
create policy driver_invitations_select_invited_or_recipient
  on public.driver_invitations
  for select to authenticated
  using (
    auth.uid() = invited_by
    or email = (select u.email from auth.users u where u.id = auth.uid())
  );

-- INSERT : dirigeant uniquement, même organization
create policy driver_invitations_insert_dirigeant
  on public.driver_invitations
  for insert to authenticated
  with check (
    organization_id = public.current_organization_id()
    and public.has_role('dirigeant'::public.user_role)
    and auth.uid() = invited_by
  );

-- UPDATE — 2 cas distincts, factorisés en une seule policy permissive :
--   a) destinataire pendant validité (acceptation)
--   b) dirigeant émetteur (revoke / resend → expires_at refresh)
create policy driver_invitations_update_recipient_or_dirigeant
  on public.driver_invitations
  for update to authenticated
  using (
    (
      email = (select u.email from auth.users u where u.id = auth.uid())
      and status = 'pending'
      and now() < expires_at
    )
    or (
      auth.uid() = invited_by
      and public.has_role('dirigeant'::public.user_role)
    )
  )
  with check (organization_id = public.current_organization_id());

-- Pas de policy DELETE — archivage logique via status='revoked'.
```

**Section 4 — Trigger updated_at**

Réutilise `public.set_updated_at()` existante :

```sql
create trigger driver_invitations_set_updated_at
  before update on public.driver_invitations
  for each row execute function public.set_updated_at();
```

**Section 5 — Trigger d'audit**

Pattern dérivé `drivers_audit_trigger` (alimente `audit_logs` avec
`to_jsonb(old/new)` intégral). Actions dérivées :

```sql
create or replace function public.driver_invitations_audit_trigger()
returns trigger language plpgsql security definer set search_path = public as $$
declare action_name text;
begin
  -- Mapping :
  --   INSERT                                  → driver_invited
  --   UPDATE (status: pending → accepted)     → driver_invitation_accepted
  --   UPDATE (status: pending → revoked)      → driver_invitation_revoked
  --   UPDATE (expires_at bumped, status pending) → driver_invitation_resent
  --   UPDATE autre                            → driver_invitation_updated
  if tg_op = 'INSERT' then
    action_name := 'driver_invited';
  elsif tg_op = 'UPDATE' then
    if new.status = 'accepted' and old.status = 'pending' then
      action_name := 'driver_invitation_accepted';
    elsif new.status = 'revoked' and old.status = 'pending' then
      action_name := 'driver_invitation_revoked';
    elsif new.status = 'pending' and new.expires_at > old.expires_at then
      action_name := 'driver_invitation_resent';
    else
      action_name := 'driver_invitation_updated';
    end if;
  else
    action_name := 'driver_invitation.' || lower(tg_op);
  end if;

  insert into public.audit_logs
    (organization_id, actor_id, actor_role, action, entity_type, entity_id, metadata)
  values (
    coalesce(new.organization_id, old.organization_id),
    auth.uid(), public.current_user_role(),
    action_name, 'driver_invitation', coalesce(new.id, old.id),
    jsonb_build_object(
      'old', case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) else null end,
      'new', case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) else null end
    )
  );
  return coalesce(new, old);
end; $$;

create trigger driver_invitations_audit_trigger
  after insert or update on public.driver_invitations
  for each row execute function public.driver_invitations_audit_trigger();
```

**Note** : l'event `cgu_accepted_via_invitation` (DEC-027) sera émis
**applicativement** par `acceptInvitationAction` (PLAN-3 §3.4), pas par
ce trigger — c'est un event sémantique RGPD séparé du UPDATE technique
sur `driver_invitations`.

**Section 6 — Revoke / Grant**

```sql
revoke all on public.driver_invitations from anon;
grant select, insert, update on public.driver_invitations to authenticated;
-- Pas de DELETE.
```

### 2.2 Tests pgTAP RLS

Fichier `supabase/tests/driver_invitations_rls.sql`, pattern existant
`supabase/tests/*.sql`. **6 tests minimum** :

1. `dirigeant peut INSERT invitation pour sa propre organization`
2. `dirigeant ne peut PAS INSERT invitation pour autre organization` (RLS bloque)
3. `chauffeur destinataire peut SELECT son invitation par match email`
4. `chauffeur destinataire peut UPDATE status='accepted' pendant validité`
5. `chauffeur destinataire ne peut PAS UPDATE après expires_at passé`
6. `unique index pending empêche 2ᵉ insert pending même email`

Ces tests tournent en CI (GitHub Actions `cd.yml` après schema push,
voir CLAUDE.md § 13.5 — pas en sandbox locale).

### 2.3 [BLOCKING] Schema push Supabase

**Cette tâche est NON-OPTIONNELLE.** Build TypeScript passe sans push
(les types `driver_invitations` ne sont pas encore consommés Wave 1),
créant un faux-positif. La phase ne peut pas atteindre Wave 2 (Server
Actions qui consomment la table) sans cette étape.

**Exécution** :

```bash
# Local : push manuel sur Supabase staging (preview)
SUPABASE_ACCESS_TOKEN=$SUPABASE_ACCESS_TOKEN \
  supabase db push --linked

# Vérif appliqué :
supabase migration list --linked
# → doit lister 20260514000001_driver_invitations comme APPLIED
```

**Alternative CI** : pousser le commit sur la branche, GitHub Action
`cd.yml` exécute automatiquement `supabase db push` au push sur main
(voir CLAUDE.md § 13.5 Phase 0.7 livrée 2026-05-07).

**Pour cette phase 04** : si on travaille sur une feature branch
`feat/04-onboarding-chauffeur`, on push manuellement avec
`supabase db push --linked` avant Wave 2, OU on merge sur main au plus
tôt pour bénéficier de l'auto-push CD.

**Vérification post-push** :

```bash
# Via MCP Supabase ou psql staging :
SELECT count(*) FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name = 'driver_invitations';
-- Doit retourner 1.

SELECT count(*) FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'driver_invitations';
-- Doit retourner 3 (select / insert / update).
```

### 2.4 (Optionnel — reporté Phase 04.5) `pnpm db:types` régénération

Reporté Phase 04.5 conformément à C10 (Q5.1 indirectement). Les Server
Actions Wave 2 utiliseront `'driver_invitations' as never` côté
`.from()` (pattern actuel `actions.ts` ligne 71), évitant la
régénération de types ce sprint.

### 2.5 Commit unique

Message :

```
feat(04): migration driver_invitations + RLS + trigger audit (C01)

- Table public.driver_invitations 11 colonnes (organization_id, driver_id,
  invited_by, email, role, status, expires_at, accepted_at, timestamps)
- Index unique partiel (email) WHERE status='pending' : empêche doublon
- 3 policies RLS strictes : SELECT invited_or_recipient, INSERT dirigeant
  same org, UPDATE recipient_during_validity_or_dirigeant
- Trigger audit_logs : driver_invited / _accepted / _revoked / _resent
- Pas de DELETE policy (archivage logique status='revoked')
- 6 tests pgTAP RLS dans supabase/tests/driver_invitations_rls.sql
- Schema push appliqué sur staging (verifié via supabase migration list)

Réfs : Phase 04 § PLAN-2, DEC-025, C01, ADR-002 multi-tenant RLS.
```

## Traçabilité contraintes

| Contrainte | Traitement dans ce plan |
|---|---|
| **C01** (Migration BDD `driver_invitations` : table + RLS + index unique pending + trigger audit) | PLAN-2 §2.1 (migration SQL complète) + §2.2 (6 tests pgTAP RLS) + §2.3 (schema push BLOCKING) |

Couvre intégralement C01. Les autres contraintes ne touchent pas la
couche BDD pure.

## Threat model

ASVS L1 + RLS hardening :

| Threat | Risk | Mitigation |
|---|---|---|
| **Cross-tenant data leak** (chauffeur org A voit invitation org B) | HIGH (données salarié + email + workflow auth) | Policy SELECT contrainte sur `auth.uid() = invited_by OR email = auth.users(uid).email` ; INSERT contrainte sur `organization_id = current_organization_id()` ; FORCE RLS active (pas de bypass par owner). |
| **Privilege escalation** (régulateur ou chauffeur invite un autre chauffeur) | HIGH (gouvernance org) | Policy INSERT contrainte sur `has_role('dirigeant')` ; pattern `requireDirigeant()` côté Server Action en defense in depth (PLAN-3 §3.2). |
| **Token reuse / replay** (chauffeur réutilise un magic link déjà consommé) | MEDIUM | Token = JWT Supabase géré côté `auth` schema (hors notre table). Notre table trace `status='accepted'` + `accepted_at` : la policy UPDATE refuse `status='pending'` après acceptation (déjà accepté → policy `status='pending'` faux → UPDATE rejeté). |
| **DELETE forensique** (dirigeant efface trace d'invitation litigieuse) | MEDIUM | Pas de policy DELETE + grant sans DELETE. Status `revoked` documente l'annulation sans perdre la trace audit. |
| **Race condition double-invite** (dirigeant double-click) | LOW | Index unique partiel `(email) WHERE status='pending'` → la 2ᵉ INSERT échoue. Server Action attrape l'erreur (PLAN-3 §3.2). |
| **Audit gap** (action non tracée) | HIGH (RGPD santé) | Trigger `driver_invitations_audit_trigger` AFTER INSERT/UPDATE émet 1 ligne `audit_logs` par event. Pas de path d'écriture qui contourne le trigger (DELETE absent). |
| **TOCTOU expiry** (acceptation après expires_at via clock skew) | LOW | Policy UPDATE contrôle `now() < expires_at` côté Postgres (horloge serveur, pas client). Tolérance NTP < 100 ms ignorable. |

ASVS L1 V4.1 (RLS), V8.3 (audit logging), V10.3 (privilege separation) : conforme.

## Verification

- `supabase migration list --linked` montre la migration `APPLIED`.
- `supabase test db` exécute les 6 tests pgTAP avec 6 PASS.
- Manuel via MCP Supabase :
  - Connexion en tant que dirigeant test → INSERT invitation OK.
  - Connexion en tant que régulateur test → INSERT invitation → erreur RLS attendue.
  - Insertion doublon pending → erreur unique constraint attendue.

## Success criteria (extrait des 11 SC phase)

Préparation matérielle pour :
- SC #4 (`audit_logs` 4 events cohérents) — trigger en place
- SC #8 (token expiré → panneau erreur) — colonne `expires_at` exploitable
- SC #9 (email déjà utilisé autre rôle → refus) — index unique +
  Server Action complémentaire (PLAN-3)

## Output

Note dans `04-SUMMARY.md` final § PLAN-2 : nombre de policies posées,
résultat tests pgTAP CI, statut schema push.
