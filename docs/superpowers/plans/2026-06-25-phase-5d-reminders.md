# Retrorganizer — Phase 5d : Rappels — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Livrer les rappels in-app : une fonction pure `computeDueReminders` (échéances des rappels d'événements via les occurrences récurrentes), un hook `useReminders` (polling minuté qui déclenche une notification navigateur si permise et alimente une liste in-app), et un `ReminderHost` (toasts in-app) monté dans l'app — pour être averti des rappels pendant que l'app est ouverte. Le push serveur FCM + Cloud Function est explicitement **différé** (infra non testable ici).

**Architecture:** Le calcul des rappels dus est une fonction pure de `packages/core` (réutilise `expandEvents` pour la récurrence). `apps/web/src/reminders/` ajoute un hook minuté qui, à chaque tick, calcule les rappels devenus dus depuis le dernier check, déclenche `new Notification(...)` si la permission est accordée, et expose la liste pour des toasts in-app (`ReminderHost`) — la voie in-app marche même sans permission de notification.

**Tech Stack:** TypeScript strict, React + Vitest + @testing-library/react (fake timers + mock de `Notification`). Pas de nouvelle dépendance.

## Global Constraints

- Produit : **Retrorganizer**. TypeScript **strict** (noUncheckedIndexedAccess ON) — dans les TESTS, `const [x] = arr` → `const x = arr[0]!` ; `.mock.calls[0][0]` → `.mock.calls[0]![0] as <Type>` ; ne jamais affaiblir le code de production.
- Aucune app ne parle directement à Firestore — les rappels s'appuient sur les événements déjà chargés via `useEvents`.
- Les rappels MVP couvrent les **événements** (champ existant `reminderOffsets: number[]`, minutes avant le début). Les rappels de tâches (le modèle `Task` n'a pas d'offsets de rappel) sont **différés**.
- `computeDueReminders` est **pur** et **plateforme-agnostique** (réutilise `expandEvents`) ; tout le temps réel (`Date.now`, `setInterval`, `Notification`) est confiné au hook web.
- L'API `Notification` peut être absente (jsdom) ou refusée : le code la garde (`typeof Notification !== "undefined"`) et la liste in-app fonctionne indépendamment.
- Réutiliser : `Event`, `expandEvents` (core) ; `useEvents` (web) ; `tokens` (ui).
- Commits fréquents, un par tâche minimum.

## Interfaces héritées (à consommer)

Depuis `@retrorganizer/core` : `Event` (title, start, end, recurrence, recurrenceExceptions, `reminderOffsets: number[]`), `expandEvents(events, rangeStart, rangeEnd): Occurrence[]` (Occurrence = `{ event, start, end }`).
Depuis `apps/web` : `useEvents()` (→ `{ events }`).
Depuis `@retrorganizer/ui` : `tokens`.

---

### Task 1: `computeDueReminders` (core)

**Files:**
- Create: `packages/core/src/reminders/dueReminders.ts`
- Modify: `packages/core/src/index.ts` (exporter reminders/dueReminders)
- Test: `packages/core/src/reminders/dueReminders.test.ts`

**Interfaces:**
- Consumes: `Event`, `expandEvents` (core).
- Produces:
  - `ReminderHit` = `{ type: "event"; entityId: string; title: string; fireAt: number; occurrenceStart: number }`.
  - `reminderKey(h: ReminderHit): string` = `"<entityId>:<occurrenceStart>:<fireAt>"` (stable de-dup / dismiss key).
  - `computeDueReminders(events: Event[], fromMs: number, toMs: number): ReminderHit[]` — for each event occurrence (expanded over `[fromMs, toMs + 1 day]` to cover offsets up to a day) and each `reminderOffset`, a reminder fires at `occurrenceStart - offset*60000`; include it when `fireAt > fromMs && fireAt <= toMs`. Returns hits sorted by `fireAt` ascending.

- [ ] **Step 1: Write the failing test — `packages/core/src/reminders/dueReminders.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { computeDueReminders, reminderKey } from "./dueReminders";
import { parseEvent, type Event } from "../domain/event";

const T = Date.UTC(2026, 0, 5, 9, 0, 0); // event start
const MIN = 60000;
const base = { ownerId: "u1", createdAt: 1, updatedAt: 1, deletedAt: null };

function mk(extra: Partial<Event> = {}): Event {
  return parseEvent({ id: "e1", ...base, title: "Réunion", start: T, end: T + 3600000, ...extra });
}

describe("computeDueReminders", () => {
  it("fires a reminder offset minutes before the start, inside the window", () => {
    const e = mk({ reminderOffsets: [10] }); // fireAt = T - 10min
    const hits = computeDueReminders([e], T - 10 * MIN - 1, T - 10 * MIN);
    expect(hits).toHaveLength(1);
    expect(hits[0]!.fireAt).toBe(T - 10 * MIN);
    expect(hits[0]!.entityId).toBe("e1");
    expect(hits[0]!.occurrenceStart).toBe(T);
  });

  it("excludes a reminder whose fire time is at or before the window start", () => {
    const e = mk({ reminderOffsets: [10] });
    expect(computeDueReminders([e], T - 10 * MIN, T)).toEqual([]); // fireAt == fromMs → excluded
  });

  it("returns nothing for an event with no reminder offsets", () => {
    expect(computeDueReminders([mk()], T - 60 * MIN, T)).toEqual([]);
  });

  it("emits a reminder for each daily recurrence in the window", () => {
    const e = mk({ recurrence: "FREQ=DAILY", reminderOffsets: [10] });
    // window spanning 3 daily reminders (day0..day2 fire times)
    const from = T - 10 * MIN - 1;
    const to = T - 10 * MIN + 2 * 24 * 60 * MIN;
    const hits = computeDueReminders([e], from, to);
    expect(hits.map((h) => h.occurrenceStart)).toEqual([T, T + 24 * 60 * MIN, T + 2 * 24 * 60 * MIN]);
  });

  it("reminderKey is stable and unique per occurrence+fire time", () => {
    const e = mk({ reminderOffsets: [10, 60] });
    const hits = computeDueReminders([e], T - 60 * MIN - 1, T - 10 * MIN);
    const keys = hits.map(reminderKey);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @retrorganizer/core test -- dueReminders`
Expected: FAIL — module `./dueReminders` not found.

- [ ] **Step 3: Implement `packages/core/src/reminders/dueReminders.ts`**

```ts
import { expandEvents } from "../domain/recurrence";
import type { Event } from "../domain/event";

const REMINDER_HORIZON_MS = 1440 * 60000; // 1 day — covers the largest reminder offset

export interface ReminderHit {
  type: "event";
  entityId: string;
  title: string;
  fireAt: number;
  occurrenceStart: number;
}

export function reminderKey(h: ReminderHit): string {
  return `${h.entityId}:${h.occurrenceStart}:${h.fireAt}`;
}

export function computeDueReminders(events: Event[], fromMs: number, toMs: number): ReminderHit[] {
  const occurrences = expandEvents(events, fromMs, toMs + REMINDER_HORIZON_MS);
  const hits: ReminderHit[] = [];
  for (const occ of occurrences) {
    for (const offset of occ.event.reminderOffsets) {
      const fireAt = occ.start - offset * 60000;
      if (fireAt > fromMs && fireAt <= toMs) {
        hits.push({ type: "event", entityId: occ.event.id, title: occ.event.title, fireAt, occurrenceStart: occ.start });
      }
    }
  }
  return hits.sort((a, b) => a.fireAt - b.fireAt);
}
```

- [ ] **Step 4: Export from `packages/core/src/index.ts`** — add:

```ts
export * from "./reminders/dueReminders";
```

- [ ] **Step 5: Run to verify it passes**

Run: `pnpm --filter @retrorganizer/core test -- dueReminders`
Expected: PASS — 5 tests. Then `pnpm --filter @retrorganizer/core typecheck` → clean.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/reminders/dueReminders.ts packages/core/src/reminders/dueReminders.test.ts packages/core/src/index.ts
git commit -m "feat(core): computeDueReminders (event reminder due times via occurrences)"
```

---

### Task 2: `useReminders` hook (web)

**Files:**
- Create: `apps/web/src/reminders/useReminders.ts`
- Test: `apps/web/src/reminders/useReminders.test.tsx`

**Interfaces:**
- Consumes: `computeDueReminders`, `reminderKey`, `type ReminderHit` (core); `useEvents` (web).
- Produces:
  - `useReminders(): { due: ReminderHit[]; dismiss(key: string): void }`
  - On mount: requests `Notification` permission once if `Notification` exists and permission is `"default"`. Starts a 60s interval; each tick computes `computeDueReminders(events, lastCheck, now)` (now = `Date.now()`, `lastCheck` starts at mount time), advances `lastCheck`, appends new hits to `due`, and for each new hit fires `new Notification(title, { body })` when `Notification.permission === "granted"`. `dismiss(key)` removes a hit by `reminderKey`. Events are read live via a ref so the interval always sees the latest. The interval is cleared on unmount.

- [ ] **Step 1: Write the failing test — `apps/web/src/reminders/useReminders.test.tsx`**

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useReminders } from "./useReminders";

const T0 = Date.UTC(2026, 0, 5, 9, 0, 0);
const MIN = 60000;

// An event whose 10-min reminder fires 30s after T0 (inside the first 60s tick window).
const event = {
  id: "e1", ownerId: "u1", createdAt: 1, updatedAt: 1, deletedAt: null,
  title: "Réunion", start: T0 + 10 * MIN + 30000, end: T0 + 70 * MIN,
  allDay: false, location: "", notes: "", recurrence: null, recurrenceExceptions: [],
  reminderOffsets: [10], contactIds: [], taskIds: [], categoryId: null, color: "", tags: [],
};

vi.mock("../calendar/useEvents", () => ({ useEvents: () => ({ events: [event] }) }));

const notifCtor = vi.fn();
class MockNotification {
  static permission = "granted";
  static requestPermission = vi.fn().mockResolvedValue("granted");
  constructor(title: string, opts?: unknown) { notifCtor(title, opts); }
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(T0);
  notifCtor.mockReset();
  vi.stubGlobal("Notification", MockNotification);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("useReminders", () => {
  it("fires a due reminder on the interval tick (in-app + Notification)", () => {
    const { result } = renderHook(() => useReminders());
    expect(result.current.due).toEqual([]);
    act(() => { vi.advanceTimersByTime(60 * 1000); }); // now = T0 + 60s
    expect(result.current.due).toHaveLength(1);
    expect(result.current.due[0]!.entityId).toBe("e1");
    expect(notifCtor).toHaveBeenCalledTimes(1);
    expect(notifCtor.mock.calls[0]![0]).toBe("Réunion");
  });

  it("dismiss removes a due reminder", () => {
    const { result } = renderHook(() => useReminders());
    act(() => { vi.advanceTimersByTime(60 * 1000); });
    const key = `${result.current.due[0]!.entityId}:${result.current.due[0]!.occurrenceStart}:${result.current.due[0]!.fireAt}`;
    act(() => { result.current.dismiss(key); });
    expect(result.current.due).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @retrorganizer/web test -- useReminders`
Expected: FAIL — module `./useReminders` not found.

- [ ] **Step 3: Implement `apps/web/src/reminders/useReminders.ts`**

```ts
import { useCallback, useEffect, useRef, useState } from "react";
import { computeDueReminders, reminderKey, type ReminderHit } from "@retrorganizer/core";
import { useEvents } from "../calendar/useEvents";

const TICK_MS = 60 * 1000;

export interface UseReminders {
  due: ReminderHit[];
  dismiss(key: string): void;
}

export function useReminders(): UseReminders {
  const { events } = useEvents();
  const eventsRef = useRef(events);
  eventsRef.current = events;
  const lastCheck = useRef<number>(Date.now());
  const [due, setDue] = useState<ReminderHit[]>([]);

  useEffect(() => {
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      void Notification.requestPermission();
    }
    const interval = setInterval(() => {
      const now = Date.now();
      const hits = computeDueReminders(eventsRef.current, lastCheck.current, now);
      lastCheck.current = now;
      if (hits.length === 0) return;
      setDue((prev) => [...prev, ...hits]);
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        for (const h of hits) {
          new Notification(h.title, { body: "Rappel d'événement" });
        }
      }
    }, TICK_MS);
    return () => clearInterval(interval);
  }, []);

  const dismiss = useCallback((key: string) => {
    setDue((prev) => prev.filter((h) => reminderKey(h) !== key));
  }, []);

  return { due, dismiss };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter @retrorganizer/web test -- useReminders`
Expected: PASS — 2 tests. Then full web suite + `pnpm --filter @retrorganizer/web typecheck` → clean.

> Note exécutant : `vi.useFakeTimers()` simule `Date.now()` ET `setInterval` ; `vi.advanceTimersByTime(60000)` avance l'horloge à T0+60s puis déclenche le tick, donc `Date.now()` vaut T0+60s dans le callback. `vi.stubGlobal("Notification", MockNotification)` fournit l'API. Ne change ni la signature ni la valeur `TICK_MS`.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/reminders/useReminders.ts apps/web/src/reminders/useReminders.test.tsx
git commit -m "feat(web): useReminders hook (interval check + browser Notification + in-app list)"
```

---

### Task 3: `ReminderHost` + montage dans l'app (web)

**Files:**
- Create: `apps/web/src/reminders/ReminderHost.tsx`
- Modify: `apps/web/src/App.tsx` (monter `<ReminderHost />`)
- Modify: `apps/web/src/App.test.tsx` (stub `ReminderHost`)
- Test: `apps/web/src/reminders/ReminderHost.test.tsx`

**Interfaces:**
- Consumes: `tokens` (ui); `useReminders`, `reminderKey` (Task 2 / core).
- Produces:
  - `ReminderHost`: `<ReminderHost />`. Uses `useReminders`. Renders nothing when `due` is empty; otherwise a fixed-position stack of toasts (one per due reminder) showing the event title + "Rappel" with a dismiss button (`aria-label="Fermer le rappel"`) that calls `dismiss(reminderKey(item))`. Each toast keyed by `reminderKey(item)`.
  - `App.tsx`: mounts `<ReminderHost />` once inside the authenticated shell (e.g. right after the `<header>`, alongside the trash panel area).
  - `App.test.tsx`: stub `ReminderHost` (it uses `useReminders` → `useEvents` → repo loads → async; stubbing keeps the App tests pristine).

- [ ] **Step 1: Write the failing test — `apps/web/src/reminders/ReminderHost.test.tsx`**

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ReminderHost } from "./ReminderHost";

const dismiss = vi.fn();
let due: { type: string; entityId: string; title: string; fireAt: number; occurrenceStart: number }[] = [];
vi.mock("./useReminders", () => ({ useReminders: () => ({ due, dismiss }) }));

beforeEach(() => { dismiss.mockReset(); due = []; });

describe("ReminderHost", () => {
  it("renders nothing when there are no due reminders", () => {
    const { container } = render(<ReminderHost />);
    expect(container.firstChild).toBeNull();
  });

  it("renders a toast per due reminder and dismisses it", () => {
    due = [{ type: "event", entityId: "e1", title: "Réunion budget", fireAt: 100, occurrenceStart: 700 }];
    render(<ReminderHost />);
    expect(screen.getByText("Réunion budget")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Fermer le rappel" }));
    expect(dismiss).toHaveBeenCalledWith("e1:700:100");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @retrorganizer/web test -- ReminderHost`
Expected: FAIL — module `./ReminderHost` not found.

- [ ] **Step 3: Implement `apps/web/src/reminders/ReminderHost.tsx`**

```tsx
import { tokens } from "@retrorganizer/ui";
import { reminderKey } from "@retrorganizer/core";
import { useReminders } from "./useReminders";

export function ReminderHost() {
  const { due, dismiss } = useReminders();
  if (due.length === 0) return null;
  return (
    <div style={{ position: "fixed", bottom: tokens.space.md, right: tokens.space.md, zIndex: 50,
      display: "flex", flexDirection: "column", gap: tokens.space.xs, width: 280 }}>
      {due.map((item) => (
        <div key={reminderKey(item)} role="status"
          style={{ background: tokens.color.surface, border: `1px solid ${tokens.color.line}`,
            borderLeft: `4px solid ${tokens.color.ink}`, borderRadius: tokens.radius.sm,
            padding: tokens.space.sm, font: `13px ${tokens.font.body}`, boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
            display: "flex", justifyContent: "space-between", alignItems: "center", gap: tokens.space.sm }}>
          <span><strong>Rappel</strong> — {item.title}</span>
          <button type="button" aria-label="Fermer le rappel" onClick={() => dismiss(reminderKey(item))}>×</button>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Stub `ReminderHost` in `apps/web/src/App.test.tsx`** — add near the other `vi.mock` calls:

```tsx
vi.mock("./reminders/ReminderHost", () => ({
  ReminderHost: () => <div data-testid="reminder-host" />,
}));
```

- [ ] **Step 5: Mount `<ReminderHost />` in `apps/web/src/App.tsx`** — add the import:

```tsx
import { ReminderHost } from "./reminders/ReminderHost";
```

Render it once inside the authenticated shell — place it right after the `<header>` (next to the existing `{trashOpen && <TrashPanel ... />}` line):

```tsx
{trashOpen && <TrashPanel onClose={() => setTrashOpen(false)} />}
<ReminderHost />
```

- [ ] **Step 6: Run to verify it passes**

Run: `pnpm --filter @retrorganizer/web test -- ReminderHost`
Expected: PASS — 2 tests.
Then full web suite `pnpm --filter @retrorganizer/web test` (App.test still green + pristine) and `pnpm --filter @retrorganizer/web typecheck` → clean, and `pnpm build` → succeeds.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/reminders/ReminderHost.tsx apps/web/src/reminders/ReminderHost.test.tsx apps/web/src/App.tsx apps/web/src/App.test.tsx
git commit -m "feat(web): in-app reminder toasts (ReminderHost) mounted in the app"
```

---

## Définition de « terminé » pour la Phase 5d

- `pnpm exec firebase emulators:exec --only auth,firestore "pnpm test"` : tous les tests verts, incluant la nouvelle suite core (**dueReminders**) et web (**useReminders, ReminderHost**), et `App.test` toujours pristine.
- `pnpm --filter @retrorganizer/core typecheck` et `pnpm --filter @retrorganizer/web typecheck` propres ; `pnpm build` produit `apps/web/dist`.
- Pendant que l'app est ouverte, à l'approche d'un événement (selon ses `reminderOffsets`), un **toast in-app** apparaît et — si la permission est accordée — une **notification navigateur** est déclenchée.

**Le MVP 1 est alors complet** : Calendrier, Tâches, Contacts, Notes, recherche globale, catégories/tags, corbeille, et rappels. Différés au-delà du MVP 1 : **push serveur FCM + Cloud Function** (rappels hors-app), rappels de **tâches** (offsets de rappel à ajouter au modèle Task), et le **fix DST des récurrences** (couche 2a, qui affecte aussi le calcul des rappels). Suite logiciel : Phase 6 — Durcissement (code-splitting du bundle, `permissions`/SHA-pinning CI, gestionnaire de catégories + nettoyage orphelins, affichage catégorie/tags dans les listes, deep-link de la recherche, etc.).
