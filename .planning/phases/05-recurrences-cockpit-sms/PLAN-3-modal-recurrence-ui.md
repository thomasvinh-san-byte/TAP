# Plan-3 — Modal récurrence création/édition + preview 4 occurrences

**Phase**: 05
**Wave**: 3/7
**Dépendances**: Wave 1 (migrations ride_recurrences + holidays_974 + packages/recurrence)
**Estimation**: 2h (vélocité projetée 25-40 min réel)
**Refs**: DEC-046 rrule.js, DEC-047 eager 3 mois, DEC-048 modal cascade modif active, UI-SPEC Surfaces 2+3

---

## Goal

UI création/édition récurrence dialyse depuis fiche patient avec preview live des 4 prochaines occurrences (jours fériés 974 grisés via EXDATE). Modal édition active déclenche confirmation cascade DEC-048 (« X occurrences seront affectées »).

---

## Fichiers à créer (6)

```
apps/web/src/app/(app)/patients/[id]/_components/
  recurrences-section.client.tsx                # Liste + bouton + Nouvelle récurrence
  recurrence-create-modal.client.tsx            # Modal création (Surface 2)
  recurrence-edit-modal.client.tsx              # Modal édition active (Surface 3) + cascade
  recurrence-preview.client.tsx                 # Preview 4 occurrences live

apps/web/src/app/(app)/patients/[id]/_lib/
  use-holidays-974.ts                           # Hook fetch holidays + cache

apps/web/e2e/phase-05-recurrence-dialyse.spec.ts # Test E2E preview avec jour férié
```

## Fichiers à modifier

- `apps/web/src/app/(app)/patients/[id]/actions.ts` — 3 Server Actions :
  - `createRecurrenceAction(input)`
  - `updateRecurrenceAction(id, input)` (cascade DEC-048)
  - `cancelRecurrenceAction(id)` (archived_at)
- `apps/web/src/app/(app)/patients/[id]/page.tsx` — intégrer `<RecurrencesSection />`

---

## Server Actions

### `createRecurrenceAction`

```ts
'use server';
import { z } from 'zod';
import { generateOccurrences } from '@tap/recurrence';
import { revalidatePath } from 'next/cache';

const inputSchema = z.object({
  patient_id: z.string().uuid(),
  prescription_id: z.string().uuid().nullable(),
  rrule_str: z.string().min(1), // ex: "FREQ=WEEKLY;BYDAY=MO,WE,FR;BYHOUR=8;BYMINUTE=0"
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  pickup_address: z.string().min(1),
  pickup_lat: z.number().nullable(),
  pickup_lng: z.number().nullable(),
  pickup_citycode: z.string().nullable(),
  dropoff_address: z.string().min(1),
  dropoff_lat: z.number().nullable(),
  dropoff_lng: z.number().nullable(),
  dropoff_citycode: z.string().nullable(),
  transport_mode: z.enum(['vsl', 'taxi_conventionne', 'tpmr']),
  urgency: z.enum(['normale', 'prioritaire']).default('normale'),
});

export async function createRecurrenceAction(formData: FormData) {
  const ctx = await getAuthContext();
  if (!ctx || (ctx.role !== 'regulateur' && ctx.role !== 'dirigeant')) {
    return { error: 'Accès réservé aux régulateurs.' };
  }

  const parsed = inputSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.errors[0]?.message };

  const { data: recurrence, error: insertError } = await ctx.supabase
    .from('ride_recurrences')
    .insert({
      ...parsed.data,
      organization_id: ctx.organization_id,
      created_by: ctx.user_id,
    })
    .select('id')
    .single();
  if (insertError || !recurrence) return { error: 'Création échouée.' };

  // Génération eager 3 mois (DEC-047)
  const { data: holidays } = await ctx.supabase.from('holidays_974').select('date');
  const holidays974 = new Set(holidays?.map((h) => h.date) ?? []);

  const dtstart = new Date(parsed.data.start_date + 'T08:00:00');
  const until = new Date(dtstart);
  until.setMonth(until.getMonth() + 3);

  const occurrences = generateOccurrences({
    rruleStr: parsed.data.rrule_str,
    dtstart,
    until,
    holidays974,
  });

  // Insert rides en batch
  const ridesPayload = occurrences.map((occ) => ({
    organization_id: ctx.organization_id,
    patient_id: parsed.data.patient_id,
    ride_recurrence_id: recurrence.id,
    pickup_address: parsed.data.pickup_address,
    pickup_lat: parsed.data.pickup_lat,
    pickup_lng: parsed.data.pickup_lng,
    pickup_citycode: parsed.data.pickup_citycode,
    dropoff_address: parsed.data.dropoff_address,
    dropoff_lat: parsed.data.dropoff_lat,
    dropoff_lng: parsed.data.dropoff_lng,
    dropoff_citycode: parsed.data.dropoff_citycode,
    transport_mode: parsed.data.transport_mode,
    urgency: parsed.data.urgency,
    scheduled_at: occ.toISOString(),
    status: 'non_assignee',
    created_by: ctx.user_id,
  }));

  if (ridesPayload.length > 0) {
    const { error } = await ctx.supabase.from('rides').insert(ridesPayload);
    if (error) return { error: 'Génération occurrences échouée.' };
  }

  revalidatePath(`/patients/${parsed.data.patient_id}`);
  return { success: true, count: occurrences.length };
}
```

### `updateRecurrenceAction` (cascade DEC-048)

```ts
export async function updateRecurrenceAction(formData: FormData) {
  const ctx = await getAuthContext();
  // ... validation Zod + auth check ...
  const { id, ...input } = parsed.data;

  // 1. UPDATE recurrence
  const { data: updated, error: upErr } = await ctx.supabase
    .from('ride_recurrences')
    .update(input)
    .eq('id', id)
    .select('id')
    .single();
  // DEC-041 row count check
  if (upErr || !updated) return { error: 'Modification rejetée (RLS).' };

  // 2. DELETE rides futures non-démarrées (status = 'non_assignee' OR 'assignee')
  const nowIso = new Date().toISOString();
  const { error: delErr } = await ctx.supabase
    .from('rides')
    .delete()
    .eq('ride_recurrence_id', id)
    .in('status', ['non_assignee', 'assignee'])
    .gt('scheduled_at', nowIso);
  if (delErr) return { error: 'Suppression occurrences futures échouée.' };

  // 3. Regen occurrences cohérent createRecurrenceAction
  // ... (factoriser dans helper `regenerateOccurrencesFor(recurrenceId)`)

  // 4. Audit
  await ctx.supabase.from('audit_logs').insert({
    actor_id: ctx.user_id,
    action_type: 'recurrence.update_cascade',
    payload: { recurrence_id: id, regenerated_count: occurrences.length },
  });

  revalidatePath(`/patients/${input.patient_id}`);
  return { success: true, regenerated_count: occurrences.length };
}
```

---

## Composants UI

### `recurrence-preview.client.tsx`

```tsx
'use client';
import { useMemo } from 'react';
import { generateOccurrences } from '@tap/recurrence';

interface Props {
  rruleStr: string;
  startDate: string;
  holidays974: Set<string>;
}

export function RecurrencePreview({ rruleStr, startDate, holidays974 }: Props) {
  const { occurrences, skipped } = useMemo(() => {
    if (!rruleStr || !startDate) return { occurrences: [], skipped: [] };
    const dtstart = new Date(startDate + 'T08:00:00');
    const until = new Date(dtstart);
    until.setMonth(until.getMonth() + 1);
    const all = generateOccurrences({ rruleStr, dtstart, until, holidays974 });
    // ... pareil mais récupérer aussi les sautées pour affichage grisé
    return { occurrences: all.slice(0, 4), skipped: [] };
  }, [rruleStr, startDate, holidays974]);

  return (
    <div className="border rounded-md p-12 bg-muted/30">
      <h4 className="text-sm font-medium mb-8">Preview 4 prochaines occurrences</h4>
      {occurrences.map((occ) => (
        <div key={occ.toISOString()} className="text-sm tabular-nums py-2">
          ✓ {formatDateFr(occ)} à {formatTime(occ)}
        </div>
      ))}
      {skipped.map((occ) => (
        <div key={occ.toISOString()} className="text-sm tabular-nums py-2 text-muted-foreground line-through">
          ⊘ {formatDateFr(occ)} — Jour férié (skippé)
        </div>
      ))}
    </div>
  );
}
```

### `recurrence-create-modal.client.tsx` (sketch)

```tsx
'use client';
import { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useHolidays974 } from '../_lib/use-holidays-974';
import { RecurrencePreview } from './recurrence-preview.client';
import { createRecurrenceAction } from '../actions';

export function RecurrenceCreateModal({ open, onOpenChange, patientId }) {
  const [days, setDays] = useState<string[]>(['MO', 'WE', 'FR']);
  const [hour, setHour] = useState('08:00');
  const [startDate, setStartDate] = useState('');
  const holidays974 = useHolidays974();

  const rruleStr = `FREQ=WEEKLY;BYDAY=${days.join(',')};BYHOUR=${parseInt(hour)};BYMINUTE=0`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form action={createRecurrenceAction}>
          {/* Champs : type / chips jours / heure / dates / addresses (AddressOrPOIPicker existant) / mode / urgency / prescription */}
          <input type="hidden" name="patient_id" value={patientId} />
          <input type="hidden" name="rrule_str" value={rruleStr} />
          <RecurrencePreview rruleStr={rruleStr} startDate={startDate} holidays974={holidays974} />
          <Button type="submit">Créer occurrences</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

### `recurrence-edit-modal.client.tsx` — cascade DEC-048

```tsx
'use client';
import { useState } from 'react';
import { updateRecurrenceAction } from '../actions';

export function RecurrenceEditModal({ open, onOpenChange, recurrence, futureCount }) {
  const [showCascadeConfirm, setShowCascadeConfirm] = useState(false);

  const handleSubmit = (formData) => {
    setShowCascadeConfirm(true); // Bloquer submit jusqu'à confirmation
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <Alert>
            ⚠ Cette récurrence a {recurrence.total_occurrences} occurrences générées.
            Modifier remplacera toutes les occurrences futures non-démarrées ({futureCount} impactées).
          </Alert>
          {/* Mêmes champs que CreateModal pré-remplis */}
          <Button onClick={() => setShowCascadeConfirm(true)}>Confirmer modification</Button>
        </DialogContent>
      </Dialog>

      {/* Modal confirmation cascade DEC-048 */}
      <Dialog open={showCascadeConfirm} onOpenChange={setShowCascadeConfirm}>
        <DialogContent className="max-w-sm">
          <p>{futureCount} occurrences non-démarrées seront supprimées et regénérées.</p>
          <p className="text-xs text-muted-foreground">Préservées : courses en cours / terminées / annulées.</p>
          <div className="flex gap-8 justify-end">
            <Button variant="outline" onClick={() => setShowCascadeConfirm(false)}>Annuler</Button>
            <form action={updateRecurrenceAction}>
              <input type="hidden" name="id" value={recurrence.id} />
              {/* ... autres champs hidden ... */}
              <Button type="submit" variant="destructive">Confirmer</Button>
            </form>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
```

---

## Test E2E Playwright

`apps/web/e2e/phase-05-recurrence-dialyse.spec.ts` :

```ts
test('régulatrice crée récurrence dialyse 3×/sem avec saut jour férié 974', async ({ page }) => {
  await loginAsRegulateur(page);
  await page.goto('/patients/<seed-id-mme-hoarau>');
  await page.click('button:has-text("Nouvelle récurrence")');
  
  // Sélectionner Lun/Mer/Ven
  await page.click('[data-day="MO"]');
  await page.click('[data-day="WE"]');
  await page.click('[data-day="FR"]');
  
  // Date début avant 1er mai (jour férié)
  await page.fill('input[name="start_date"]', '2026-04-27');
  
  // Preview affiche 1er mai grisé
  await expect(page.getByText(/Jour férié/)).toBeVisible();
  
  // Soumettre
  await page.click('button:has-text("Créer occurrences")');
  await expect(page.getByText(/occurrences créées/)).toBeVisible();
});
```

---

## Success criteria Wave 3

1. Régulatrice crée récurrence dialyse 3×/sem depuis fiche patient
2. Preview live affiche 4 prochaines occurrences avec jours fériés 974 grisés
3. Validation Zod côté Server Action
4. Génération eager 3 mois batch insert rides (DEC-047)
5. Modal édition active affiche alerte + confirmation cascade DEC-048
6. UPDATE supprime futures non-démarrées + regen (préserve en_cours/terminee/annulee)
7. Audit logs `recurrence.create` + `recurrence.update_cascade`
8. Test E2E récurrence avec saut jour férié PASS
9. typecheck PASS

---

## Risques + Mitigations

- **rrule.js timezone DST** : Réunion sans DST. `dtstart` en local time fonctionne. À tester avec Lundi 8h Réunion.
- **Volume rides batch INSERT** : 3 mois × 3/sem = ~36 rides max. Largement supportable.
- **Cascade UPDATE perceived risk** : DEC-048 confirmation 2 étapes obligatoire UX (`setShowCascadeConfirm` boolean state).
- **Preview re-compute trop fréquent** : `useMemo` avec deps `[rruleStr, startDate, holidays974]`.

---

## Anti-patterns / NE PAS FAIRE

- ❌ Génération sans preview (régulatrice doit voir avant submit)
- ❌ UPDATE recurrence active sans confirmation cascade (DEC-048 LOCKED)
- ❌ DELETE rides `en_cours`/`terminee`/`annulee` lors regen (préservation intégrité métier)
- ❌ UI fréquence custom "tous les X jours" (rrule.js BYDAY suffit)
- ❌ Hardcoder holidays_974 côté client (fetch BDD via hook)

---

## Commit message proposé

```
feat(05-w3): modal récurrence création/édition + preview 4 occurrences

3 composants UI (RecurrenceCreateModal Surface 2 / RecurrenceEditModal
Surface 3 cascade DEC-048 / RecurrencePreview live useMemo).
3 Server Actions (createRecurrenceAction génération eager 3 mois
DEC-047 + updateRecurrenceAction regen futures non-démarrées DEC-048
+ cancelRecurrenceAction archived_at).
Hook useHolidays974 fetch BDD avec cache.

Test E2E récurrence dialyse 3×/sem avec saut jour férié 974.

Refs : DEC-046 rrule.js / DEC-047 eager 3 mois / DEC-048 cascade /
DEC-041 row count check / UI-SPEC Surfaces 2+3.
```
