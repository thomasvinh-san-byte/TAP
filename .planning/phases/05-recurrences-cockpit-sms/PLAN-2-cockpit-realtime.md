# Plan-2 — Cockpit Realtime + courses table dense

**Phase**: 05
**Wave**: 2/7
**Dépendances**: aucune (parallèle W1 possible — pas de migration BDD touchée)
**Estimation**: 2h (vélocité projetée 25-40 min réel)
**Refs**: DEC-049 channel global cockpit:rides, DEC-054 landing /cockpit, DEC-020 fade-in template.tsx, NFR-004 anti-framer-motion, Source 1 Supabase Realtime PG17, Source 4 cockpit dense, Source 7 Realtime UI

---

## Goal

Livrer le cockpit régulatrice `/cockpit` avec table dense Linear-style (row 40px) + Realtime Supabase `postgres_changes` sur `rides` + alertes panel. TTI < 2s (COCK-02). Fade-in subtle INSERT (PAS de flash, PAS d'auto-scroll). Redirect login régulatrice → `/cockpit` (DEC-054).

---

## Fichiers à créer (10)

```
apps/web/src/app/(app)/cockpit/
  page.tsx                                    # Server Component SSR initial
  _components/
    cockpit-content.client.tsx                # Wrapper Realtime subscription
    courses-table.client.tsx                  # Table HTML native (PAS TanStack V1.5)
    course-row.client.tsx                     # Row 40px + fade-in 200ms INSERT
    alerts-panel.client.tsx                   # Stack droite w-80
    alert-card.client.tsx                     # Card individuelle alerte
    realtime-status-badge.client.tsx          # Indicateur connecté/reconnecting
  _lib/
    use-cockpit-rides.ts                      # Hook subscription postgres_changes rides
    use-cockpit-alerts.ts                     # Hook subscription ride_events alerts
```

## Fichiers à modifier (1-2)

- `apps/web/src/middleware.ts` OU `apps/web/src/app/(auth)/login/actions.ts` — redirect role régulateur → `/cockpit` (DEC-054)
- `apps/web/src/app/globals.css` — keyframes `@keyframes cockpit-row-fade-in` (CSS natif, NFR-004 anti-framer-motion)

---

## Architecture

### `page.tsx` — Server Component SSR

```tsx
import { createClient } from '@/lib/supabase/server';
import { CockpitContent } from './_components/cockpit-content.client';
import { redirect } from 'next/navigation';

export default async function CockpitPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Fetch initial rides + alerts (SSR pour TTI < 2s COCK-02)
  const today = new Date().toISOString().slice(0, 10);
  const { data: rides } = await supabase
    .from('rides')
    .select('id, scheduled_at, status, pickup_address, dropoff_address, patient:patients(prenom, nom), driver:drivers(prenom, nom)')
    .gte('scheduled_at', `${today}T00:00:00`)
    .lte('scheduled_at', `${today}T23:59:59`)
    .order('scheduled_at');

  const { data: alerts } = await supabase
    .from('ride_events')
    .select('id, ride_id, event_type, payload, created_at')
    .in('event_type', ['patient_no_show', 'sms_failed', 'ride_delayed'])
    .gte('created_at', `${today}T00:00:00`)
    .order('created_at', { ascending: false })
    .limit(20);

  return <CockpitContent initialRides={rides ?? []} initialAlerts={alerts ?? []} />;
}
```

### `cockpit-content.client.tsx` — Wrapper Realtime

```tsx
'use client';
import { useCockpitRides } from '../_lib/use-cockpit-rides';
import { useCockpitAlerts } from '../_lib/use-cockpit-alerts';
import { CoursesTable } from './courses-table.client';
import { AlertsPanel } from './alerts-panel.client';
import { RealtimeStatusBadge } from './realtime-status-badge.client';

export function CockpitContent({ initialRides, initialAlerts }) {
  const { rides, status } = useCockpitRides(initialRides);
  const { alerts } = useCockpitAlerts(initialAlerts);
  return (
    <div className="flex h-full">
      <main className="flex-1 px-24 py-16 overflow-y-auto">
        <header className="flex items-center justify-between mb-16">
          <h1 className="text-2xl font-semibold">Ma journée</h1>
          <RealtimeStatusBadge status={status} />
        </header>
        <CoursesTable rides={rides} />
      </main>
      <aside className="w-80 border-l px-16 py-16">
        <AlertsPanel alerts={alerts} />
      </aside>
    </div>
  );
}
```

### `use-cockpit-rides.ts` — Hook Supabase Realtime

```ts
'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export function useCockpitRides(initial) {
  const [rides, setRides] = useState(initial);
  const [status, setStatus] = useState<'connected' | 'reconnecting' | 'disconnected'>('connected');

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel('cockpit:rides') // DEC-049 channel global MVP
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rides' }, (payload) => {
        setRides((current) => {
          if (payload.eventType === 'INSERT') return [...current, payload.new];
          if (payload.eventType === 'UPDATE') return current.map((r) => r.id === payload.new.id ? payload.new : r);
          if (payload.eventType === 'DELETE') return current.filter((r) => r.id !== payload.old.id);
          return current;
        });
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') setStatus('connected');
        if (status === 'CHANNEL_ERROR') setStatus('reconnecting');
        if (status === 'CLOSED') setStatus('disconnected');
      });
    return () => { supabase.removeChannel(channel); };
  }, []);

  return { rides, status };
}
```

### `course-row.client.tsx` — fade-in 200ms

```tsx
'use client';
import { useEffect, useState } from 'react';

export function CourseRow({ ride, isNew = false }) {
  const [mounted, setMounted] = useState(!isNew);
  useEffect(() => { if (isNew) setTimeout(() => setMounted(true), 0); }, [isNew]);
  return (
    <tr
      className={`h-10 border-b ${mounted ? 'cockpit-row-fade-in' : 'opacity-0'}`}
      style={{ animationDuration: '200ms' }}
    >
      <td className="px-12 tabular-nums">{formatTime(ride.scheduled_at)}</td>
      <td className="px-12 truncate">{ride.patient?.prenom} {ride.patient?.nom}</td>
      <td className="px-12 truncate text-sm text-muted-foreground">{ride.pickup_address}</td>
      <td className="px-12">{ride.driver?.prenom ?? '—'}</td>
      <td className="px-12"><StatusBadge status={ride.status} /></td>
    </tr>
  );
}
```

### `globals.css` — keyframes ajout

```css
@keyframes cockpit-row-fade-in {
  from { opacity: 0; transform: scale(0.98); }
  to { opacity: 1; transform: scale(1); }
}
.cockpit-row-fade-in {
  animation-name: cockpit-row-fade-in;
  animation-fill-mode: both;
  animation-timing-function: ease-out;
}
```

### Redirect login régulatrice (DEC-054)

Modifier `middleware.ts` ou `(auth)/login/actions.ts` selon où le redirect est actuellement géré :

```ts
// Après auth.signInWithPassword + fetch profile.role :
if (profile.role === 'regulateur' || profile.role === 'dirigeant') {
  return redirect('/cockpit'); // DEC-054 (au lieu de /patients ou /courses)
}
if (profile.role === 'chauffeur') return redirect('/conduite');
```

**Backward compat** : `/patients`, `/courses`, `/caisse` restent accessibles via menu navigation header (cohérent UX no breaking).

---

## Skeleton states (3 variants)

Dans `cockpit-content.client.tsx` :

```tsx
{rides.length === 0 && status === 'connected' && (
  <EmptyState
    illustration="..."
    title="Aucune course aujourd'hui"
    cta={{ label: 'Créer une course', href: '/courses' }}
  />
)}
{status === 'disconnected' && (
  <ErrorBanner message="Connexion temps réel interrompue. Reconnexion automatique en cours…" />
)}
```

Loading state SSR initial = pas de skeleton (data déjà fetched). Si fallback Suspense future Phase 06 : 8 rows `<Skeleton className="h-10" />`.

---

## Success criteria Wave 2

1. `/cockpit` accessible (route Server Component)
2. Login régulateur redirige `/cockpit` (DEC-054)
3. SSR initial fetch rides + alerts du jour
4. Realtime `postgres_changes` subscribed channel `cockpit:rides` (DEC-049)
5. INSERT row → fade-in 200ms visible (PAS de flash, PAS d'auto-scroll)
6. UPDATE row → re-render valeur sans animation
7. DELETE row → disparition immédiate (PAS d'animation = perceived bug)
8. Sidebar 256px + main flex-1 + alertes w-80 (responsive `<1280px` → stacked)
9. RealtimeStatusBadge couleurs : vert connected / amber reconnecting / rouge disconnected
10. `pnpm typecheck` PASS

---

## Risques + Mitigations

- **TTI < 2s COCK-02** : SSR initial fetch limit 50 rides + indexes scheduled_at déjà OK. Mesure post-deploy Vercel.
- **Realtime channel scope global** : DEC-049 LOCKED MVP. Multi-tenant Phase 06+ (filter `organization_id` via publication `filter_row` Source 1 Supabase Realtime PG17 12ms p90).
- **Auto-scroll temptation** : ANTI-PATTERN explicite UI-SPEC. Tester manuellement après INSERT : la régulatrice doit pouvoir consulter une ligne sans être scrolled.
- **Framer-motion temptation** : NFR-004 anti-framer-motion. CSS keyframes natif suffit, performance > library.

---

## Anti-patterns / NE PAS FAIRE

- ❌ TanStack Table / TanStack Virtual V1.5 (<100 rows, DOM natif suffit — dette CONCERNS si scale)
- ❌ framer-motion (NFR-004, CSS keyframes natif)
- ❌ Auto-scroll lors INSERT (frustre régulatrice)
- ❌ Notification sonore Realtime (pollution audio)
- ❌ Modal bloquant alertes (slide-in latéral W6, pas cette wave)
- ❌ Pagination si <100 rows (filter/sort suffit)
- ❌ Row > 48px (perte density)

---

## Commit message proposé

```
feat(05-w2): cockpit Realtime postgres_changes + table dense 40px + redirect login

Route /cockpit Server Component SSR fetch initial rides + alerts du
jour. Hook useCockpitRides subscription channel cockpit:rides
(DEC-049 global MVP). CourseRow fade-in 200ms INSERT via CSS keyframes
(NFR-004 anti-framer-motion). Sidebar 256px + main flex-1 + alertes
w-80. RealtimeStatusBadge connected/reconnecting/disconnected.

Login régulateur/dirigeant redirige /cockpit (DEC-054). /patients,
/courses, /caisse restent accessibles via menu nav.

Refs : DEC-049/054/020, NFR-004, Source 1 Supabase Realtime PG17,
Source 4 cockpit dense Linear/Notion.
```
