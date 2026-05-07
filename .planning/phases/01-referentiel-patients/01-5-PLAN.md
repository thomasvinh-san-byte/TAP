---
phase: 01-referentiel-patients
plan: 5
type: execute
wave: 3
depends_on: [2, 3, 4]
files_modified:
  - apps/web/src/app/(app)/patients/page.tsx
  - apps/web/src/app/(app)/patients/_components/patients-list.client.tsx
  - apps/web/src/app/(app)/patients/_components/patient-search.client.tsx
  - apps/web/src/app/(app)/patients/_components/patient-drawer.client.tsx
  - apps/web/src/app/(app)/patients/_components/patient-nir-display.client.tsx
  - apps/web/src/app/(app)/patients/_components/patient-form.client.tsx
  - apps/web/src/app/(app)/patients/_components/patient-form-note.client.tsx
  - apps/web/src/app/(app)/patients/_components/patient-form-constraints.client.tsx
  - apps/web/src/app/(app)/patients/[id]/page.tsx
  - apps/web/src/app/(app)/patients/[id]/edit/page.tsx
  - apps/web/src/app/(app)/patients/new/page.tsx
  - apps/web/src/app/(app)/patients/actions.ts
  - apps/web/src/app/(app)/patients/queries.ts
  - apps/web/src/lib/nir-client.ts
  - apps/web/src/lib/utils.ts
  - packages/shared/src/utils/patient-note.ts
  - packages/shared/src/utils/__tests__/patient-note.test.ts
autonomous: true
requirements:
  - PAT-01
  - PAT-03
  - PAT-04
  - PAT-05
  - PAT-06
  - PAT-07
must_haves:
  truths:
    - "La page /patients liste 20 patients de l'organisation par défaut, triés par nom, ordre alphabétique"
    - "La recherche fuzzy se déclenche à 2 caractères, debounce 150 ms, top 10 triés par similarity desc"
    - "Cliquer sur un résultat ouvre un drawer Sheet de largeur exacte 400 px à droite"
    - "Le drawer affiche en-tête → identité (NIR masqué `1•••••••••76 23`) → coordonnées → préférences → contraintes → note opérationnelle active"
    - "Bouton 'Afficher le NIR complet' déchiffre via Edge Function nir et insère 1 ligne audit_logs action='patient.nir.decrypt'"
    - "La page /patients/[id]/edit utilise react-hook-form + zodResolver(patientSchema) avec mode édition explicite"
    - "Toute mutation (create / update) écrit une ligne dans audit_logs (via trigger Postgres) sans NIR clair dans metadata"
    - "Le test E2E patient-flow.spec.ts (PLAN-1) passe en GREEN intégralement"
  artifacts:
    - path: apps/web/src/app/(app)/patients/page.tsx
      provides: "RSC liste patients avec HydrationBoundary + prefetch"
      min_lines: 30
    - path: apps/web/src/app/(app)/patients/_components/patients-list.client.tsx
      provides: "Liste + recherche fuzzy + skeleton + ouverture drawer"
      min_lines: 90
    - path: apps/web/src/app/(app)/patients/_components/patient-drawer.client.tsx
      provides: "Drawer 400 px avec 6 blocs ordonnés"
      min_lines: 100
    - path: apps/web/src/app/(app)/patients/_components/patient-form.client.tsx
      provides: "Formulaire react-hook-form (création + édition)"
      min_lines: 130
    - path: apps/web/src/app/(app)/patients/actions.ts
      provides: "Server Actions createPatient + updatePatient + decryptNir"
      min_lines: 80
    - path: apps/web/src/app/(app)/patients/queries.ts
      provides: "searchPatients + getPatient (RSC + client)"
      min_lines: 40
    - path: apps/web/src/lib/nir-client.ts
      provides: "Wrapper supabase.functions.invoke('nir', ...) typé"
      min_lines: 30
  key_links:
    - from: apps/web/src/app/(app)/patients/_components/patients-list.client.tsx
      to: searchPatients
      via: useQuery + useDeferredValue
      pattern: "useDeferredValue|useQuery"
    - from: apps/web/src/app/(app)/patients/_components/patient-drawer.client.tsx
      to: SheetContent
      via: Sheet shadcn
      pattern: "w-\\[400px\\]"
    - from: apps/web/src/app/(app)/patients/actions.ts
      to: supabase.functions.invoke('nir')
      via: createPatient + updatePatient + decryptNir
      pattern: "functions.invoke.*nir"
    - from: apps/web/src/app/(app)/patients/_components/patient-nir-display.client.tsx
      to: decryptNir Server Action
      via: button click
      pattern: "Afficher le NIR"
---

<objective>
Greffer sur le scaffold `apps/web` (PLAN-4) la totalité de l'UI patient : page liste avec recherche fuzzy debounce 150 ms, drawer 400 px à 6 blocs, page complète, formulaire edit + create, avec wiring vers Edge Function NIR (PLAN-3) et migrations 003 (PLAN-2). Faire passer le test E2E `patient-flow.spec.ts` du PLAN-1 en GREEN.

Purpose: clore la phase 1 en livrant tous les points d'entrée régulatrice. Une fois ce plan mergé, le référentiel patients est consommable par la Phase 2 (saisie express référence un patient existant).

Output: ~12 fichiers UI + Server Actions + queries + wrapper NIR client. Test E2E vert.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/phases/01-referentiel-patients/01-CONTEXT.md
@.planning/phases/01-referentiel-patients/01-RESEARCH.md
@.planning/phases/01-referentiel-patients/01-PATTERNS.md
@CLAUDE.md
@apps/web/e2e/patient-flow.spec.ts
@packages/shared/src/validators/patient.ts
@packages/shared/src/validators/patient-constraint.ts
@packages/shared/src/validators/patient-note.ts
@apps/web/src/lib/utils.ts
@apps/web/src/lib/supabase/server.ts
@apps/web/src/lib/supabase/client.ts

<interfaces>
<!-- Validators (PLAN-2) -->
patientSchema           : { prenom, nom, date_naissance, genre?, telephone?, nir?, adresse, contact_urgence?, canal_contact_prefere, consentement_sms, consentement_sms_at?, notes_operationnelles?, archive }
PatientInput            : z.infer<typeof patientSchema>
patientConstraintInputSchema : { patient_id, type: PatientConstraintType, note? }
patientOperationalNoteInputSchema : { patient_id, content }
normalizeNir(input)     : string (suppression espaces, uppercase)
normalizePhone(input)   : string

<!-- Edge Function NIR (PLAN-3) -->
POST /functions/v1/nir { action:'encrypt', nir }                 → { encrypted: base64 }
POST /functions/v1/nir { action:'decrypt', encrypted, patientId } → { nir } + audit insert
POST /functions/v1/nir { action:'hash', nir }                    → { hash: base64 }

<!-- Tables Postgres (PLAN-2) -->
public.patients (id, organization_id, prenom, nom, date_naissance, genre, telephone, telephone_normalized, adresse_*, code_postal, ville, contact_urgence_*, nir_encrypted, nir_search_hash, canal_contact_prefere, consentement_sms, consentement_sms_at, archive, search_text, created_at, updated_at, created_by)
public.patient_constraint (id, organization_id, patient_id, type, note, created_at, created_by)
public.patient_operational_note (id, organization_id, patient_id, content, author_id, replaced_by_id, created_at, updated_at)

<!-- E2E à satisfaire (PLAN-1 — patient-flow.spec.ts) -->
- Création via /patients/new : labels exacts "Nom", "Prénom", "Date de naissance", "NIR", "Adresse", "Code postal", "Ville", bouton "Créer"
- Recherche /patients : placeholder "Rechercher", 1 char ne déclenche rien, 2 chars → résultats < 1s
- Drawer : role="dialog", largeur 400 px exacte (boundingBox), texte "Hoarau Patrick" cliquable, regex NIR `1•••••••••\d{2}\s*\d{2}`, lien "Voir la fiche complète"
- Edit : link "Modifier", select "Canal préféré" valeur 'sms', checkbox "Consentement SMS", bouton "Enregistrer"
- Audit : audit_logs.action='patient.update', metadata.new sans nir_encrypted
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Tâche 1 : Server Actions + queries + wrapper Edge Function NIR client</name>
  <files>apps/web/src/app/(app)/patients/actions.ts, apps/web/src/app/(app)/patients/queries.ts, apps/web/src/lib/nir-client.ts</files>
  <read_first>
    - /home/user/TAP/.planning/phases/01-referentiel-patients/01-RESEARCH.md (lignes 296-345 pattern RSC + queries ; lignes 422-437 pattern Server Action)
    - /home/user/TAP/.planning/phases/01-referentiel-patients/01-PATTERNS.md (lignes 657-687 — pattern Server Actions create)
    - /home/user/TAP/CLAUDE.md (§ 10 — séquence Validation zod → Autorisation → Transaction → Audit log → Réponse)
    - /home/user/TAP/packages/shared/src/validators/patient.ts (patientSchema + helpers normalisation)
    - /home/user/TAP/apps/web/e2e/patient-flow.spec.ts (les chemins HTTP attendus)
    - /home/user/TAP/supabase/migrations/20260507000002_search_patients_rpc.sql (RPC `search_patients(q text)` déjà créée par PLAN-2 en Wave 1 — à consommer via `supabase.rpc('search_patients', { q })`)
    - /home/user/TAP/supabase/migrations/ (vue `patients_safe` créée par PLAN-2 ; `nir_last4` exposé en clair, `nir_encrypted` et `nir_search_hash` exclus)
  </read_first>
  <behavior>
  - Test : `searchPatients('h')` (1 char) retourne `[]` sans aller en base
  - Test : `searchPatients('ho')` exécute `select id, nom, prenom, telephone, similarity(...) from patients where search_text % 'ho' order by score desc limit 10` (vérifié via mock supabase ou test d'intégration sur DB locale)
  - Test : `createPatient({ ...valid, nir: '180...' })` appelle l'Edge Function `nir` 2 fois (encrypt + hash) puis INSERT puis revalidatePath('/patients')
  - Test : `updatePatient(id, { canal_contact_prefere: 'sms', consentement_sms: true, consentement_sms_at: ... })` UPDATE + revalidate
  - Test : `decryptNirAction(patientId, encryptedB64)` appelle Edge Function decrypt qui insère 1 ligne audit_logs côté Edge Function
  </behavior>
  <action>
**apps/web/src/lib/nir-client.ts** (≥ 30 lignes) :
```ts
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@tap/database';

// Réponse alignée sur le contrat de l'Edge Function PLAN-3 :
// l'action `encrypt` calcule encrypt + hash + nir_last4 en un seul appel,
// le Server Action persiste les 3 colonnes dans le même UPDATE (W-1 fix).
interface EncryptResponse {
  nir_encrypted: string;
  nir_search_hash: string;
  nir_last4: string;          // format "XX YY" (clair, non secret)
}
interface DecryptResponse { nir: string }

export async function encryptAndHashNir(
  supabase: SupabaseClient<Database>,
  nir: string,
): Promise<EncryptResponse> {
  const { data, error } = await supabase.functions.invoke<EncryptResponse>('nir', {
    body: { action: 'encrypt', nir },
  });
  if (error || !data) throw new Error('Chiffrement NIR impossible');
  return data;
}

export async function decryptNir(supabase: SupabaseClient<Database>, encrypted: string, patientId: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke<DecryptResponse>('nir', { body: { action: 'decrypt', encrypted, patientId } });
  if (error || !data) throw new Error('NIR illisible');
  return data.nir;
}
```

**apps/web/src/app/(app)/patients/queries.ts** (≥ 40 lignes — utilisé en RSC ET en client via `searchPatients`) :
```ts
import { createClient } from '@/lib/supabase/server';

export interface PatientListItem {
  id: string;
  nom: string;
  prenom: string;
  telephone: string | null;
  canal_contact_prefere: 'sms' | 'appel' | 'aucun';
  archive: boolean;
}

export async function searchPatients(query: string): Promise<PatientListItem[]> {
  // Garde côté serveur : recherche < 2 chars retourne vide pour aligner avec UI (D-10).
  const trimmed = query.trim();
  if (trimmed.length > 0 && trimmed.length < 2) return [];

  const supabase = createClient();
  let q = supabase
    .from('patients')
    .select('id, nom, prenom, telephone, canal_contact_prefere, archive')
    .eq('archive', false)
    .order('nom', { ascending: true })
    .limit(20);

  if (trimmed.length >= 2) {
    // pg_trgm match : utilise l'opérateur `%` via .textSearch n'est pas supporté ; on utilise rpc('search_patients', { q })
    // Voir pattern RESEARCH.md §2 — alternative : utiliser .ilike sur search_text avec wildcards et compter sur l'index trigramme (PG ≥ 9.1).
    q = q.ilike('search_text', `%${trimmed.toLowerCase()}%`).limit(10);
  }
  const { data, error } = await q;
  if (error) throw new Error('Recherche impossible');
  return data ?? [];
}

export async function getPatientById(id: string) {
  const supabase = createClient();
  // CRITIQUE — sécurité B-5 : on lit la VUE `patients_safe`, pas la table `patients`.
  // La vue exclut `nir_encrypted` et `nir_search_hash` ; elle expose `nir_last4` (clair, non secret)
  // et `has_nir: boolean`. Aucune trace de ciphertext NIR ne doit traverser le réseau jusqu'au browser.
  const { data, error } = await supabase
    .from('patients_safe')
    .select(`
      id, organization_id, prenom, nom, date_naissance, genre, telephone, adresse_ligne1, adresse_ligne2,
      code_postal, ville, contact_urgence_nom, contact_urgence_telephone,
      nir_last4, has_nir,
      canal_contact_prefere, consentement_sms, consentement_sms_at, archive, created_at, updated_at,
      patient_constraint(id, type, note, created_at),
      patient_operational_note!patient_operational_note_patient_id_fkey(id, content, author_id, replaced_by_id, created_at)
    `)
    .eq('id', id)
    .is('patient_operational_note.replaced_by_id', null)
    .single();
  if (error) throw new Error('Patient introuvable');
  return data;
}

// Type partagé : tout composant client consomme ce type, JAMAIS `Database['public']['Tables']['patients']['Row']`.
// export type PatientSafeRow = Database['public']['Views']['patients_safe']['Row'];
```

**Note sur `ilike '%q%'` vs opérateur `%` pg_trgm :** `supabase-js` ne wrap pas l'opérateur `%`. La RPC Postgres `search_patients(q text)` (qui utilise `where search_text % q`) est **déjà créée par PLAN-2 (Wave 1)** dans `supabase/migrations/20260507000002_search_patients_rpc.sql`. PLAN-5 se contente de la **consommer** :
```ts
const { data } = await supabase.rpc('search_patients', { q: trimmed });
```

Cette RPC est exposée à `authenticated` uniquement, est `security invoker` (RLS s'applique au caller) et filtre via `current_organization_id()`. Aucune migration à créer dans PLAN-5.

**apps/web/src/app/(app)/patients/actions.ts** (≥ 80 lignes) :
```ts
'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { patientSchema, normalizePhone } from '@tap/shared';
import { createClient } from '@/lib/supabase/server';
import { encryptAndHashNir, decryptNir as decryptNirEdge } from '@/lib/nir-client';

export type ActionState = { error?: string; success?: boolean };

export async function createPatientAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const raw = Object.fromEntries(formData.entries());
  const parsed = patientSchema.safeParse({
    ...raw,
    consentement_sms: raw.consentement_sms === 'on',
    archive: false,
    adresse: {
      ligne1: raw.adresse_ligne1, ligne2: raw.adresse_ligne2 || undefined,
      code_postal: raw.code_postal, ville: raw.ville,
    },
  });
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  const supabase = createClient();
  const data = parsed.data;
  // W-1 fix : un SEUL appel à l'Edge Function ; persistance atomique des 3 colonnes
  let nirEncrypted: Buffer | null = null;
  let nirHash: Buffer | null = null;
  let nirLast4: string | null = null;
  if (data.nir) {
    const enc = await encryptAndHashNir(supabase, data.nir);
    nirEncrypted = Buffer.from(enc.nir_encrypted, 'base64');
    nirHash = Buffer.from(enc.nir_search_hash, 'base64');
    nirLast4 = enc.nir_last4;             // "XX YY", clair non secret (cf. ADR-004 placeholder)
  }

  const { data: row, error } = await supabase.from('patients').insert({
    prenom: data.prenom, nom: data.nom, date_naissance: data.date_naissance,
    genre: data.genre ?? null,
    telephone: data.telephone ?? null,
    telephone_normalized: data.telephone ? normalizePhone(data.telephone) : null,
    adresse_ligne1: data.adresse.ligne1, adresse_ligne2: data.adresse.ligne2 ?? null,
    code_postal: data.adresse.code_postal, ville: data.adresse.ville,
    contact_urgence_nom: data.contact_urgence?.nom ?? null,
    contact_urgence_telephone: data.contact_urgence?.telephone ?? null,
    nir_encrypted: nirEncrypted,
    nir_search_hash: nirHash,
    nir_last4: nirLast4,
    canal_contact_prefere: data.canal_contact_prefere,
    consentement_sms: data.consentement_sms,
    consentement_sms_at: data.consentement_sms_at ?? null,
    archive: false,
  } as never).select('id').single();

  if (error) return { error: 'Création impossible (un patient avec ce NIR existe peut-être déjà).' };
  revalidatePath('/patients');
  redirect(`/patients/${row!.id}`);
}

export async function updatePatientAction(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const raw = Object.fromEntries(formData.entries());
  const parsed = patientSchema.partial().safeParse({
    ...raw,
    consentement_sms: raw.consentement_sms === 'on',
  });
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  const supabase = createClient();
  const update: Record<string, unknown> = { ...parsed.data };
  // Si l'utilisateur active consentement_sms et n'a pas fourni de timestamp, on horodate ici.
  if (update.consentement_sms === true && !update.consentement_sms_at) {
    update.consentement_sms_at = new Date().toISOString();
  }
  delete (update as Record<string, unknown>).adresse;

  // W-1 fix : si le NIR clair est fourni, le chiffrer et persister les 3 colonnes atomiquement.
  // Le NIR clair ne doit JAMAIS arriver tel quel dans l'UPDATE Postgres.
  if (typeof parsed.data.nir === 'string' && parsed.data.nir.length > 0) {
    const enc = await encryptAndHashNir(supabase, parsed.data.nir);
    update.nir_encrypted = Buffer.from(enc.nir_encrypted, 'base64');
    update.nir_search_hash = Buffer.from(enc.nir_search_hash, 'base64');
    update.nir_last4 = enc.nir_last4;
  }
  delete (update as Record<string, unknown>).nir;     // jamais le NIR clair en UPDATE

  const { error } = await supabase.from('patients').update(update as never).eq('id', id);
  if (error) return { error: 'Modification impossible.' };
  revalidatePath('/patients');
  revalidatePath(`/patients/${id}`);
  redirect(`/patients/${id}`);
}

export async function decryptNirAction(patientId: string): Promise<{ nir: string } | { error: string }> {
  const supabase = createClient();
  const { data: row, error: e1 } = await supabase
    .from('patients').select('nir_encrypted').eq('id', patientId).single();
  if (e1 || !row?.nir_encrypted) return { error: 'NIR introuvable.' };
  // bytea de Postgres revient en string hex (`\\x...`) ou en base64 selon le client ; convertir.
  const encryptedB64 = Buffer.isBuffer(row.nir_encrypted)
    ? Buffer.from(row.nir_encrypted as Uint8Array).toString('base64')
    : Buffer.from((row.nir_encrypted as string).replace(/^\\x/, ''), 'hex').toString('base64');
  try {
    const nir = await decryptNirEdge(supabase, encryptedB64, patientId);
    return { nir };
  } catch {
    return { error: 'NIR illisible.' };
  }
}
```

**Conventions strictes :**
- Aucun `console.log`
- Aucun NIR dans les messages d'erreur retournés
- Toutes les actions retournent un type `ActionState` discriminé sauf `decryptNirAction` qui retourne le NIR ou une erreur (consommé par bouton « Afficher »)
- `revalidatePath` après chaque mutation
- TypeScript strict, le cast `as never` ou `as Record<...>` est documenté en commentaire si nécessaire (Supabase types stricts vs partial update)
  </action>
  <verify>
    <automated>cd /home/user/TAP &amp;&amp; pnpm db:reset 2&gt;&amp;1 | tail -5 &amp;&amp; pnpm typecheck 2&gt;&amp;1 | tail -10 &amp;&amp; pnpm -C apps/web build 2&gt;&amp;1 | tail -10</automated>
  </verify>
  <acceptance_criteria>
    - `wc -l apps/web/src/app/(app)/patients/actions.ts` ≥ 80
    - `wc -l apps/web/src/app/(app)/patients/queries.ts` ≥ 40
    - `wc -l apps/web/src/lib/nir-client.ts` ≥ 30
    - `test -f supabase/migrations/20260507000002_search_patients_rpc.sql` (créé par PLAN-2 Wave 1, vérifié ici uniquement comme dépendance)
    - `grep -c "supabase.rpc('search_patients'" apps/web/src/app/(app)/patients/queries.ts` == 1
    - `grep -c "trimmed.length < 2" apps/web/src/app/(app)/patients/queries.ts` == 1 (garde 2 chars côté serveur)
    - `grep -cE "from\\(['\"]patients_safe['\"]\\)" apps/web/src/app/(app)/patients/queries.ts` ≥ 1 (B-5 : `getPatientById` consomme la vue)
    - `! grep -rE "nir_encrypted|nir_search_hash" apps/web/src/app/(app)/patients/` (B-5 : zéro référence aux colonnes ciphertext dans l'UI patients)
    - `grep -c "functions.invoke" apps/web/src/lib/nir-client.ts` == 3
    - `grep -c "patient.nir.decrypt\\|decryptNir" apps/web/src/app/(app)/patients/actions.ts apps/web/src/lib/nir-client.ts` ≥ 2
    - `grep -c "revalidatePath" apps/web/src/app/(app)/patients/actions.ts` ≥ 3
    - `! grep -E "console\\.(log|error|warn)" apps/web/src/app/(app)/patients/actions.ts apps/web/src/lib/nir-client.ts apps/web/src/app/(app)/patients/queries.ts`
    - `pnpm db:reset && pnpm typecheck && pnpm -C apps/web build` exit 0
  </acceptance_criteria>
  <done>Server Actions create/update/decrypt + queries searchPatients/getPatientById + wrapper NIR client + RPC search_patients fonctionnels et typés.</done>
</task>

<task type="auto" tdd="true">
  <name>Tâche 2 : Page liste + composant recherche fuzzy + drawer 400 px + affichage NIR masqué</name>
  <files>apps/web/src/app/(app)/patients/page.tsx, apps/web/src/app/(app)/patients/_components/patients-list.client.tsx, apps/web/src/app/(app)/patients/_components/patient-search.client.tsx, apps/web/src/app/(app)/patients/_components/patient-drawer.client.tsx, apps/web/src/app/(app)/patients/_components/patient-nir-display.client.tsx</files>
  <read_first>
    - /home/user/TAP/.planning/phases/01-referentiel-patients/01-RESEARCH.md (lignes 296-322 RSC + HydrationBoundary ; 329-344 useDeferredValue)
    - /home/user/TAP/.planning/phases/01-referentiel-patients/01-PATTERNS.md (lignes 561-654 — patterns liste, drawer)
    - /home/user/TAP/.planning/phases/01-referentiel-patients/01-CONTEXT.md (D-12 drawer, D-14 ordre des blocs, lignes 226-240 spécifiques UI)
    - /home/user/TAP/apps/web/e2e/patient-flow.spec.ts (contrats de test exacts)
    - /home/user/TAP/CLAUDE.md (§ 1 piliers, § 5 règles UX, § 11 anti-patterns)
  </read_first>
  <behavior>
  - Test E2E PLAN-1 cas recherche : `search.fill('h')` → 0 résultat affiché ; `search.fill('ho')` → "Hoarau Patrick" visible < 1s
  - Test E2E PLAN-1 cas drawer : `boundingBox.width === 400`, NIR au format `1•••••••••XX YY`, lien "Voir la fiche complète"
  - Test E2E PLAN-1 cas display NIR : bouton "Afficher le NIR complet" → après clic, NIR clair visible, audit_logs reçoit 1 ligne `patient.nir.decrypt`
  </behavior>
  <action>
**apps/web/src/app/(app)/patients/page.tsx** (≥ 30 lignes — RSC avec HydrationBoundary) :
```tsx
import Link from 'next/link';
import { HydrationBoundary, dehydrate, QueryClient } from '@tanstack/react-query';
import { searchPatients } from './queries';
import { PatientsList } from './_components/patients-list.client';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

export const metadata = { title: 'Patients — TAP Régulation' };

export default async function PatientsPage() {
  const queryClient = new QueryClient();
  await queryClient.prefetchQuery({
    queryKey: ['patients', { q: '' }],
    queryFn: () => searchPatients(''),
  });

  return (
    <div className="space-y-24">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Patients</h1>
        <Button asChild>
          <Link href="/patients/new"><Plus className="mr-8 h-16 w-16" />Nouveau patient</Link>
        </Button>
      </header>
      <HydrationBoundary state={dehydrate(queryClient)}>
        <PatientsList />
      </HydrationBoundary>
    </div>
  );
}
```

**apps/web/src/app/(app)/patients/_components/patient-search.client.tsx** (≥ 35 lignes) :
```tsx
'use client';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';

export function PatientSearch({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative">
      <Search className="absolute left-12 top-1/2 -translate-y-1/2 h-16 w-16 text-muted-foreground" aria-hidden />
      <Input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Rechercher (nom, prénom, téléphone)…"
        className="pl-32 h-48"
        aria-label="Rechercher un patient"
        autoFocus
      />
    </div>
  );
}
```

**apps/web/src/app/(app)/patients/_components/patients-list.client.tsx** (≥ 90 lignes) :
```tsx
'use client';
import { useState, useDeferredValue } from 'react';
import { useQuery } from '@tanstack/react-query';
import { searchPatientsAction } from '../actions';   // wrapper Server Action exporté pour le client
import { PatientSearch } from './patient-search.client';
import { PatientDrawer } from './patient-drawer.client';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

interface PatientListItem {
  id: string; nom: string; prenom: string;
  telephone: string | null; canal_contact_prefere: 'sms'|'appel'|'aucun';
}

export function PatientsList() {
  const [q, setQ] = useState('');
  const dq = useDeferredValue(q);
  const [openId, setOpenId] = useState<string | null>(null);

  const { data, isPending } = useQuery({
    queryKey: ['patients', { q: dq }],
    queryFn: () => searchPatientsAction(dq),
    // 1 char ne déclenche jamais : enabled=false dans l'intervalle
    enabled: dq.length === 0 || dq.length >= 2,
    placeholderData: (prev) => prev,
    staleTime: 5_000,
  });

  return (
    <div className="space-y-16">
      <PatientSearch value={q} onChange={setQ} />
      {q.length === 1 && (
        <p className="text-sm text-muted-foreground">Tapez au moins 2 caractères pour lancer la recherche.</p>
      )}
      {isPending && !data && (
        <ul className="space-y-8">{Array.from({ length: 5 }).map((_, i) => <li key={i}><Skeleton className="h-48 w-full" /></li>)}</ul>
      )}
      {data && data.length === 0 && q.length >= 2 && (
        <p className="text-muted-foreground">Aucun patient ne correspond à « {q} ».</p>
      )}
      {data && data.length > 0 && (
        <ul className="divide-y rounded-md border">
          {data.map((p: PatientListItem) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => setOpenId(p.id)}
                className="w-full text-left flex items-center justify-between px-16 py-12 hover:bg-muted transition"
              >
                <span className="font-medium">{p.nom} {p.prenom}</span>
                <span className="flex items-center gap-12 text-sm text-muted-foreground">
                  {p.telephone}
                  <Badge variant="secondary">{p.canal_contact_prefere}</Badge>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <PatientDrawer patientId={openId} open={openId !== null} onOpenChange={(o) => !o && setOpenId(null)} />
    </div>
  );
}
```

**Note importante** : `searchPatientsAction` doit être exposé comme Server Action (cf. tâche 1, ajouter en bas de `actions.ts` :
```ts
export async function searchPatientsAction(q: string) {
  return searchPatients(q); // re-export du query côté serveur ; appelable depuis Client Component via Server Action
}
```
)

**apps/web/src/app/(app)/patients/_components/patient-nir-display.client.tsx** (≥ 30 lignes — bouton afficher / masquer le NIR) :
```tsx
'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Eye, EyeOff } from 'lucide-react';
import { decryptNirAction } from '../actions';
import { toast } from 'sonner';

interface Props { patientId: string; maskedNir: string }

export function PatientNirDisplay({ patientId, maskedNir }: Props) {
  const [revealed, setRevealed] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleReveal() {
    setLoading(true);
    const res = await decryptNirAction(patientId);
    setLoading(false);
    if ('error' in res) { toast.error(res.error); return; }
    setRevealed(res.nir);
    toast.success('NIR affiché. Action consignée dans l\'audit.');
  }

  return (
    <div className="flex items-center gap-12">
      <code className="font-mono text-base">{revealed ?? maskedNir}</code>
      {revealed === null ? (
        <Button variant="ghost" size="sm" onClick={handleReveal} disabled={loading}>
          <Eye className="mr-8 h-16 w-16" />{loading ? 'Déchiffrement…' : 'Afficher le NIR complet'}
        </Button>
      ) : (
        <Button variant="ghost" size="sm" onClick={() => setRevealed(null)}>
          <EyeOff className="mr-8 h-16 w-16" />Masquer
        </Button>
      )}
    </div>
  );
}
```

**Helper masquage NIR** — créer dans `apps/web/src/lib/utils.ts` (à la fin du fichier existant). **B-6 follow-up : ne PRENDS plus le NIR clair en entrée, prend `nir_last4` issu de la vue `patients_safe` (clair, non secret)** :
```ts
export function maskNir(nir_last4: string | null | undefined): string {
  // `nir_last4` est exposé en clair par la vue `patients_safe` (PLAN-2). Format DB : "XX YY"
  // (2 derniers chiffres du numéro + espace + clé sur 2 chiffres).
  if (!nir_last4) return '••• ••• ••• ••• •••';
  return `1•••••••••${nir_last4}`;
}
```

Le drawer et la page détail consomment directement `patient.nir_last4` depuis la vue. **Aucun déchiffrement par défaut** : le ciphertext NIR ne quitte jamais Postgres → Edge Function ; la valeur affichée masquée est entièrement dérivée de données non secrètes.

**apps/web/src/app/(app)/patients/_components/patient-drawer.client.tsx** (≥ 100 lignes, ≤ 150 — limite CLAUDE.md § 11) :
```tsx
'use client';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { PatientNirDisplay } from './patient-nir-display.client';
import { Phone, MapPin, MessageCircle } from 'lucide-react';
import { maskNir } from '@/lib/utils';
import { getPatientByIdAction } from '../actions';

export function PatientDrawer({ patientId, open, onOpenChange }: { patientId: string | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { data, isPending } = useQuery({
    queryKey: ['patient', patientId],
    queryFn: () => getPatientByIdAction(patientId!),
    enabled: open && patientId !== null,
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[400px] sm:w-[400px] sm:max-w-[400px] overflow-y-auto" side="right">
        {isPending || !data ? (
          <div className="space-y-16 pt-32"><Skeleton className="h-32 w-full" /><Skeleton className="h-24 w-full" /><Skeleton className="h-48 w-full" /></div>
        ) : (
          <>
            {/* En-tête */}
            <SheetHeader className="space-y-8">
              <div className="flex items-center gap-12">
                <div className="h-48 w-48 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold text-base">
                  {data.prenom.charAt(0)}{data.nom.charAt(0)}
                </div>
                <div>
                  <SheetTitle className="text-2xl">{data.nom} {data.prenom}</SheetTitle>
                  <SheetDescription className="flex items-center gap-8">
                    <Badge>{data.canal_contact_prefere}</Badge>
                  </SheetDescription>
                </div>
              </div>
            </SheetHeader>

            {/* Identité administrative */}
            <section className="mt-24 space-y-12">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase">Identité administrative</h3>
              {data.has_nir && (
                <PatientNirDisplay patientId={data.id} maskedNir={maskNir(data.nir_last4)} />
              )}
              <p className="text-sm">Né(e) le {data.date_naissance}{data.genre ? ` — ${data.genre}` : ''}</p>
            </section>

            {/* Coordonnées */}
            <section className="mt-24 space-y-12">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase">Coordonnées</h3>
              {data.telephone && <p className="flex items-center gap-8 text-sm"><Phone className="h-16 w-16" /><a href={`tel:${data.telephone}`}>{data.telephone}</a></p>}
              <p className="flex items-start gap-8 text-sm"><MapPin className="h-16 w-16 mt-4" /><span>{data.adresse_ligne1}{data.adresse_ligne2 ? `, ${data.adresse_ligne2}` : ''}<br />{data.code_postal} {data.ville}</span></p>
              {data.contact_urgence_nom && <p className="text-sm">Urgence : {data.contact_urgence_nom} — {data.contact_urgence_telephone}</p>}
            </section>

            {/* Préférences */}
            <section className="mt-24 space-y-8">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase">Préférences</h3>
              <p className="text-sm flex items-center gap-8"><MessageCircle className="h-16 w-16" />Canal préféré : <Badge variant="secondary">{data.canal_contact_prefere}</Badge></p>
              <p className="text-sm">Consentement SMS : {data.consentement_sms ? `oui (${new Date(data.consentement_sms_at!).toLocaleDateString('fr-FR')})` : 'non'}</p>
            </section>

            {/* Contraintes */}
            <section className="mt-24 space-y-8">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase">Contraintes</h3>
              {data.patient_constraint?.length ? (
                <ul className="flex flex-wrap gap-8">
                  {data.patient_constraint.map((c: any) => <li key={c.id}><Badge variant="outline">{c.type}{c.note ? ` — ${c.note}` : ''}</Badge></li>)}
                </ul>
              ) : <p className="text-sm text-muted-foreground">Aucune contrainte.</p>}
            </section>

            {/* Note opérationnelle active */}
            <section className="mt-24 space-y-8">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase">Note opérationnelle</h3>
              {data.patient_operational_note?.[0] ? (
                <p className="text-sm whitespace-pre-line">{data.patient_operational_note[0].content}</p>
              ) : <p className="text-sm text-muted-foreground">Aucune note.</p>}
            </section>

            <div className="mt-32 pt-16 border-t flex flex-col gap-8">
              <Link href={`/patients/${data.id}`} className="text-sm text-primary hover:underline">Voir la fiche complète →</Link>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
```

**Important** : la limite CLAUDE.md § 11 est de **150 lignes par composant**. Si `patient-drawer.client.tsx` dépasse, splitter chaque section en sous-composant (`PatientHeader`, `PatientIdentity`, etc.) dans le même dossier. Préférer hostr le fichier global ≤ 150 lignes en extrayant les 6 sections en sous-composants ≤ 30 lignes chacun.

Ajouter à `actions.ts` :
```ts
export async function getPatientByIdAction(id: string) {
  return getPatientById(id); // déjà importé en haut depuis './queries'
}
```

Ajouter `apps/web/src/components/ui/badge.tsx` via `pnpm dlx shadcn@latest add badge --overwrite` (oublié en PLAN-4 ; ajouter ici sans drame).

**Conventions strictes :**
- Spacing : 8/12/16/24/32 uniquement
- Boutons d'action principaux : `h-48` (48 px)
- Badge canal préféré utilise les variants shadcn
- Aucun emoji, aucun jargon technique
- Skeleton (jamais spinner)
- `data-theme=dark` style fonctionne par CSS vars (rien à faire de spécifique ici)
- Texte tabular figures hérité du body (CSS var)
  </action>
  <verify>
    <automated>cd /home/user/TAP &amp;&amp; pnpm typecheck 2&gt;&amp;1 | tail -10 &amp;&amp; pnpm -C apps/web build 2&gt;&amp;1 | tail -10 &amp;&amp; for f in apps/web/src/app/\(app\)/patients/_components/*.tsx; do echo "$(wc -l &lt; "$f") $f"; done</automated>
  </verify>
  <acceptance_criteria>
    - `wc -l apps/web/src/app/(app)/patients/page.tsx` ≥ 30
    - `wc -l apps/web/src/app/(app)/patients/_components/patients-list.client.tsx` ≥ 90 et ≤ 150
    - `wc -l apps/web/src/app/(app)/patients/_components/patient-drawer.client.tsx` ≤ 150 (limite CLAUDE.md § 11)
    - `wc -l apps/web/src/app/(app)/patients/_components/patient-nir-display.client.tsx` ≥ 30
    - `grep -c "useDeferredValue" apps/web/src/app/(app)/patients/_components/patients-list.client.tsx` == 1
    - `grep -c "dq.length === 0 || dq.length >= 2\\|dq.length >= 2" apps/web/src/app/(app)/patients/_components/patients-list.client.tsx` ≥ 1
    - `grep -c 'w-\[400px\]' apps/web/src/app/(app)/patients/_components/patient-drawer.client.tsx` ≥ 1
    - `grep -c "Voir la fiche complète" apps/web/src/app/(app)/patients/_components/patient-drawer.client.tsx` == 1
    - `grep -c "Afficher le NIR complet\\|Afficher le NIR" apps/web/src/app/(app)/patients/_components/patient-nir-display.client.tsx` == 1
    - `grep -c "•" apps/web/src/lib/utils.ts` ≥ 1 (helper maskNir présent)
    - `grep -c "decryptNirAction" apps/web/src/app/(app)/patients/_components/patient-nir-display.client.tsx` == 1
    - `! grep -E "useEffect.*fetch\\|useEffect.*supabase" apps/web/src/app/(app)/patients/`
    - `! grep -rE "console\\.(log|error|warn|info)" apps/web/src/app/(app)/patients/`
    - `pnpm typecheck && pnpm -C apps/web build` exit 0
  </acceptance_criteria>
  <done>Page liste + drawer 400 px + recherche fuzzy 2 chars + affichage NIR masqué/déchiffré opérationnels, build vert.</done>
</task>

<task type="auto" tdd="true">
  <name>Tâche 3 : Pages /patients/new + /patients/[id] + /patients/[id]/edit + formulaire patient + E2E GREEN</name>
  <files>apps/web/src/app/(app)/patients/new/page.tsx, apps/web/src/app/(app)/patients/[id]/page.tsx, apps/web/src/app/(app)/patients/[id]/edit/page.tsx, apps/web/src/app/(app)/patients/_components/patient-form.client.tsx</files>
  <read_first>
    - /home/user/TAP/apps/web/e2e/patient-flow.spec.ts (contrats labels exacts à respecter)
    - /home/user/TAP/.planning/phases/01-referentiel-patients/01-CONTEXT.md (D-13 édition explicite, D-14 blocs)
    - /home/user/TAP/packages/shared/src/validators/patient.ts (patientSchema final après PLAN-2)
    - /home/user/TAP/CLAUDE.md (§ 5 — règles formulaires régulateur, raccourcis, validation)
  </read_first>
  <behavior>
  - Test E2E PLAN-1 : `/patients/new` affiche les labels EXACTS "Nom", "Prénom", "Date de naissance", "NIR", "Adresse", "Code postal", "Ville"
  - Test E2E : bouton "Créer" trigger Server Action createPatientAction
  - Test E2E : redirection vers `/patients/<uuid>` après création
  - Test E2E : `/patients/[id]/edit` affiche un select "Canal préféré" avec valeur 'sms' sélectionnable
  - Test E2E : checkbox "Consentement SMS" + bouton "Enregistrer"
  - Test E2E : audit_logs reçoit `patient.update` avec `metadata.new` SANS clé `nir_encrypted`
  - Test E2E B-1 : création avec note opérationnelle → après création le drawer rend la note ; modification de la note → ancienne ligne a `replaced_by_id` non NULL, nouvelle ligne visible UI ; audit_logs : 1 entrée à la création, 2 (created + replaced) à la modification
  - Test E2E B-2 : `/patients/[id]/edit` ajoute une contrainte `medical_fauteuil` → chip visible immédiatement ; suppression → chip disparaît ; audit_logs : 2 entrées (added + removed)
  - Test E2E B-5 : intercept de la réponse de `getPatientByIdAction` ne contient ni `nir_encrypted` ni `nir_search_hash` (vue `patients_safe`)
  - Tests Vitest `replacePatientNote` : 3 cas (no-op contenu identique, insert pur, insert + update replaced_by_id)
  </behavior>
  <action>
**apps/web/src/app/(app)/patients/_components/patient-form.client.tsx** (≥ 130 lignes, ≤ 150 — composant principal réutilisé en create + edit) :
```tsx
'use client';
import { useFormState, useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ActionState } from '../actions';

type FormAction = (prev: ActionState, fd: FormData) => Promise<ActionState>;

interface Props {
  action: FormAction;
  defaultValues?: Partial<{
    prenom: string; nom: string; date_naissance: string; genre: 'M'|'F'|'X';
    nir: string; telephone: string;
    adresse_ligne1: string; adresse_ligne2: string; code_postal: string; ville: string;
    contact_urgence_nom: string; contact_urgence_telephone: string;
    canal_contact_prefere: 'sms'|'appel'|'aucun'; consentement_sms: boolean;
    notes_operationnelles: string;
  }>;
  submitLabel: string;
}

function SubmitButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return <Button type="submit" disabled={pending} className="h-48">{pending ? 'Enregistrement…' : children}</Button>;
}

export function PatientForm({ action, defaultValues = {}, submitLabel }: Props) {
  const [state, formAction] = useFormState<ActionState, FormData>(action, {});
  const dv = defaultValues;
  return (
    <form action={formAction} className="space-y-24 max-w-[640px]" noValidate>
      {/* Identité */}
      <section className="space-y-12">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase">Identité</h2>
        <div className="grid grid-cols-2 gap-12">
          <div className="space-y-8"><Label htmlFor="nom">Nom</Label><Input id="nom" name="nom" required defaultValue={dv.nom} /></div>
          <div className="space-y-8"><Label htmlFor="prenom">Prénom</Label><Input id="prenom" name="prenom" required defaultValue={dv.prenom} /></div>
          <div className="space-y-8"><Label htmlFor="date_naissance">Date de naissance</Label><Input id="date_naissance" name="date_naissance" type="date" required defaultValue={dv.date_naissance} /></div>
          <div className="space-y-8">
            <Label htmlFor="genre">Genre</Label>
            <select id="genre" name="genre" defaultValue={dv.genre ?? ''} className="h-48 w-full rounded-md border border-border bg-background px-12">
              <option value="">—</option><option value="M">M</option><option value="F">F</option><option value="X">X</option>
            </select>
          </div>
        </div>
        <div className="space-y-8"><Label htmlFor="nir">NIR</Label><Input id="nir" name="nir" placeholder="13 chiffres + clé" defaultValue={dv.nir} aria-describedby="nir-help" />
          <p id="nir-help" className="text-xs text-muted-foreground">Stocké chiffré, jamais en clair en base.</p>
        </div>
      </section>

      {/* Coordonnées */}
      <section className="space-y-12">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase">Coordonnées</h2>
        <div className="space-y-8"><Label htmlFor="telephone">Téléphone</Label><Input id="telephone" name="telephone" type="tel" defaultValue={dv.telephone} /></div>
        <div className="space-y-8"><Label htmlFor="adresse_ligne1">Adresse</Label><Input id="adresse_ligne1" name="adresse_ligne1" required defaultValue={dv.adresse_ligne1} /></div>
        <div className="space-y-8"><Label htmlFor="adresse_ligne2">Complément</Label><Input id="adresse_ligne2" name="adresse_ligne2" defaultValue={dv.adresse_ligne2} /></div>
        <div className="grid grid-cols-2 gap-12">
          <div className="space-y-8"><Label htmlFor="code_postal">Code postal</Label><Input id="code_postal" name="code_postal" required defaultValue={dv.code_postal} /></div>
          <div className="space-y-8"><Label htmlFor="ville">Ville</Label><Input id="ville" name="ville" required defaultValue={dv.ville} /></div>
        </div>
      </section>

      {/* Préférences */}
      <section className="space-y-12">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase">Préférences</h2>
        <div className="space-y-8">
          <Label htmlFor="canal_contact_prefere">Canal préféré</Label>
          <select id="canal_contact_prefere" name="canal_contact_prefere" defaultValue={dv.canal_contact_prefere ?? 'appel'} className="h-48 w-full rounded-md border border-border bg-background px-12">
            <option value="sms">SMS</option><option value="appel">Appel</option><option value="aucun">Aucun</option>
          </select>
        </div>
        <div className="flex items-center gap-12">
          <input id="consentement_sms" name="consentement_sms" type="checkbox" defaultChecked={dv.consentement_sms} className="h-16 w-16 rounded border-border" />
          <Label htmlFor="consentement_sms">Consentement SMS</Label>
        </div>
      </section>

      {/* Note opérationnelle (B-1, PAT-06) — sous-composant pour rester ≤ 150 lignes */}
      <PatientFormNote defaultValue={dv.notes_operationnelles} />

      {state.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
      <SubmitButton>{submitLabel}</SubmitButton>
    </form>
  );
}
```

Imports en tête de `patient-form.client.tsx` : ajouter `import { PatientFormNote } from './patient-form-note.client';`.

**Si le composant dépasse 150 lignes** : extraire chaque `<section>` en sous-composant `Identity`, `Coordinates`, `Preferences` dans le même fichier (ou sous-composants externes), gardant la composition à ≤ 100 lignes.

**Section Note opérationnelle (B-1, PAT-06) — sous-composant client `patient-form-note.client.tsx` (≤ 150 lignes)** :
```tsx
'use client';
import { useState } from 'react';
import { Label } from '@/components/ui/label';

interface Props {
  defaultValue?: string;
  maxLength?: number;
}

export function PatientFormNote({ defaultValue = '', maxLength = 500 }: Props) {
  const [value, setValue] = useState(defaultValue);
  return (
    <section className="space-y-12">
      <h2 className="text-sm font-semibold text-muted-foreground uppercase">Note opérationnelle</h2>
      <div className="space-y-8">
        <Label htmlFor="notes_operationnelles">Note opérationnelle (codes d'accès, particularités)</Label>
        <textarea
          id="notes_operationnelles"
          name="notes_operationnelles"
          rows={4}
          maxLength={maxLength}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-full rounded-md border border-border bg-background px-12 py-8 text-sm"
          aria-describedby="notes-help"
        />
        <p id="notes-help" className="text-xs text-muted-foreground tabular-nums">{value.length} / {maxLength} caractères</p>
      </div>
    </section>
  );
}
```

Le `<PatientFormNote defaultValue={dv.notes_operationnelles} />` est intégré dans `PatientForm` après la section Préférences. Si `patient-form.client.tsx` dépasse 150 lignes après ajout, extraire également `IdentitySection` / `CoordinatesSection` / `PreferencesSection` en sous-composants pour rester ≤ 150 lignes.

**Server Action `createPatientAction` étendue (B-1)** : après l'INSERT patient ayant retourné `row.id`, si `parsed.data.notes_operationnelles?.trim()` non vide :
```ts
if (data.notes_operationnelles && data.notes_operationnelles.trim().length > 0) {
  const { error: noteErr } = await supabase.from('patient_operational_note').insert({
    patient_id: row!.id,
    content: data.notes_operationnelles.trim(),
    author_id: (await supabase.auth.getUser()).data.user!.id,
  } as never);
  if (noteErr) return { error: 'Note opérationnelle non enregistrée.' };
}
```

**Server Action `updatePatientAction` étendue (B-1, pattern D-18 du CONTEXT.md — replaced_by_id)** : si `parsed.data.notes_operationnelles` est défini (même chaîne vide pour effacer) :
```ts
import { replacePatientNote } from '@tap/shared/utils/patient-note';
// ...
if (typeof parsed.data.notes_operationnelles === 'string') {
  const authorId = (await supabase.auth.getUser()).data.user!.id;
  await replacePatientNote(supabase, id, parsed.data.notes_operationnelles.trim(), authorId);
}
```

**Helper partagé `packages/shared/src/utils/patient-note.ts` (≤ 50 lignes, fonction pure testée)** :
```ts
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@tap/database';

/**
 * Remplace la note opérationnelle active d'un patient (pattern replaced_by_id, D-18).
 * 1. SELECT note active (replaced_by_id IS NULL).
 * 2. Si contenu identique → no-op.
 * 3. INSERT new + UPDATE old.replaced_by_id = new.id (transaction logique).
 *
 * Si `newContent` est vide et qu'aucune note active n'existe → no-op.
 * Si `newContent` est vide et qu'une note active existe → marque l'ancienne comme remplacée
 * (par une note vide ? non : on UPDATE replaced_by_id = NULL is_deleted_marker pattern).
 * Choix V1 : note vide ⇒ INSERT note de contenu vide + replaced_by_id ancienne. Compteur audit ok.
 */
export async function replacePatientNote(
  supabase: SupabaseClient<Database>,
  patientId: string,
  newContent: string,
  authorId: string,
): Promise<void> {
  const { data: active } = await supabase
    .from('patient_operational_note')
    .select('id, content')
    .eq('patient_id', patientId)
    .is('replaced_by_id', null)
    .maybeSingle();

  if (active && active.content === newContent) return; // no-op

  const { data: inserted, error: insErr } = await supabase
    .from('patient_operational_note')
    .insert({ patient_id: patientId, content: newContent, author_id: authorId } as never)
    .select('id')
    .single();
  if (insErr || !inserted) throw new Error('Note non enregistrée.');

  if (active) {
    await supabase
      .from('patient_operational_note')
      .update({ replaced_by_id: inserted.id } as never)
      .eq('id', active.id);
  }
}
```

**Tests Vitest `packages/shared/src/utils/__tests__/patient-note.test.ts`** :
- contenu identique → no-op (0 INSERT)
- pas de note active + contenu non vide → 1 INSERT, pas d'UPDATE
- note active + nouveau contenu → 1 INSERT + 1 UPDATE replaced_by_id

**Section Contraintes (B-2, PAT-05) — sous-composant client `patient-form-constraints.client.tsx` (≤ 150 lignes)** :
```tsx
'use client';
import { useState, useTransition } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { X, Plus } from 'lucide-react';
import { addPatientConstraintAction, removePatientConstraintAction } from '../actions';
import { toast } from 'sonner';

const CONSTRAINT_TYPES = [
  { value: 'medical_oxygene', label: 'Oxygène' },
  { value: 'medical_fauteuil', label: 'Fauteuil roulant' },
  { value: 'medical_brancard', label: 'Brancard' },
  { value: 'vehicule_tpmr', label: 'Véhicule TPMR' },
  { value: 'horaire_matin', label: 'Horaire matin' },
  { value: 'horaire_apres_midi', label: 'Horaire après-midi' },
  { value: 'accompagnement_obligatoire', label: 'Accompagnement obligatoire' },
  { value: 'autre', label: 'Autre' },
] as const;

interface Constraint { id: string; type: string; note: string | null }
interface Props { patientId: string; initial: Constraint[] }

export function PatientFormConstraints({ patientId, initial }: Props) {
  const [items, setItems] = useState<Constraint[]>(initial);
  const [type, setType] = useState<string>('medical_oxygene');
  const [note, setNote] = useState('');
  const [pending, startTransition] = useTransition();

  function handleAdd() {
    startTransition(async () => {
      const res = await addPatientConstraintAction(patientId, type as never, note || undefined);
      if ('error' in res) { toast.error(res.error); return; }
      setItems([...items, res.created]);
      setNote('');
    });
  }
  function handleRemove(id: string) {
    startTransition(async () => {
      const res = await removePatientConstraintAction(id);
      if ('error' in res) { toast.error(res.error); return; }
      setItems(items.filter((c) => c.id !== id));
    });
  }

  return (
    <section className="space-y-12">
      <h2 className="text-sm font-semibold text-muted-foreground uppercase">Contraintes</h2>
      <ul className="flex flex-wrap gap-8" aria-label="Contraintes actuelles">
        {items.length === 0 && <li className="text-sm text-muted-foreground">Aucune contrainte.</li>}
        {items.map((c) => (
          <li key={c.id}>
            <Badge variant="outline" className="gap-8">
              {CONSTRAINT_TYPES.find((t) => t.value === c.type)?.label ?? c.type}{c.note ? ` — ${c.note}` : ''}
              <button type="button" onClick={() => handleRemove(c.id)} disabled={pending} aria-label={`Supprimer ${c.type}`}>
                <X className="h-12 w-12" />
              </button>
            </Badge>
          </li>
        ))}
      </ul>
      <div className="grid grid-cols-[1fr_1fr_auto] gap-12 items-end">
        <div className="space-y-8">
          <Label htmlFor="constraint-type">Type</Label>
          <select id="constraint-type" value={type} onChange={(e) => setType(e.target.value)} className="h-48 w-full rounded-md border border-border bg-background px-12">
            {CONSTRAINT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div className="space-y-8">
          <Label htmlFor="constraint-note">Précision (optionnel)</Label>
          <Input id="constraint-note" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        <Button type="button" onClick={handleAdd} disabled={pending} className="h-48"><Plus className="mr-8 h-16 w-16" />Ajouter</Button>
      </div>
    </section>
  );
}
```

**Note importante édition contraintes** : la section Contraintes utilise des **Server Actions atomiques** (add / remove), pas le formulaire `PatientForm` global. Les contraintes sont éditées en direct (chaque ajout/suppression est persisté immédiatement). Conséquence :
- En `/patients/new` : pas de section Contraintes (le patient n'existe pas encore). Les contraintes seront ajoutables après création depuis `/patients/[id]/edit`.
- En `/patients/[id]/edit` : section Contraintes affichée sous le formulaire principal, hors `<form>` (pour éviter les soumissions imbriquées).

**Server Actions à ajouter à `actions.ts`** :
```ts
import { patientConstraintInputSchema } from '@tap/shared';

export async function addPatientConstraintAction(
  patientId: string,
  type: string,
  note?: string,
): Promise<{ created: { id: string; type: string; note: string | null } } | { error: string }> {
  const parsed = patientConstraintInputSchema.safeParse({ patient_id: patientId, type, note });
  if (!parsed.success) return { error: parsed.error.errors[0].message };
  const supabase = createClient();
  const { data, error } = await supabase
    .from('patient_constraint')
    .insert({ patient_id: patientId, type: parsed.data.type, note: parsed.data.note ?? null } as never)
    .select('id, type, note')
    .single();
  if (error || !data) return { error: 'Ajout de la contrainte impossible.' };
  revalidatePath(`/patients/${patientId}`);
  return { created: data };
}

export async function removePatientConstraintAction(
  constraintId: string,
): Promise<{ ok: true } | { error: string }> {
  const supabase = createClient();
  // RLS garantit que l'utilisateur ne peut supprimer qu'une contrainte de son organisation.
  const { error } = await supabase.from('patient_constraint').delete().eq('id', constraintId);
  if (error) return { error: 'Suppression impossible.' };
  return { ok: true };
}
```

L'audit (`patient_constraint.added` / `patient_constraint.removed`) est géré par le trigger Postgres `patient_constraint_audit_trigger` créé par PLAN-2 (Wave 1) — aucun appel d'audit côté Server Action.

**apps/web/src/app/(app)/patients/new/page.tsx** :
```tsx
import { PatientForm } from '../_components/patient-form.client';
import { createPatientAction } from '../actions';

export const metadata = { title: 'Nouveau patient — TAP Régulation' };

export default function NewPatientPage() {
  return (
    <div className="space-y-24">
      <h1 className="text-2xl font-semibold">Nouveau patient</h1>
      <PatientForm action={createPatientAction} submitLabel="Créer" />
    </div>
  );
}
```

**apps/web/src/app/(app)/patients/[id]/page.tsx** :
```tsx
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Pencil } from 'lucide-react';
import { getPatientById } from '../queries';
import { PatientNirDisplay } from '../_components/patient-nir-display.client';
import { maskNir } from '@/lib/utils';

export default async function PatientPage({ params }: { params: { id: string } }) {
  let patient;
  try { patient = await getPatientById(params.id); } catch { notFound(); }

  return (
    <div className="space-y-24">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{patient.nom} {patient.prenom}</h1>
        <Button asChild variant="outline">
          <Link href={`/patients/${patient.id}/edit`}><Pencil className="mr-8 h-16 w-16" />Modifier</Link>
        </Button>
      </header>
      {/* Mêmes 6 blocs que le drawer, mais en page complète. Pour rester ≤ 150 lignes,
          on extraira `PatientFullSheet` en sous-composant si besoin. */}
      <section className="space-y-12">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase">Identité administrative</h2>
        {patient.has_nir && <PatientNirDisplay patientId={patient.id} maskedNir={maskNir(patient.nir_last4)} />}
        <p className="text-sm">Né(e) le {patient.date_naissance}</p>
      </section>
      <section className="space-y-12">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase">Coordonnées</h2>
        {patient.telephone && <p>{patient.telephone}</p>}
        <p>{patient.adresse_ligne1}{patient.adresse_ligne2 ? `, ${patient.adresse_ligne2}` : ''}<br />{patient.code_postal} {patient.ville}</p>
      </section>
      <section className="space-y-8">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase">Préférences</h2>
        <p>Canal : <strong>{patient.canal_contact_prefere}</strong></p>
        <p>Consentement SMS : {patient.consentement_sms ? `oui (${new Date(patient.consentement_sms_at!).toLocaleDateString('fr-FR')})` : 'non'}</p>
      </section>
    </div>
  );
}
```

**apps/web/src/app/(app)/patients/[id]/edit/page.tsx** :
```tsx
import { notFound } from 'next/navigation';
import { PatientForm } from '../../_components/patient-form.client';
import { PatientFormConstraints } from '../../_components/patient-form-constraints.client';
import { updatePatientAction } from '../../actions';
import { getPatientById } from '../../queries';

export default async function EditPatientPage({ params }: { params: { id: string } }) {
  let patient;
  try { patient = await getPatientById(params.id); } catch { notFound(); }

  // Bind l'id au Server Action.
  const action = updatePatientAction.bind(null, patient.id);
  const activeNote = patient.patient_operational_note?.[0]?.content ?? '';

  return (
    <div className="space-y-32">
      <h1 className="text-2xl font-semibold">Modifier — {patient.nom} {patient.prenom}</h1>
      <PatientForm
        action={action}
        defaultValues={{
          prenom: patient.prenom, nom: patient.nom, date_naissance: patient.date_naissance,
          genre: patient.genre as 'M'|'F'|'X' | undefined,
          telephone: patient.telephone ?? undefined,
          adresse_ligne1: patient.adresse_ligne1, adresse_ligne2: patient.adresse_ligne2 ?? undefined,
          code_postal: patient.code_postal, ville: patient.ville,
          canal_contact_prefere: patient.canal_contact_prefere,
          consentement_sms: patient.consentement_sms,
          notes_operationnelles: activeNote,
        }}
        submitLabel="Enregistrer"
      />
      {/* Édition contraintes hors <form> principal : Server Actions atomiques add/remove. */}
      <PatientFormConstraints
        patientId={patient.id}
        initial={(patient.patient_constraint ?? []).map((c: { id: string; type: string; note: string | null }) => ({ id: c.id, type: c.type, note: c.note }))}
      />
    </div>
  );
}
```

**Comptes seed E2E** : vérifier que `supabase/seed.sql` (livré Lot 0) crée bien un compte régulateur avec les credentials utilisés par `loginAsRegulateur` (PLAN-1 helper `'reg-demo@tap.test'` / `'demo1234!'`). Si ce n'est pas le cas, **ajouter à seed.sql** (ou `supabase/seed/01-patients.sql`) un INSERT minimal :
```sql
-- Compte de test E2E (ne pas exécuter en prod)
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
values ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'reg-demo@tap.test', crypt('demo1234!', gen_salt('bf')), now(), now(), now(), '{}', '{}')
on conflict (id) do nothing;
insert into public.profiles (id, organization_id, role, prenom, nom, email)
values ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '11111111-1111-1111-1111-111111111111', 'regulateur', 'Régulatrice', 'Démo', 'reg-demo@tap.test')
on conflict (id) do nothing;
```

Vérifier en lecture le seed.sql existant avant de modifier.

**Run E2E final** :
```bash
cd /home/user/TAP
pnpm db:reset                  # applique migrations 001/002/003 + RPC + seed
APP_NIR_ENCRYPTION_KEY=$(openssl rand -base64 32) APP_NIR_SEARCH_KEY=$(openssl rand -base64 32) supabase functions serve nir &
pnpm -C apps/web build
pnpm -C apps/web test:e2e
```

**Conventions strictes :**
- `patient-form.client.tsx` ≤ 150 lignes ; si dépasse, extraire en `IdentitySection`, `CoordinatesSection`, `PreferencesSection`
- Labels exacts conformes aux `getByLabel(...)` du test E2E
- Pas de `useEffect` pour fetch
- Bouton primaire `h-48`
- Spacing 8/12/16/24/32
- Aucun emoji, aucun jargon technique
  </action>
  <verify>
    <automated>cd /home/user/TAP &amp;&amp; pnpm db:reset 2&gt;&amp;1 | tail -5 &amp;&amp; pnpm -C apps/web build 2&gt;&amp;1 | tail -10 &amp;&amp; APP_NIR_ENCRYPTION_KEY=$(openssl rand -base64 32) APP_NIR_SEARCH_KEY=$(openssl rand -base64 32) pnpm -C apps/web test:e2e 2&gt;&amp;1 | tail -30</antml-parameter></automated>
  </verify>
  <acceptance_criteria>
    - `wc -l apps/web/src/app/(app)/patients/_components/patient-form.client.tsx` ≤ 150
    - `wc -l apps/web/src/app/(app)/patients/_components/patient-form-note.client.tsx` ≤ 150
    - `wc -l apps/web/src/app/(app)/patients/_components/patient-form-constraints.client.tsx` ≤ 150
    - `wc -l apps/web/src/app/(app)/patients/[id]/page.tsx` ≤ 150
    - `wc -l apps/web/src/app/(app)/patients/[id]/edit/page.tsx` ≤ 150
    - `wc -l packages/shared/src/utils/patient-note.ts` ≤ 50 (fonction pure)
    - `grep -c 'name="nom"\\|name="prenom"\\|name="date_naissance"\\|name="nir"\\|name="adresse_ligne1"\\|name="code_postal"\\|name="ville"' apps/web/src/app/(app)/patients/_components/patient-form.client.tsx` ≥ 7 (labels E2E)
    - `grep -c 'submitLabel="Créer"' apps/web/src/app/(app)/patients/new/page.tsx` == 1
    - `grep -c 'submitLabel="Enregistrer"' apps/web/src/app/(app)/patients/[id]/edit/page.tsx` == 1
    - `grep -c 'consentement_sms' apps/web/src/app/(app)/patients/_components/patient-form.client.tsx` ≥ 2
    - `grep -c 'updatePatientAction.bind' apps/web/src/app/(app)/patients/[id]/edit/page.tsx` == 1
    - `grep -c 'name="notes_operationnelles"' apps/web/src/app/(app)/patients/_components/patient-form-note.client.tsx` == 1 (B-1)
    - `grep -c 'PatientFormNote' apps/web/src/app/(app)/patients/_components/patient-form.client.tsx` ≥ 1 (B-1)
    - `grep -c 'PatientFormConstraints' apps/web/src/app/(app)/patients/[id]/edit/page.tsx` ≥ 1 (B-2)
    - `grep -c 'addPatientConstraintAction\\|removePatientConstraintAction' apps/web/src/app/(app)/patients/actions.ts` ≥ 2 (B-2)
    - `grep -c 'replacePatientNote' packages/shared/src/utils/patient-note.ts` ≥ 1 (B-1 helper)
    - `test -f packages/shared/src/utils/__tests__/patient-note.test.ts` (B-1 tests)
    - `pnpm -C packages/shared test 2>&1 | grep -cE "(passed|✓)"` ≥ 3 (no-op + insert + replace)
    - E2E B-1 : création avec note → drawer affiche la note ; édition note → ancienne `replaced_by_id` non NULL en DB + 2 entrées audit (`created` + `replaced`)
    - E2E B-2 : ajout contrainte `medical_fauteuil` → chip visible ; suppression → chip disparaît + 2 entrées audit (`added` + `removed`)
    - E2E B-5 : intercept response de `getPatientByIdAction` via `page.on('response')` → JSON parsé ne contient ni clé `nir_encrypted` ni `nir_search_hash`
    - `! grep -rE "nir_encrypted|nir_search_hash" apps/web/src/app/\(app\)/patients/` (B-5 zéro référence ciphertext dans l'UI patients)
    - `pnpm -C apps/web test:e2e` exit 0 (le scénario `patient-flow.spec.ts` doit passer en GREEN)
    - `pnpm -C apps/web test:e2e 2>&1 | grep -cE "(passed|✓)"` ≥ 1
    - `pnpm -C apps/web test:e2e 2>&1 | grep -cE "(failed|✗)"` == 0
  </acceptance_criteria>
  <done>3 pages (/patients/new, /patients/[id], /patients/[id]/edit) + formulaire réutilisable + sous-composants Note et Contraintes + helper `replacePatientNote` + seed compte E2E + test E2E patient-flow.spec.ts en GREEN.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Browser → Server Action | Cookies sb-access-token httpOnly ; mutation passe par RLS |
| Server Action → Edge Function nir | JWT du caller injecté par `supabase.functions.invoke` ; clé chiffrement jamais côté serveur Next |
| Server Action → Postgres | RLS forcée + helpers `current_organization_id()` |
| Client (drawer) → Server Action decryptNir | Action déclenchée par bouton explicite ; chaque clic = 1 audit log forcé |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-05-01 | Information Disclosure | NIR clair stocké en state React après decrypt | MEDIUM | mitigate | `revealed` state vit uniquement en mémoire client ; bouton "Masquer" remet à null. Aucun localStorage / sessionStorage. Acceptance criteria : `! grep -E "localStorage.setItem.*nir\\|sessionStorage" apps/web/src/app/(app)/patients/` |
| T-05-02 | Tampering | XSS via note opérationnelle ou nom patient | HIGH | mitigate | React échappe par défaut ; `! grep -rE "dangerouslySetInnerHTML" apps/web/src/app/(app)/patients/`. Le seul `dangerouslySetInnerHTML` autorisé du projet est dans `layout.tsx` (theme bootstrap) ; vérifier que ce pattern n'est pas répliqué |
| T-05-03 | Information Disclosure | recherche fuzzy fuit NIR via SQL injection | HIGH | mitigate | RPC `search_patients(q text)` paramétrée ; `q` jamais interpolée dans une string SQL. Le client TS appelle `supabase.rpc('search_patients', { q })` qui passe par requête préparée. Search_text ne contient pas le NIR (seulement nom/prenom/telephone) |
| T-05-04 | Information Disclosure | bypass audit_logs sur decrypt via appel direct | MEDIUM | mitigate | L'audit_log est inséré DANS l'Edge Function (PLAN-3), pas côté client. Impossible à oublier. Test E2E PLAN-1 vérifie la ligne audit après revealed |
| T-05-05 | Spoofing | open redirect via `?next=https://evil` après edit | LOW | mitigate | `updatePatientAction` redirect vers `/patients/${id}` (path-based, jamais next) |
| T-05-06 | Elevation of Privilege | un chauffeur (futur Phase 9) tape /patients dans l'URL | MEDIUM | mitigate | RLS forcée + policy `patients_select_same_org` autorise tout user authenticated à lire les patients de SON org. Pour Phase 9, une policy plus restrictive sera ajoutée (chauffeur ne voit que ses tournées). Pour Phase 1 (régulateur + dirigeant uniquement seedés), le risque est nul |
</threat_model>

<verification>
- `pnpm db:reset && pnpm typecheck && pnpm -C apps/web build && pnpm -C apps/web test:e2e` exit 0 enchaîné
- `! grep -rE "console\\.(log|error|warn|info)" apps/web/src/app/(app)/patients/`
- `! grep -rE "useEffect" apps/web/src/app/(app)/patients/_components/` (aucun useEffect ; tout passe par useQuery / Server Actions)
- `! grep -rE "@supabase/(ssr|supabase-js)" apps/web/src/app/(app)/patients/` (apps/web consomme uniquement @tap/database via wrappers)
- `! grep -rE "dangerouslySetInnerHTML" apps/web/src/app/(app)/`
- `grep -rc "h-48\\|h-\\[48px\\]" apps/web/src/app/(app)/patients/` ≥ 3 (boutons primaires conformes spacing system)
- Aucun fichier `apps/web/src/app/(app)/patients/**/*.tsx` ne dépasse 150 lignes (CLAUDE.md § 11)
- E2E `patient-flow.spec.ts` GREEN avec audit_logs validé
</verification>

<success_criteria>
- Les 7 requirements PAT-01..PAT-07 sont tous satisfaits par au moins un parcours d'utilisateur réel mesurable :
  - PAT-01 (création) : `/patients/new` + Server Action createPatientAction
  - PAT-02 (NIR chiffré) : Edge Function via `nir-client.ts`, jamais en clair en base ou logs
  - PAT-03 (consultation < 1 clic) : drawer ouvert au clic sur résultat de recherche
  - PAT-04 (fuzzy 2 chars) : `useDeferredValue` + RPC `search_patients` + garde 2 chars côté UI ET serveur
  - PAT-05 (préférences + contraintes) : **OUI, UI complète pour édition contraintes** — section Préférences du formulaire + sous-composant `PatientFormConstraints` (chips Lucide-X + Combobox 8 valeurs + addPatientConstraintAction / removePatientConstraintAction). Affichage lecture seule dans drawer ; édition complète depuis `/patients/[id]/edit`.
  - PAT-06 (note opérationnelle) : **OUI, UI complète pour édition note opérationnelle** — sous-composant `PatientFormNote` (textarea 500 caractères + compteur) intégré au formulaire create + edit ; helper partagé `replacePatientNote` applique le pattern `replaced_by_id` (D-18). Drawer affiche la note active.
  - PAT-07 (audit_logs) : triggers Postgres (PLAN-2) + Edge Function decrypt insère `patient.nir.decrypt`
- **Pas de leak `nir_encrypted` au client** : `getPatientById` consomme la vue `patients_safe`, vérifié par grep + interception E2E (B-5)
- Le test E2E `patient-flow.spec.ts` (PLAN-1) passe en GREEN
- Aucun fichier ne dépasse les limites CLAUDE.md § 11 (300 / 150 / 50)
- Audit grep confirme : pas de useEffect-fetch, pas de console.log, pas d'import @supabase/* hors wrappers
</success_criteria>

<output>
Après complétion, créer `.planning/phases/01-referentiel-patients/01-5-SUMMARY.md` documentant :
- URL des routes finales : `/patients`, `/patients/new`, `/patients/[id]`, `/patients/[id]/edit`
- Composants Client publiables pour la Phase 2 saisie express : `PatientSearch`, `PatientDrawer` (réutilisables tels quels avec un `patientId` ou un selecteur)
- Snapshot final E2E : 1 scénario, 5 assertions principales (création, recherche fuzzy, drawer 400 px, NIR masqué, audit log)
- Note pour Phase 2 : la saisie express devra appeler `searchPatients` exactement comme `PatientsList` ; le wrapper `nir-client.ts` est déjà prêt si la course référence un patient sans NIR encore saisi
- Édition contraintes (PAT-05) et édition note opérationnelle (PAT-06) sont **livrées en Phase 1** (sous-composants `PatientFormConstraints` + `PatientFormNote`). Aucun report V1.5 sur ces deux items.
</output>

## Revision Log

### 2026-05-06 — Iteration 1/3

- **B-1 fix** : UI édition note opérationnelle ajoutée. Sous-composant `patient-form-note.client.tsx` (textarea 500 chars + compteur) intégré au `PatientForm`. Server Actions `createPatientAction` et `updatePatientAction` étendues pour persister la note (INSERT à la création ; pattern `replaced_by_id` à la modification via helper partagé `replacePatientNote`).
- **B-2 fix** : UI édition contraintes ajoutée. Sous-composant `patient-form-constraints.client.tsx` (chips Lucide-X cliquables + Combobox 8 valeurs enum + champ note libre) avec Server Actions atomiques `addPatientConstraintAction` / `removePatientConstraintAction`. Audit géré par trigger `patient_constraint_audit_trigger` (PLAN-2).
- **B-3 cleanup** : la migration RPC `search_patients` (`supabase/migrations/20260507000002_search_patients_rpc.sql`) est créée par PLAN-2 en Wave 1 ; PLAN-5 se contente de la consommer via `supabase.rpc('search_patients', { q })`. Aucune migration créée par PLAN-5.
- **B-5 fix** : `getPatientById` (T1) sélectionne désormais depuis la vue `patients_safe`, jamais depuis la table `patients`. La vue exclut `nir_encrypted` et `nir_search_hash` ; elle expose `nir_last4` (clair, non secret) et `has_nir`. Aucun ciphertext NIR ne transite vers le browser. Acceptance grep + E2E `page.on('response')` interception ajoutés.
- **B-6 follow-up** : helper `maskNir` consomme `nir_last4` (clair, non secret) depuis la vue `patients_safe`, retourne `1•••••••••XX YY`. Aucun déchiffrement par défaut ; le ciphertext NIR ne quitte jamais Postgres → Edge Function.
- **Date** : 2026-05-06
- **Iteration** : 1/3

### 2026-05-06 — Iteration 2/3 (W-1 wire-up `nir_last4`)

- **W-1 fix** : `nir-client.ts` consolidé en une seule fonction `encryptAndHashNir(supabase, nir)` qui retourne `{ nir_encrypted, nir_search_hash, nir_last4 }` en un seul `functions.invoke`. La fonction `hashNir` séparée est supprimée (l'Edge Function PLAN-3 calcule encrypt + hash + last4 dans la même requête).
- `createPatientAction` : appel unique à `encryptAndHashNir`, INSERT atomique des 3 colonnes (`nir_encrypted`, `nir_search_hash`, `nir_last4`).
- `updatePatientAction` : si `parsed.data.nir` est fourni (modification du NIR clair), appel à `encryptAndHashNir`, persistance des 3 colonnes ; **suppression systématique** de `nir` du payload UPDATE (le NIR clair ne doit jamais arriver dans la table Postgres).
- Le drawer affichera désormais correctement `1•••••••••XX YY` après création (le test E2E PLAN-1 ligne 351 sur la regex masquée passera).
- **Iteration** : 2/3
