# EventsProvider — Single Source of Truth for Events Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make events a single shared source of truth. Today `useEvents` is called independently by `CalendarModule`, `useReminders`, and `TaskForm` — each holds its own copy and fetches separately, so creating an event in the calendar does not propagate to the reminder system or the task-form event-picker until each remounts, and the app issues redundant `listByOwner` reads at open. A provider fixes both: one fetch, one state, shared by all consumers.

**Architecture:** Move the existing `useEvents` state logic into an `EventsProvider` context component (an internal `useEventsState()` hook holds the load + create/update/remove/reload). `useEvents()` becomes a thin context consumer that throws if no provider is mounted. `App` wraps the authenticated shell in `<EventsProvider>`, so calendar, reminders, and the task form all read and mutate the same events; a mutation reloads once and every consumer sees it.

**Tech Stack:** React 18 context, TypeScript (strict), Vitest + @testing-library/react.

## Global Constraints

- TypeScript strict with `noUncheckedIndexedAccess`. No `as` casts in production (the existing test `as never`/`as ...` fixtures may remain). There is no ESLint; `tsc --noEmit` + tests are the gates.
- The public API is unchanged: consumers keep importing `{ useEvents }` from `"../calendar/useEvents"` and the `UseEvents` shape is identical. Only its implementation moves behind a provider, plus a new exported `EventsProvider`.
- Behavior-preserving for each consumer: same events, same loading/error, same create/update/remove/reload semantics. The only change is that they now share one instance.
- Tests that already `vi.mock("../calendar/useEvents")` (TaskForm.test, TasksModule.test, useReminders.test) are unaffected — do not touch them. Only the two tests that use the REAL hook (`useEvents.test`, `CalendarModule.test`) and `App.test` need changes.
- Do not change `eventsRepo`, the domain, or any other module's logic.

---

### Task 1: EventsProvider + context-consumer useEvents

**Files:**
- Rename + modify: `apps/web/src/calendar/useEvents.ts` → `apps/web/src/calendar/useEvents.tsx` (JSX requires `.tsx`; `git mv` so history follows; importers use the extension-less path and are unaffected)
- Test: `apps/web/src/calendar/useEvents.test.tsx`

**Interfaces:**
- Produces: `EventsProvider({ children }: { children: ReactNode })` and `useEvents(): UseEvents` (consumer — throws "must be used within an EventsProvider" if unmounted). `UseEvents` is unchanged. Task 2 mounts `EventsProvider`.

- [ ] **Step 1: Update the test to use the provider + add a dedup test**

In `apps/web/src/calendar/useEvents.test.tsx`:

Add the `EventsProvider` import and `render`:

```tsx
import { renderHook, render, act, waitFor } from "@testing-library/react";
import { useEvents, EventsProvider } from "./useEvents";
```

Change every `renderHook(() => useEvents())` call to pass the provider as the wrapper:

```tsx
    const { result } = renderHook(() => useEvents(), { wrapper: EventsProvider });
```

(Do this for ALL existing `renderHook(() => useEvents())` sites in the file — keep each test's assertions exactly as they are.)

Add a new test proving one shared fetch across two consumers:

```tsx
  it("shares one fetch and one event list across consumers under a provider", async () => {
    function Two() {
      const a = useEvents();
      const b = useEvents();
      return <div data-testid="counts">{`${a.events.length}-${b.events.length}-${a.loading}`}</div>;
    }
    render(<EventsProvider><Two /></EventsProvider>);
    await waitFor(() => expect(screen.getByTestId("counts").textContent).toBe("1-1-false"));
    expect(listByOwner).toHaveBeenCalledTimes(1); // one shared fetch, not two
  });
```

Add `screen` to the testing-library import: `import { renderHook, render, screen, act, waitFor } from "@testing-library/react";`

Add a test that the consumer requires a provider:

```tsx
  it("throws when used outside an EventsProvider", () => {
    vi.spyOn(console, "error").mockImplementation(() => {}); // suppress React's error log
    expect(() => renderHook(() => useEvents())).toThrow(/EventsProvider/);
    vi.restoreAllMocks();
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @retrorganizer/web test -- calendar/useEvents`
Expected: FAIL — `EventsProvider` is not exported yet; the dedup/throw tests can't resolve it.

- [ ] **Step 3: Implement the provider in `useEvents.tsx`**

`git mv apps/web/src/calendar/useEvents.ts apps/web/src/calendar/useEvents.tsx`, then replace its contents with (the load/mutation body is the SAME as today, just moved into `useEventsState`):

```tsx
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { eventsRepo, type Event, type EventDraft } from "@retrorganizer/core";
import { useAuth } from "../auth/AuthProvider";

export interface UseEvents {
  events: Event[];
  loading: boolean;
  error: string | null;
  create(d: EventDraft): Promise<void>;
  update(id: string, d: EventDraft): Promise<void>;
  remove(id: string): Promise<void>;
  reload(): Promise<void>;
}

function useEventsState(): UseEvents {
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!uid) { setEvents([]); setError(null); setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      setEvents(await eventsRepo.listByOwner(uid));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Échec du chargement");
    } finally {
      setLoading(false);
    }
  }, [uid]);

  useEffect(() => { void reload(); }, [reload]);

  const create = useCallback(async (d: EventDraft) => {
    if (!uid) return;
    try { await eventsRepo.create(uid, d); }
    catch (e) { setError(e instanceof Error ? e.message : "Échec de l'enregistrement"); return; }
    await reload();
  }, [uid, reload]);

  const update = useCallback(async (id: string, d: EventDraft) => {
    try { await eventsRepo.update(id, d); }
    catch (e) { setError(e instanceof Error ? e.message : "Échec de l'enregistrement"); return; }
    await reload();
  }, [reload]);

  const remove = useCallback(async (id: string) => {
    try { await eventsRepo.softDelete(id); }
    catch (e) { setError(e instanceof Error ? e.message : "Échec de la suppression"); return; }
    await reload();
  }, [reload]);

  return { events, loading, error, create, update, remove, reload };
}

const EventsContext = createContext<UseEvents | null>(null);

export function EventsProvider({ children }: { children: ReactNode }) {
  const value = useEventsState();
  return <EventsContext.Provider value={value}>{children}</EventsContext.Provider>;
}

export function useEvents(): UseEvents {
  const ctx = useContext(EventsContext);
  if (ctx === null) throw new Error("useEvents must be used within an EventsProvider");
  return ctx;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @retrorganizer/web test -- calendar/useEvents`
Expected: PASS — existing load/create/update/remove tests (now wrapped), the dedup test (`listByOwner` called once), and the throws-without-provider test. Clean stderr.

- [ ] **Step 5: Typecheck**

Run: `pnpm --filter @retrorganizer/web typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/calendar/useEvents.tsx apps/web/src/calendar/useEvents.test.tsx
git commit -m "refactor(web): EventsProvider as single source of truth for events"
```

---

### Task 2: Mount EventsProvider in the app shell

**Files:**
- Modify: `apps/web/src/App.tsx`
- Test: `apps/web/src/App.test.tsx`, `apps/web/src/calendar/CalendarModule.test.tsx`

**Interfaces:**
- Consumes: `EventsProvider` (Task 1). After this, calendar/reminders/task-form share one events instance.

- [ ] **Step 1: Wrap the authenticated shell in App.tsx**

In `apps/web/src/App.tsx`:

Add the import (next to the other calendar imports):

```tsx
import { EventsProvider } from "./calendar/useEvents";
```

The authenticated render currently is `return ( <div style={{ display: "flex", flexDirection: "column", height: "100vh", … }}> … </div> );`. Wrap that returned `<div>…</div>` in `<EventsProvider>`:

```tsx
  return (
    <EventsProvider>
      <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: tokens.color.paper }}>
        {/* …entire existing shell unchanged: header, panels, ReminderHost, nav, main/Routes… */}
      </div>
    </EventsProvider>
  );
```

Change nothing inside the shell. (The `if (loading)` and `if (!user)` early returns stay above, OUTSIDE the provider — the provider only wraps the authenticated shell so it fetches once the user is known.)

- [ ] **Step 2: Keep App.test pristine by mocking the provider to a passthrough**

In `apps/web/src/App.test.tsx`, App now renders `<EventsProvider>`, whose real implementation would call `eventsRepo.listByOwner` (un-mocked here → a rejected fetch + async state update). Mock the module to a no-op provider so the shell test stays synchronous and pristine. Add alongside the other `vi.mock(...)` calls:

```tsx
vi.mock("./calendar/useEvents", () => ({
  EventsProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useEvents: () => ({ events: [], loading: false, error: null, create: vi.fn(), update: vi.fn(), remove: vi.fn(), reload: vi.fn() }),
}));
```

Leave the three existing tests (and their `await screen.findByTestId("calendar-module")` flush) unchanged.

- [ ] **Step 3: Wrap CalendarModule.test renders in EventsProvider**

In `apps/web/src/calendar/CalendarModule.test.tsx`, `CalendarModule` now calls the context consumer, so each render needs a provider. Add the import:

```tsx
import { EventsProvider } from "./useEvents";
```

Wrap every `render(<MemoryRouter …><CalendarModule … /></MemoryRouter>)` so the provider sits INSIDE the router and AROUND the module:

```tsx
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <EventsProvider><CalendarModule initialAnchor={ANCHOR} /></EventsProvider>
      </MemoryRouter>,
    );
```

(Apply to every render call in the file, preserving each call's existing props/`initialEntries`. The provider uses the file's already-mocked `eventsRepo.listByOwner` and `useAuth`, so events load exactly as before — assertions are unchanged.)

- [ ] **Step 4: Run the affected tests**

Run: `pnpm --filter @retrorganizer/web test -- App calendar/CalendarModule`
Expected: PASS — App's 3 tests (provider mocked to passthrough, pristine stderr) and all CalendarModule tests (now wrapped, same assertions).

- [ ] **Step 5: Typecheck + full web suite**

Run: `pnpm --filter @retrorganizer/web typecheck` (expect clean)
Run: `pnpm --filter @retrorganizer/web test` (expect the whole web suite green — confirms the consumers that mock useEvents are unaffected)

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/App.tsx apps/web/src/App.test.tsx apps/web/src/calendar/CalendarModule.test.tsx
git commit -m "feat(web): mount EventsProvider so calendar, reminders and tasks share events"
```

---

## Final verification (whole branch)

- [ ] Full suite under the emulator (Java on PATH): `pnpm exec firebase emulators:exec --only auth,firestore "pnpm test"` — expect core unchanged, web green.
- [ ] `pnpm --filter @retrorganizer/web build` succeeds.
- [ ] Reason through the single-source-of-truth win in the final review: after this, creating an event in the calendar reloads the shared provider, so `useReminders` (mounted in the shell) and the task-form event-picker immediately see it — no stale per-consumer copies.
