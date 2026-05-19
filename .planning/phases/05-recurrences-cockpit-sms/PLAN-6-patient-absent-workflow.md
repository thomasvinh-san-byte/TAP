# Plan-6 — Workflow patient absent (Route Handler + modal cockpit + PWA)

**Phase**: 05
**Wave**: 6/7
**Dépendances**: Wave 1 (rides_no_show_columns + ride_events) + Wave 2 (cockpit) + Phase 04.9 PWA stable
**Estimation**: 2h (vélocité projetée 25-40 min réel)
**Refs**: DEC-053 endpoint cohérent DEC-045, DEC-055 notif famille Phase 06, DEC-041 row count check, UI-SPEC Surfaces 5+6

---

## Goal

Workflow E2E patient absent : chauffeur PWA déclare absence (Route Handler PWA cohérent DEC-045 pattern Phase 04.9) → ride_events INSERT → Realtime alerte cockpit régulatrice modal slide-in < 5s → décision Reprogrammer/Annuler → audit_logs.

---

## Fichiers à créer (5)

### PWA chauffeur (2 nouveaux + 1 modif)

```
apps/web/src/app/(driver)/conduite/_components/
  no-show-button.client.tsx              # NEW bouton h-12 secondaire
  no-show-modal.client.tsx               # NEW confirmation + motif

apps/web/src/app/api/driver/rides/[rideId]/no-show/route.ts  # NEW Route Handler
```

### Cockpit (1 nouveau + 1 modif)

```
apps/web/src/app/(app)/cockpit/_components/
  no-show-alert-modal.client.tsx         # NEW slide-in droite + 2 CTA

apps/web/src/app/(app)/cockpit/actions.ts  # NEW Server Actions
  rescheduleRideAction
  cancelRideForNoShowAction
```

### Fichiers à modifier

- `apps/web/src/app/(driver)/conduite/_components/ride-actions.client.tsx` — ajout `<NoShowButton />` sous « Démarrer la course » (status `assignee` only)
- `apps/web/src/lib/offline/sync-engine.ts` — étendre `MutationType` avec `'no_show_ride'` + mapping endpoint ligne ~89
- `apps/web/src/lib/offline/dexie-schema.ts` — `MutationType` ajout `'no_show_ride'`
- `apps/web/src/app/(app)/cockpit/_components/cockpit-content.client.tsx` (Wave 2) — détecter event `patient_no_show` → ouvrir `<NoShowAlertModal />`

---

## Route Handler `/api/driver/rides/[rideId]/no-show/route.ts`

Cohérent **DEC-045 pattern Phase 04.9** (start/end route handlers) :
- Auth cookies Supabase via middleware
- Idempotency UUID dédup via table `idempotency_keys` existante
- Status guard (`assignee` OR `en_route_pickup` only)
- Row count check DEC-041
- INSERT `ride_events` type `patient_no_show` + UPDATE `rides.no_show_at`
- audit_logs

```ts
import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const inputSchema = z.object({
  idempotency_key: z.string().uuid(),
  motif: z.string().max(200).optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { rideId: string } },
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const parsed = inputSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.errors[0]?.message }, { status: 400 });

  const { rideId } = params;
  const { idempotency_key, motif } = parsed.data;

  // 1. Idempotency check (réutilise table Phase 04.9)
  const { data: existing } = await supabase
    .from('idempotency_keys')
    .select('response_json')
    .eq('key', idempotency_key)
    .eq('user_id', user.id)
    .eq('mutation_type', 'no_show_ride')
    .eq('resource_id', rideId)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();
  if (existing) return NextResponse.json(existing.response_json);

  // 2. Status guard (ride doit être assignee ou en_route_pickup, pas en_cours/terminee)
  const { data: ride } = await supabase
    .from('rides')
    .select('id, status, driver_id, organization_id')
    .eq('id', rideId)
    .single();
  if (!ride) return NextResponse.json({ error: 'Ride introuvable' }, { status: 404 });
  if (!['assignee', 'en_route_pickup'].includes(ride.status)) {
    return NextResponse.json({ error: `Statut ${ride.status} ne permet pas no-show.` }, { status: 409 });
  }

  // 3. UPDATE rides + INSERT ride_events (atomic via transaction simulée)
  const nowIso = new Date().toISOString();
  const { data: updated, error: updErr } = await supabase
    .from('rides')
    .update({ no_show_at: nowIso, no_show_motif: motif ?? null })
    .eq('id', rideId)
    .select('id');
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });
  if (!updated || updated.length === 0) {
    return NextResponse.json({ error: 'Update refusé (RLS).' }, { status: 403 }); // DEC-041
  }

  const { error: evtErr } = await supabase
    .from('ride_events')
    .insert({
      ride_id: rideId,
      event_type: 'patient_no_show',
      payload: { motif, declared_by_driver: user.id, declared_at: nowIso },
    });
  if (evtErr) return NextResponse.json({ error: evtErr.message }, { status: 500 });

  // 4. Audit log
  await supabase.from('audit_logs').insert({
    actor_id: user.id,
    action_type: 'ride.patient_no_show',
    payload: { ride_id: rideId, motif, declared_at: nowIso },
  });

  // 5. Cache idempotency
  const response = { success: true, ride_id: rideId, declared_at: nowIso };
  await supabase.from('idempotency_keys').insert({
    key: idempotency_key,
    user_id: user.id,
    mutation_type: 'no_show_ride',
    resource_id: rideId,
    response_json: response,
  });

  return NextResponse.json(response);
}
```

---

## PWA chauffeur composants

### `no-show-button.client.tsx`

```tsx
'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { NoShowModal } from './no-show-modal.client';

interface Props {
  rideId: string;
  rideStatus: string;
}

export function NoShowButton({ rideId, rideStatus }: Props) {
  const [open, setOpen] = useState(false);

  // Affiché uniquement si ride pas démarrée
  if (!['assignee', 'en_route_pickup'].includes(rideStatus)) return null;

  return (
    <>
      {/* h-12 inverse intentionnel vs h-14 « Démarrer » (DEC-014 anti mis-tap) */}
      <Button
        type="button"
        variant="outline"
        onClick={() => setOpen(true)}
        className="h-12 w-full text-sm text-destructive border-destructive/30 hover:bg-destructive/5"
      >
        Patient absent
      </Button>
      <NoShowModal open={open} onOpenChange={setOpen} rideId={rideId} />
    </>
  );
}
```

### `no-show-modal.client.tsx`

```tsx
'use client';
import { useState } from 'react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { enqueue } from '@/lib/offline/sync-engine';

export function NoShowModal({ open, onOpenChange, rideId }) {
  const [motif, setMotif] = useState('');
  const [pending, setPending] = useState(false);
  const router = useRouter();

  const handleSubmit = async () => {
    setPending(true);
    const idempotency_key = crypto.randomUUID();

    try {
      if (!navigator.onLine) throw new Error('offline');
      const res = await fetch(`/api/driver/rides/${rideId}/no-show`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idempotency_key, motif: motif || undefined }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (res.status >= 400 && res.status < 500) {
          toast.error(data.error ?? `HTTP ${res.status}`);
          setPending(false);
          return;
        }
        throw new Error(`HTTP ${res.status}`);
      }
      toast.success('Absence déclarée. Régulatrice alertée.');
      onOpenChange(false);
      router.refresh();
    } catch {
      // Offline ou 5xx → enqueue Dexie (Phase 04.9 sync engine pattern)
      await enqueue({
        type: 'no_show_ride',
        resource_id: rideId,
        payload: { motif: motif || undefined },
      });
      toast.warning('Absence enregistrée — sync au retour réseau');
      onOpenChange(false);
      router.refresh();
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>Confirmer l'absence patient</DialogTitle>
        <p className="text-sm">Vous déclarez l'absence du patient. La régulatrice sera alertée.</p>
        <div className="space-y-8">
          <label className="text-xs font-medium">Motif (optionnel)</label>
          <textarea
            value={motif}
            onChange={(e) => setMotif(e.target.value.slice(0, 200))}
            className="w-full border rounded-md p-12 text-sm"
            rows={3}
            maxLength={200}
          />
        </div>
        <div className="flex gap-8 justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>Annuler</Button>
          <Button onClick={handleSubmit} disabled={pending}>
            {pending ? 'Envoi…' : 'Confirmer absence'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

### Modif `ride-actions.client.tsx`

Ajouter en bas (après `<Button>Démarrer</Button>`) :

```tsx
import { NoShowButton } from './no-show-button.client';

// ... dans render:
<NoShowButton rideId={rideId} rideStatus={status} />
```

### Modif `sync-engine.ts` + `dexie-schema.ts`

```ts
// dexie-schema.ts
export type MutationType = 'start_ride' | 'end_ride' | 'no_show_ride';

// sync-engine.ts flushQueue, ligne ~89 endpoint mapping :
const endpointMap: Record<MutationType, string> = {
  start_ride: `/api/driver/rides/${m.resource_id}/start`,
  end_ride: `/api/driver/rides/${m.resource_id}/end`,
  no_show_ride: `/api/driver/rides/${m.resource_id}/no-show`,
};
const endpoint = endpointMap[m.type];
```

---

## Cockpit composants

### `no-show-alert-modal.client.tsx` — slide-in droite

```tsx
'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { rescheduleRideAction, cancelRideForNoShowAction } from '../actions';

export function NoShowAlertModal({ alert, onClose }) {
  const [showReschedule, setShowReschedule] = useState(false);

  // Slide-in fixed right (pas modal bloquant cockpit)
  return (
    <div
      role="dialog"
      aria-label="Patient absent au pickup"
      className="fixed right-0 top-16 bottom-16 w-96 bg-background border-l shadow-2xl p-16 z-50"
      style={{ animation: 'no-show-slide-in 200ms ease-out' }}
    >
      <header className="flex items-center justify-between mb-16">
        <h2 className="text-lg font-semibold text-destructive">⚠ Patient absent au pickup</h2>
        <button onClick={onClose}>×</button>
      </header>
      <dl className="space-y-8 text-sm mb-16">
        <div><dt>Patient</dt><dd>{alert.patient_name}</dd></div>
        <div><dt>Course</dt><dd>{alert.scheduled_at_fmt} — {alert.pickup_address}</dd></div>
        <div><dt>Chauffeur</dt><dd>{alert.driver_name}</dd></div>
        {alert.motif && <div><dt>Motif</dt><dd className="italic">« {alert.motif} »</dd></div>}
      </dl>
      <div className="space-y-8">
        <Button onClick={() => setShowReschedule(true)} className="w-full">Reprogrammer</Button>
        <form action={cancelRideForNoShowAction}>
          <input type="hidden" name="ride_id" value={alert.ride_id} />
          <Button type="submit" variant="outline" className="w-full text-destructive border-destructive/30">
            Annuler la course
          </Button>
        </form>
      </div>
      <hr className="my-16" />
      {/* DEC-055 reporté Phase 06 — checkbox grisé */}
      <label className="flex items-center gap-8 text-xs text-muted-foreground">
        <input type="checkbox" disabled />
        Notifier la famille (Phase 06)
      </label>
      <button onClick={onClose} className="mt-16 text-xs text-muted-foreground underline">
        Garder ouvert — décider plus tard
      </button>

      {showReschedule && (
        <RescheduleInline rideId={alert.ride_id} onClose={() => setShowReschedule(false)} />
      )}
    </div>
  );
}
```

### `cockpit/actions.ts`

```ts
'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

const rescheduleSchema = z.object({
  ride_id: z.string().uuid(),
  new_scheduled_at: z.string().datetime(),
});

export async function rescheduleRideAction(formData: FormData) {
  const ctx = await getAuthContext();
  if (!ctx || ctx.role !== 'regulateur') return { error: 'Accès réservé.' };

  const parsed = rescheduleSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.errors[0]?.message };

  // Fetch ride original pour clone
  const { data: original } = await ctx.supabase
    .from('rides').select('*').eq('id', parsed.data.ride_id).single();
  if (!original) return { error: 'Ride introuvable.' };

  // Insert nouveau ride avec original_ride_id link (à vérifier colonne BDD)
  const { data: newRide, error } = await ctx.supabase
    .from('rides')
    .insert({
      ...original,
      id: undefined,
      scheduled_at: parsed.data.new_scheduled_at,
      status: 'non_assignee',
      no_show_at: null,
      no_show_motif: null,
      original_ride_id: original.id, // si colonne existe (à valider migration future ou commenter)
      created_at: undefined,
      created_by: ctx.user_id,
    })
    .select('id')
    .single();
  if (error || !newRide) return { error: error?.message ?? 'Creation échouée.' };

  await ctx.supabase.from('audit_logs').insert({
    actor_id: ctx.user_id,
    action_type: 'ride.patient_no_show.reschedule',
    payload: { original_ride_id: original.id, new_ride_id: newRide.id, new_scheduled_at: parsed.data.new_scheduled_at },
  });

  revalidatePath('/cockpit');
  return { success: true, new_ride_id: newRide.id };
}

export async function cancelRideForNoShowAction(formData: FormData) {
  const ctx = await getAuthContext();
  if (!ctx || ctx.role !== 'regulateur') return { error: 'Accès réservé.' };

  const rideId = formData.get('ride_id') as string;
  const { data, error } = await ctx.supabase
    .from('rides')
    .update({ status: 'annulee_patient' })
    .eq('id', rideId)
    .select('id');
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: 'Update refusé.' }; // DEC-041

  await ctx.supabase.from('audit_logs').insert({
    actor_id: ctx.user_id,
    action_type: 'ride.patient_no_show.cancel',
    payload: { ride_id: rideId },
  });

  revalidatePath('/cockpit');
  return { success: true };
}
```

### Détection event dans `cockpit-content.client.tsx` (Wave 2 modif)

```tsx
// Dans useCockpitAlerts subscribe :
.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ride_events' }, (payload) => {
  if (payload.new.event_type === 'patient_no_show') {
    setActiveAlertModal(payload.new);
  }
});
```

---

## Success criteria Wave 6

1. Chauffeur PWA voit bouton « Patient absent » sur ride `assignee`/`en_route_pickup` only
2. Click bouton → modal confirmation + motif optionnel max 200 chars
3. Submit online → Route Handler `/api/driver/rides/[id]/no-show` 200 + idempotency
4. Submit offline → enqueue Dexie type `no_show_ride` + toast warning
5. Flush online sync engine appelle endpoint cohérent DEC-045 pattern
6. INSERT `ride_events` `patient_no_show` → Realtime cockpit < 5s
7. Cockpit régulatrice modal slide-in droite (PAS modal bloquant cockpit)
8. Click Reprogrammer → nouveau ride cloné avec `original_ride_id`
9. Click Annuler → status `annulee_patient` + audit_logs
10. Checkbox notif famille GRISÉ (DEC-055 Phase 06)
11. `pnpm typecheck` PASS

---

## Risques + Mitigations

- **Colonne `original_ride_id`** pas encore en BDD : valider migration future séparée OU stocker dans `audit_logs.payload` uniquement V1.5.
- **Status guard ride_events** : RLS sur `ride_events` doit permettre chauffeur INSERT pour ses rides (à vérifier migration existante OU ajouter via PLAN-1 si manquante).
- **Idempotency déjà table existante** : Phase 04.9 a créé `idempotency_keys` avec `mutation_type` check `('start_ride','end_ride')`. Migration Wave 1 doit ALTER constraint pour ajouter `'no_show_ride'` :
  ```sql
  alter table public.idempotency_keys drop constraint idempotency_keys_mutation_type_check;
  alter table public.idempotency_keys add constraint idempotency_keys_mutation_type_check
    check (mutation_type in ('start_ride', 'end_ride', 'no_show_ride'));
  ```
  → ajouter dans PLAN-1 migration `20260519000007` ou créer migration séparée Wave 6.
- **Auto-cancel timer** : ANTI-PATTERN explicite. Régulatrice décide toujours.

---

## Anti-patterns / NE PAS FAIRE

- ❌ Auto-cancel après X min sans pickup (régulatrice décide)
- ❌ Notification famille V1.5 (DEC-055 Phase 06)
- ❌ Modal bloquant cockpit (slide-in droite, alertes lisibles en parallèle)
- ❌ Bouton h-14 « Patient absent » côté chauffeur (h-12 inverse pour anti mis-tap)
- ❌ Skip status guard (chauffeur ne peut PAS déclarer absent sur ride `en_cours`/`terminee`)

---

## Commit message proposé

```
feat(05-w6): workflow patient absent E2E (PWA → cockpit → décision)

Route Handler /api/driver/rides/[id]/no-show cohérent DEC-045 pattern
Phase 04.9 (auth cookies + idempotency UUID + status guards
assignee/en_route_pickup only + row count check DEC-041 + audit_logs).

PWA chauffeur : NoShowButton h-12 outline inverse intentionnel DEC-014
anti mis-tap + NoShowModal confirmation + motif optionnel 200 chars.
Sync engine étendu mutation type 'no_show_ride' (Dexie schema +
endpoint mapping cohérent enqueue Phase 04.9).

Cockpit régulatrice : NoShowAlertModal slide-in droite (PAS bloquant)
+ 2 CTA Reprogrammer/Annuler + audit_logs + checkbox notif famille
GRISÉ (DEC-055 Phase 06). Server Actions rescheduleRideAction
(clone ride + original_ride_id link) + cancelRideForNoShowAction
(status annulee_patient).

Détection Realtime postgres_changes ride_events type
'patient_no_show' déclenche modal cockpit < 5s.

Refs : DEC-053/045/041/055, UI-SPEC Surfaces 5+6, Phase 04.9 sync
engine pattern réutilisé.
```
