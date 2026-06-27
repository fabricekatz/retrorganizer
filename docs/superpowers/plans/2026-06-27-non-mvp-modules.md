# Non-MVP Modules (Planner / Anniversary / Web / Calls) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the four V2-deferred tabs (Planner, Anniversary, Web, Calls) as real, Stitch-styled modules, replacing their `ComingSoon` placeholders.

**Architecture:** Two modules are pure read-only views over existing data (Planner = annual overview of events+tasks; Anniversary = upcoming dates derived from contacts' `importantDates`) — no new schema. Two are small CRUD modules with new Firestore collections (Web = `bookmarks`; Calls = `calls`), each following the existing `createRepository` factory + `reload()` hook + inline-token form + Tailwind list-screen pattern. Each module is an independently shippable PR.

**Tech Stack:** React 18 + TypeScript (strict) + Vite + Tailwind v3 (Stitch M3 tokens), Zod domain schemas, Firebase Firestore (`createRepository` factory), Vitest + React Testing Library (web, jsdom, repo mocked) / Vitest node (core, pure). pnpm + Turborepo monorepo.

## Global Constraints

- **Stitch design vocabulary on list screens only** — mirror `apps/web/src/contacts/AddressBook.tsx`: typography pairs (`font-headline-lg text-headline-lg`, `font-headline-md text-headline-md`, `font-body-md`, `font-label-sm text-label-sm`, `font-mono-data text-mono-data`); Material Symbols (`<span className="material-symbols-outlined" aria-hidden>…</span>`); color tokens (`text-on-surface`, `text-on-surface-variant`, `text-outline`, `border-outline`, `border-outline-variant`, `bg-surface-container`, `bg-surface-container-high`, `bg-primary`, `text-primary`, `bg-white/50`, `tertiary-fixed`); retro bevels `retro-outset active:retro-inset`.
- **Forms use inline `tokens` styling** (`style={{ padding: tokens.space.md, font: \`13px ${tokens.font.body}\` }}`), each input has a French `aria-label`, buttons `Enregistrer`/`Annuler`. Forms render inside a `<div className="legacy-content">` wrapper.
- **UI copy is French** (e.g. `Aucun…`, `Enregistrer`, `Annuler`, error strings `"Échec du chargement"` / `"Échec de l'enregistrement"` / `"Échec de la suppression"`).
- **All timestamps are epoch-ms `number`s**, except `LabeledDate.date` which is an ISO `yyyy-mm-dd` **string**.
- **Domain entities extend `BaseEntity`** (`id, ownerId, createdAt, updatedAt, deletedAt`) and are created via `createRepository(collectionName, parse)`. New collections need **no** `firestore.rules` change (generic `/{collection}/{docId}` owner rule covers them).
- **A Draft is the domain type minus the 5 BaseEntity fields**; `draftFromX` deep-copies arrays; `emptyXDraft()` returns neutral defaults.
- **Hooks mirror `useTasks`/`useContacts`**: `reload()` via `listByOwner(uid)`, call `reload()` after each mutation, French error strings, `{ items, loading, error, create, update, remove, reload }`.
- **Tests:** core domain/logic → pure node tests (`import { describe, it, expect } from "vitest"`); web hooks → mock `@retrorganizer/core` repo + `../auth/AuthProvider`; web screens → mock the hook(s) they call. No real Firestore in web tests.
- **Routing:** each module's final task adds a `lazy()` import in `apps/web/src/App.tsx`, extends the Routes ternary, optionally a `SCREEN_TITLE` entry, and adds a `vi.mock(...)` stub in `apps/web/src/App.test.tsx`. The tab-count assertion (8) must stay green.
- **Commit trailer** on every commit: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- **Verification before "done":** typecheck (`pnpm typecheck`), full suite under the Firestore emulator (`export PATH="/opt/homebrew/opt/openjdk/bin:$PATH"; pnpm exec firebase emulators:exec --only auth,firestore "pnpm test"`), and `pnpm --filter @retrorganizer/web build`.

---

## File Structure

**Module A — Planner** (no new schema):
- Create `packages/core/src/domain/plannerGrid.ts` — `yearMonthBuckets(year, events, tasks)` pure aggregation.
- Create `packages/core/src/domain/plannerGrid.test.ts`.
- Create `apps/web/src/planner/Planner.tsx` — Stitch year-grid screen (reads `useEvents` + `useTasks`).
- Create `apps/web/src/planner/Planner.test.tsx`.
- Modify `packages/core/src/index.ts` (+1 export), `apps/web/src/App.tsx` (lazy + route + title), `apps/web/src/App.test.tsx` (+mock).

**Module B — Anniversary** (no new schema):
- Create `packages/core/src/domain/anniversary.ts` — `upcomingAnniversaries(contacts, todayMs)` + `AnniversaryEntry`.
- Create `packages/core/src/domain/anniversary.test.ts`.
- Create `apps/web/src/anniversary/Anniversary.tsx` — Stitch list screen (reads `useContacts`).
- Create `apps/web/src/anniversary/Anniversary.test.tsx`.
- Modify `packages/core/src/index.ts`, `apps/web/src/App.tsx`, `apps/web/src/App.test.tsx`.

**Module C — Web (bookmarks)** (new `bookmarks` collection):
- Create `packages/core/src/domain/bookmark.ts` — schema + `Bookmark` + `parseBookmark` + `BookmarkDraft` + `emptyBookmarkDraft` + `draftFromBookmark`.
- Create `packages/core/src/domain/bookmarkQuery.ts` — `filterBookmarks`, `sortBookmarks`.
- Create `packages/core/src/domain/bookmark.test.ts`, `packages/core/src/domain/bookmarkQuery.test.ts`.
- Create `packages/core/src/repositories/bookmarks.ts` — `bookmarksRepo`.
- Create `apps/web/src/bookmarks/useBookmarks.ts` + `apps/web/src/bookmarks/useBookmarks.test.tsx`.
- Create `apps/web/src/bookmarks/BookmarkForm.tsx`.
- Create `apps/web/src/bookmarks/WebLinks.tsx` + `apps/web/src/bookmarks/WebLinks.test.tsx`.
- Modify `packages/core/src/index.ts` (+2 exports), `apps/web/src/App.tsx`, `apps/web/src/App.test.tsx`.

**Module D — Calls (call log)** (new `calls` collection):
- Create `packages/core/src/domain/call.ts` — schema + `Call` + `parseCall` + `CallDraft` + `emptyCallDraft` + `draftFromCall`.
- Create `packages/core/src/domain/callQuery.ts` — `filterCalls`, `sortCalls`.
- Create `packages/core/src/domain/call.test.ts`, `packages/core/src/domain/callQuery.test.ts`.
- Create `packages/core/src/repositories/calls.ts` — `callsRepo`.
- Create `apps/web/src/calls/useCalls.ts` + `apps/web/src/calls/useCalls.test.tsx`.
- Create `apps/web/src/calls/CallForm.tsx`.
- Create `apps/web/src/calls/CallLog.tsx` + `apps/web/src/calls/CallLog.test.tsx`.
- Modify `packages/core/src/index.ts` (+2 exports), `apps/web/src/App.tsx`, `apps/web/src/App.test.tsx`.

---

# MODULE A — Planner (annual year-at-a-glance)

### Task A1: Core `yearMonthBuckets` aggregation

**Files:**
- Create: `packages/core/src/domain/plannerGrid.ts`
- Test: `packages/core/src/domain/plannerGrid.test.ts`
- Modify: `packages/core/src/index.ts`

**Interfaces:**
- Consumes: `expandEvents(events, rangeStart, rangeEnd): Occurrence[]` from `./recurrence`; `Event` from `./event`; `Task` from `./task`.
- Produces: `interface MonthBucket { month: number; eventCount: number; taskCount: number }` and `yearMonthBuckets(year: number, events: Event[], tasks: Task[]): MonthBucket[]` (always length 12, index = month 0-11).

- [ ] **Step 1: Write the failing test**

```ts
// packages/core/src/domain/plannerGrid.test.ts
import { describe, it, expect } from "vitest";
import { yearMonthBuckets } from "./plannerGrid";
import { parseEvent } from "./event";
import { parseTask } from "./task";

function ev(start: number) {
  // a 1-hour, non-recurring event at `start`
  return parseEvent({
    id: `e${start}`, ownerId: "u1", createdAt: 1, updatedAt: 1, deletedAt: null,
    title: "X", start, end: start + 3600000, allDay: false,
  });
}
function task(dueDate: number | null, status = "todo") {
  return parseTask({
    id: `t${dueDate}-${status}`, ownerId: "u1", createdAt: 1, updatedAt: 1, deletedAt: null,
    title: "T", dueDate, status,
  });
}

describe("yearMonthBuckets", () => {
  it("returns 12 zeroed buckets for no data", () => {
    const b = yearMonthBuckets(2026, [], []);
    expect(b).toHaveLength(12);
    expect(b.every((x) => x.eventCount === 0 && x.taskCount === 0)).toBe(true);
    expect(b[0]!.month).toBe(0);
    expect(b[11]!.month).toBe(11);
  });

  it("counts events into their month and ignores other years", () => {
    const jan = new Date(2026, 0, 15, 9).getTime();
    const mar = new Date(2026, 2, 3, 9).getTime();
    const otherYear = new Date(2027, 0, 1, 9).getTime();
    const b = yearMonthBuckets(2026, [ev(jan), ev(mar), ev(otherYear)], []);
    expect(b[0]!.eventCount).toBe(1);
    expect(b[2]!.eventCount).toBe(1);
    expect(b.reduce((n, x) => n + x.eventCount, 0)).toBe(2);
  });

  it("counts open tasks by due-month, skipping done and undated", () => {
    const feb = new Date(2026, 1, 10).getTime();
    const b = yearMonthBuckets(2026, [], [task(feb), task(feb, "done"), task(null)]);
    expect(b[1]!.taskCount).toBe(1);
    expect(b.reduce((n, x) => n + x.taskCount, 0)).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @retrorganizer/core test -- plannerGrid`
Expected: FAIL — `yearMonthBuckets` not exported / module not found.

- [ ] **Step 3: Write the implementation**

```ts
// packages/core/src/domain/plannerGrid.ts
import { expandEvents } from "./recurrence";
import type { Event } from "./event";
import type { Task } from "./task";

export interface MonthBucket {
  month: number; // 0-11
  eventCount: number;
  taskCount: number;
}

/** Per-month counts of event occurrences and open (non-done, dated) tasks for `year`. */
export function yearMonthBuckets(year: number, events: Event[], tasks: Task[]): MonthBucket[] {
  const start = new Date(year, 0, 1).getTime();
  const end = new Date(year + 1, 0, 1).getTime();
  const buckets: MonthBucket[] = Array.from({ length: 12 }, (_, month) => ({ month, eventCount: 0, taskCount: 0 }));

  for (const occ of expandEvents(events, start, end)) {
    buckets[new Date(occ.start).getMonth()]!.eventCount++;
  }
  for (const t of tasks) {
    if (t.dueDate === null || t.status === "done") continue;
    const d = new Date(t.dueDate);
    if (d.getFullYear() === year) buckets[d.getMonth()]!.taskCount++;
  }
  return buckets;
}
```

- [ ] **Step 4: Add the barrel export**

In `packages/core/src/index.ts`, after the line `export * from "./domain/calendarGrid";` add:
```ts
export * from "./domain/plannerGrid";
```

- [ ] **Step 5: Run tests + typecheck to verify they pass**

Run: `pnpm --filter @retrorganizer/core test -- plannerGrid && pnpm --filter @retrorganizer/core typecheck`
Expected: PASS (3 tests), typecheck clean.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/domain/plannerGrid.ts packages/core/src/domain/plannerGrid.test.ts packages/core/src/index.ts
git commit -m "feat(core): yearMonthBuckets for the annual planner

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

### Task A2: Planner Stitch screen + routing

**Files:**
- Create: `apps/web/src/planner/Planner.tsx`
- Test: `apps/web/src/planner/Planner.test.tsx`
- Modify: `apps/web/src/App.tsx`, `apps/web/src/App.test.tsx`

**Interfaces:**
- Consumes: `useEvents()` from `../calendar/useEvents` (`{ events }`), `useTasks()` from `../tasks/useTasks` (`{ tasks }`), `yearMonthBuckets` from `@retrorganizer/core`, `useNavigate` from `react-router-dom`.
- Produces: `export function Planner(): JSX.Element`.

- [ ] **Step 1: Write the failing test**

```tsx
// apps/web/src/planner/Planner.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const navigate = vi.fn();
vi.mock("react-router-dom", () => ({ useNavigate: () => navigate }));
vi.mock("../calendar/useEvents", () => ({
  useEvents: () => ({
    events: [{
      id: "e1", ownerId: "u1", createdAt: 1, updatedAt: 1, deletedAt: null,
      title: "X", start: new Date(2026, 0, 10, 9).getTime(), end: new Date(2026, 0, 10, 10).getTime(),
      allDay: false, recurrence: null, recurrenceExceptions: [], location: "", description: "",
      contactIds: [], categoryId: null, tags: [], reminderOffsets: [],
    }],
  }),
}));
vi.mock("../tasks/useTasks", () => ({ useTasks: () => ({ tasks: [] }) }));

import { Planner } from "./Planner";

describe("Planner", () => {
  it("shows 12 month cells and a January count for the current year's event", () => {
    // freeze the clock to 2026 so the default year matches the fixture
    vi.setSystemTime(new Date(2026, 5, 1));
    render(<Planner />);
    expect(screen.getByRole("heading", { name: /2026/ })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /^(janv|févr|mars|avr|mai|juin|juil|août|sept|oct|nov|déc)/i }).length).toBe(12);
    // January cell shows "1 évén."
    expect(screen.getByText(/1\s*évén/i)).toBeInTheDocument();
    vi.useRealTimers();
  });

  it("navigates to the diary when a month is clicked", () => {
    vi.setSystemTime(new Date(2026, 5, 1));
    render(<Planner />);
    fireEvent.click(screen.getAllByRole("button", { name: /janv/i })[0]!);
    expect(navigate).toHaveBeenCalledWith("/diary");
    vi.useRealTimers();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @retrorganizer/web test -- Planner`
Expected: FAIL — cannot find `./Planner`.

- [ ] **Step 3: Write the implementation**

```tsx
// apps/web/src/planner/Planner.tsx
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { yearMonthBuckets } from "@retrorganizer/core";
import { useEvents } from "../calendar/useEvents";
import { useTasks } from "../tasks/useTasks";

const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

export function Planner() {
  const { events } = useEvents();
  const { tasks } = useTasks();
  const navigate = useNavigate();
  const [year, setYear] = useState(() => new Date().getFullYear());

  const buckets = useMemo(() => yearMonthBuckets(year, events, tasks), [year, events, tasks]);
  const totalEvents = buckets.reduce((n, b) => n + b.eventCount, 0);
  const totalTasks = buckets.reduce((n, b) => n + b.taskCount, 0);

  return (
    <div className="flex flex-col min-h-full font-body-md text-on-surface">
      {/* Header */}
      <div className="flex items-center justify-between border-b-2 border-primary pb-2 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="material-symbols-outlined text-primary" aria-hidden>calendar_month</span>
          <h1 className="font-headline-lg text-headline-lg text-on-surface truncate">Planner {year}</h1>
        </div>
        <span className="font-mono-data text-mono-data text-outline shrink-0">SEC: PLANNER_01</span>
      </div>

      {/* Year navigation */}
      <div className="flex items-center justify-center gap-4 mb-4 font-label-sm text-label-sm">
        <button type="button" aria-label="Année précédente" onClick={() => setYear((y) => y - 1)}
          className="px-2 py-1 border border-outline retro-outset active:retro-inset">‹</button>
        <span className="font-headline-md text-headline-md">{year}</span>
        <button type="button" aria-label="Année suivante" onClick={() => setYear((y) => y + 1)}
          className="px-2 py-1 border border-outline retro-outset active:retro-inset">›</button>
      </div>

      {/* 12-month grid */}
      <div className="grid grid-cols-3 gap-2 flex-1">
        {buckets.map((b) => {
          const empty = b.eventCount === 0 && b.taskCount === 0;
          return (
            <button
              key={b.month}
              type="button"
              aria-label={`${MONTHS[b.month]} ${year}`}
              onClick={() => navigate("/diary")}
              className={`flex flex-col items-start p-2 border border-outline-variant text-left hover:bg-primary/5 ${empty ? "bg-surface-container/40" : "bg-white/50"}`}
            >
              <span className="font-label-sm text-label-sm uppercase text-on-surface-variant">{MONTHS[b.month]!.slice(0, 4)}</span>
              <span className="font-mono-data text-mono-data text-on-surface-variant mt-1">
                {b.eventCount} évén.
              </span>
              <span className="font-mono-data text-mono-data text-on-surface-variant">
                {b.taskCount} tâche{b.taskCount > 1 ? "s" : ""}
              </span>
            </button>
          );
        })}
      </div>

      {/* Footer summary */}
      <p className="mt-3 text-center font-mono-data text-mono-data text-outline">
        {totalEvents} événement{totalEvents > 1 ? "s" : ""} · {totalTasks} tâche{totalTasks > 1 ? "s" : ""} en {year}
      </p>
    </div>
  );
}
```

- [ ] **Step 4: Wire routing in `App.tsx`**

Add a lazy import after the `NotePad` lazy line (~line 20):
```tsx
const Planner = lazy(() => import("./planner/Planner").then((m) => ({ default: m.Planner })));
```
In the Routes ternary (the `element={…}` block), insert a branch before the `s.mvp ? <SectionPlaceholder…` line:
```tsx
                          : s.id === "planner"
                            ? <Planner />
```
In `SCREEN_TITLE`, add: `planner: "Planner",`.

- [ ] **Step 5: Add the App.test mock**

In `apps/web/src/App.test.tsx`, beside the other lazy-module mocks, add:
```tsx
vi.mock("./planner/Planner", () => ({ Planner: () => <div data-testid="planner" /> }));
```

- [ ] **Step 6: Run tests + typecheck**

Run: `pnpm --filter @retrorganizer/web test -- Planner App && pnpm --filter @retrorganizer/web typecheck`
Expected: PASS (Planner 2 tests; App tests still green, 8 tabs).

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/planner/ apps/web/src/App.tsx apps/web/src/App.test.tsx
git commit -m "feat(web): annual Planner module (year-at-a-glance over events + tasks)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

> **PR boundary:** Module A complete. Run full suite + build, push branch, open PR.

---

# MODULE B — Anniversary (upcoming dates from contacts)

### Task B1: Core `upcomingAnniversaries`

**Files:**
- Create: `packages/core/src/domain/anniversary.ts`
- Test: `packages/core/src/domain/anniversary.test.ts`
- Modify: `packages/core/src/index.ts`

**Interfaces:**
- Consumes: `Contact` from `./contact`; `startOfDay`, `addDays` from `./calendarGrid`.
- Produces:
```ts
interface AnniversaryEntry {
  contactId: string;
  contactName: string;
  label: string;
  date: string;          // original yyyy-mm-dd
  nextOccurrence: number; // epoch ms, startOfDay, >= today
  daysUntil: number;     // whole days from today to nextOccurrence
  age: number | null;    // years at nextOccurrence (null if original year missing/future)
}
upcomingAnniversaries(contacts: Contact[], todayMs: number): AnniversaryEntry[]  // sorted by daysUntil asc
```

- [ ] **Step 1: Write the failing test**

```ts
// packages/core/src/domain/anniversary.test.ts
import { describe, it, expect } from "vitest";
import { upcomingAnniversaries } from "./anniversary";
import { parseContact } from "./contact";

function contact(id: string, name: string, dates: { label: string; date: string }[]) {
  return parseContact({
    id, ownerId: "u1", createdAt: 1, updatedAt: 1, deletedAt: null,
    displayName: name, importantDates: dates,
  });
}

describe("upcomingAnniversaries", () => {
  const today = new Date(2026, 5, 15).getTime(); // 2026-06-15

  it("returns one entry per important date, sorted by soonest", () => {
    const cs = [
      contact("c1", "Ada", [{ label: "Anniversaire", date: "1990-12-10" }]),
      contact("c2", "Grace", [{ label: "Anniversaire", date: "2000-06-20" }]),
    ];
    const r = upcomingAnniversaries(cs, today);
    expect(r.map((a) => a.contactName)).toEqual(["Grace", "Ada"]); // Jun 20 before Dec 10
    expect(r[0]!.daysUntil).toBe(5);
  });

  it("rolls a passed date to next year and computes age", () => {
    const cs = [contact("c1", "Ada", [{ label: "Anniversaire", date: "1990-01-01" }])];
    const r = upcomingAnniversaries(cs, today);
    expect(new Date(r[0]!.nextOccurrence).getFullYear()).toBe(2027);
    expect(r[0]!.age).toBe(37); // 2027 - 1990
  });

  it("keeps a same-day anniversary as today (0 days)", () => {
    const cs = [contact("c1", "Ada", [{ label: "Naissance", date: "1990-06-15" }])];
    const r = upcomingAnniversaries(cs, today);
    expect(r[0]!.daysUntil).toBe(0);
    expect(r[0]!.age).toBe(36);
  });

  it("ignores contacts without important dates", () => {
    expect(upcomingAnniversaries([contact("c1", "Ada", [])], today)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @retrorganizer/core test -- anniversary`
Expected: FAIL — `upcomingAnniversaries` not found.

- [ ] **Step 3: Write the implementation**

```ts
// packages/core/src/domain/anniversary.ts
import type { Contact } from "./contact";
import { startOfDay } from "./calendarGrid";

export interface AnniversaryEntry {
  contactId: string;
  contactName: string;
  label: string;
  date: string;
  nextOccurrence: number;
  daysUntil: number;
  age: number | null;
}

const DAY_MS = 86400000;

/** Flattens contacts' importantDates into upcoming yearly anniversaries, soonest first. */
export function upcomingAnniversaries(contacts: Contact[], todayMs: number): AnniversaryEntry[] {
  const today = startOfDay(todayMs);
  const todayYear = new Date(today).getFullYear();
  const out: AnniversaryEntry[] = [];

  for (const c of contacts) {
    for (const d of c.importantDates) {
      const parts = d.date.split("-");
      if (parts.length !== 3) continue;
      const origYear = Number(parts[0]);
      const month = Number(parts[1]) - 1;
      const day = Number(parts[2]);
      if (Number.isNaN(month) || Number.isNaN(day)) continue;

      let next = startOfDay(new Date(todayYear, month, day).getTime());
      if (next < today) next = startOfDay(new Date(todayYear + 1, month, day).getTime());

      const occYear = new Date(next).getFullYear();
      const age = Number.isNaN(origYear) || origYear <= 0 || origYear > occYear ? null : occYear - origYear;

      out.push({
        contactId: c.id,
        contactName: c.displayName,
        label: d.label,
        date: d.date,
        nextOccurrence: next,
        daysUntil: Math.round((next - today) / DAY_MS),
        age,
      });
    }
  }
  return out.sort((a, b) => a.daysUntil - b.daysUntil);
}
```

- [ ] **Step 4: Add the barrel export**

In `packages/core/src/index.ts`, after `export * from "./domain/plannerGrid";` add:
```ts
export * from "./domain/anniversary";
```

- [ ] **Step 5: Run tests + typecheck**

Run: `pnpm --filter @retrorganizer/core test -- anniversary && pnpm --filter @retrorganizer/core typecheck`
Expected: PASS (4 tests), typecheck clean.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/domain/anniversary.ts packages/core/src/domain/anniversary.test.ts packages/core/src/index.ts
git commit -m "feat(core): upcomingAnniversaries derived from contacts' importantDates

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

### Task B2: Anniversary Stitch screen + routing

**Files:**
- Create: `apps/web/src/anniversary/Anniversary.tsx`
- Test: `apps/web/src/anniversary/Anniversary.test.tsx`
- Modify: `apps/web/src/App.tsx`, `apps/web/src/App.test.tsx`

**Interfaces:**
- Consumes: `useContacts()` from `../contacts/useContacts` (`{ contacts }`), `upcomingAnniversaries`, `type AnniversaryEntry` from `@retrorganizer/core`.
- Produces: `export function Anniversary(): JSX.Element`.

- [ ] **Step 1: Write the failing test**

```tsx
// apps/web/src/anniversary/Anniversary.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

let mockContacts: unknown[] = [];
vi.mock("../contacts/useContacts", () => ({ useContacts: () => ({ contacts: mockContacts }) }));

import { Anniversary } from "./Anniversary";

const ada = {
  id: "c1", ownerId: "u1", createdAt: 1, updatedAt: 1, deletedAt: null, firstName: "", lastName: "",
  displayName: "Ada Lovelace", phones: [], emails: [], addresses: [], webLinks: [],
  importantDates: [{ label: "Anniversaire", date: "1990-12-10" }], customFields: [], categoryId: null, tags: [],
};

beforeEach(() => { vi.useRealTimers(); mockContacts = []; });

describe("Anniversary", () => {
  it("lists upcoming anniversaries with contact name and label", () => {
    vi.setSystemTime(new Date(2026, 5, 15));
    mockContacts = [ada];
    render(<Anniversary />);
    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByText(/Anniversaire/)).toBeInTheDocument();
  });

  it("shows an empty state when there are no anniversaries", () => {
    mockContacts = [];
    render(<Anniversary />);
    expect(screen.getByText(/Aucun anniversaire/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @retrorganizer/web test -- anniversary/Anniversary`
Expected: FAIL — cannot find `./Anniversary`.

- [ ] **Step 3: Write the implementation**

```tsx
// apps/web/src/anniversary/Anniversary.tsx
import { useMemo } from "react";
import { upcomingAnniversaries, type AnniversaryEntry } from "@retrorganizer/core";
import { useContacts } from "../contacts/useContacts";

const MONTHS_SHORT = ["JANV", "FÉVR", "MARS", "AVR", "MAI", "JUIN", "JUIL", "AOÛT", "SEPT", "OCT", "NOV", "DÉC"];

function whenLabel(a: AnniversaryEntry): string {
  if (a.daysUntil === 0) return "AUJOURD'HUI";
  if (a.daysUntil === 1) return "DEMAIN";
  return `DANS ${a.daysUntil} JOURS`;
}

export function Anniversary() {
  const { contacts } = useContacts();
  const entries = useMemo(() => upcomingAnniversaries(contacts, Date.now()), [contacts]);

  return (
    <div className="flex flex-col min-h-full font-body-md text-on-surface">
      <div className="flex items-center justify-between border-b-2 border-primary pb-2 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="material-symbols-outlined text-primary" aria-hidden>cake</span>
          <h1 className="font-headline-lg text-headline-lg text-on-surface truncate">Anniversaires</h1>
        </div>
        <span className="font-mono-data text-mono-data text-outline shrink-0">SEC: ANNIV_01</span>
      </div>

      {entries.length === 0 ? (
        <p className="py-6 text-center text-on-surface-variant italic">Aucun anniversaire à venir</p>
      ) : (
        <div className="flex flex-col">
          {entries.map((a) => {
            const d = new Date(a.nextOccurrence);
            return (
              <div key={`${a.contactId}:${a.date}:${a.label}`}
                className={`flex items-center gap-3 py-2 border-b border-outline-variant ${a.daysUntil === 0 ? "bg-tertiary-fixed" : ""}`}>
                <div className="flex flex-col items-center justify-center w-12 shrink-0 border border-outline-variant py-1 bg-white/50">
                  <span className="font-mono-data text-mono-data text-on-surface-variant">{MONTHS_SHORT[d.getMonth()]}</span>
                  <span className="font-headline-md text-headline-md leading-none">{d.getDate()}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-body-md truncate">{a.contactName}</div>
                  <div className="font-mono-data text-mono-data text-on-surface-variant">
                    {a.label}{a.age !== null ? ` · ${a.age} ans` : ""}
                  </div>
                </div>
                <span className="font-label-sm text-label-sm uppercase text-primary shrink-0">{whenLabel(a)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Wire routing in `App.tsx`**

Lazy import after `Planner`:
```tsx
const Anniversary = lazy(() => import("./anniversary/Anniversary").then((m) => ({ default: m.Anniversary })));
```
Ternary branch after the `planner` branch:
```tsx
                          : s.id === "anniversary"
                            ? <Anniversary />
```
`SCREEN_TITLE`: add `anniversary: "Anniversaires",`.

- [ ] **Step 5: Add the App.test mock**

```tsx
vi.mock("./anniversary/Anniversary", () => ({ Anniversary: () => <div data-testid="anniversary" /> }));
```

- [ ] **Step 6: Run tests + typecheck**

Run: `pnpm --filter @retrorganizer/web test -- anniversary/Anniversary App && pnpm --filter @retrorganizer/web typecheck`
Expected: PASS; App still 8 tabs.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/anniversary/ apps/web/src/App.tsx apps/web/src/App.test.tsx
git commit -m "feat(web): Anniversary module (upcoming dates from contacts)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

> **PR boundary:** Module B complete. Run full suite + build, push branch, open PR.

---

# MODULE C — Web (bookmarks)

### Task C1: Bookmark domain + query

**Files:**
- Create: `packages/core/src/domain/bookmark.ts`, `packages/core/src/domain/bookmarkQuery.ts`
- Test: `packages/core/src/domain/bookmark.test.ts`, `packages/core/src/domain/bookmarkQuery.test.ts`
- Modify: `packages/core/src/index.ts`

**Interfaces:**
- Produces:
```ts
const bookmarkSchema: z.ZodType; type Bookmark; parseBookmark(input: unknown): Bookmark;
interface BookmarkDraft { title: string; url: string; description: string; categoryId: string | null; tags: string[] }
emptyBookmarkDraft(): BookmarkDraft; draftFromBookmark(b: Bookmark): BookmarkDraft;
filterBookmarks(bs: Bookmark[], q: string): Bookmark[];  // matches title/url/description, case-insensitive
sortBookmarks(bs: Bookmark[]): Bookmark[];               // by title, case-insensitive asc
```

- [ ] **Step 1: Write the failing tests**

```ts
// packages/core/src/domain/bookmark.test.ts
import { describe, it, expect } from "vitest";
import { parseBookmark, emptyBookmarkDraft, draftFromBookmark } from "./bookmark";

const base = { id: "b1", ownerId: "u1", createdAt: 1, updatedAt: 1, deletedAt: null };

describe("parseBookmark", () => {
  it("accepts a minimal bookmark and defaults fields", () => {
    const b = parseBookmark({ ...base, title: "Anthropic", url: "https://anthropic.com" });
    expect(b.description).toBe("");
    expect(b.categoryId).toBeNull();
    expect(b.tags).toEqual([]);
  });
  it("rejects a bookmark without a title or url", () => {
    expect(() => parseBookmark({ ...base, title: "", url: "x" })).toThrow();
    expect(() => parseBookmark({ ...base, title: "x", url: "" })).toThrow();
  });
});

describe("bookmark drafts", () => {
  it("emptyBookmarkDraft has neutral defaults", () => {
    expect(emptyBookmarkDraft()).toEqual({ title: "", url: "", description: "", categoryId: null, tags: [] });
  });
  it("draftFromBookmark deep-copies tags", () => {
    const b = parseBookmark({ ...base, title: "X", url: "u", tags: ["a"] });
    const d = draftFromBookmark(b);
    d.tags.push("b");
    expect(b.tags).toEqual(["a"]);
  });
});
```

```ts
// packages/core/src/domain/bookmarkQuery.test.ts
import { describe, it, expect } from "vitest";
import { filterBookmarks, sortBookmarks } from "./bookmarkQuery";
import { parseBookmark } from "./bookmark";

const mk = (id: string, title: string, url: string, description = "") =>
  parseBookmark({ id, ownerId: "u1", createdAt: 1, updatedAt: 1, deletedAt: null, title, url, description });

describe("bookmarkQuery", () => {
  const bs = [mk("1", "Zeta", "https://z.io", "search"), mk("2", "alpha", "https://a.io/docs")];
  it("filters by title, url, or description (case-insensitive)", () => {
    expect(filterBookmarks(bs, "ALPHA").map((b) => b.id)).toEqual(["2"]);
    expect(filterBookmarks(bs, "z.io").map((b) => b.id)).toEqual(["1"]);
    expect(filterBookmarks(bs, "search").map((b) => b.id)).toEqual(["1"]);
    expect(filterBookmarks(bs, "").map((b) => b.id)).toEqual(["1", "2"]);
  });
  it("sorts by title case-insensitively", () => {
    expect(sortBookmarks(bs).map((b) => b.title)).toEqual(["alpha", "Zeta"]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @retrorganizer/core test -- bookmark`
Expected: FAIL — modules not found.

- [ ] **Step 3: Write `bookmark.ts`**

```ts
// packages/core/src/domain/bookmark.ts
import { z } from "zod";

export const bookmarkSchema = z.object({
  id: z.string(),
  ownerId: z.string().min(1),
  createdAt: z.number(),
  updatedAt: z.number(),
  deletedAt: z.number().nullable(),
  title: z.string().min(1),
  url: z.string().min(1),
  description: z.string().default(""),
  categoryId: z.string().nullable().default(null),
  tags: z.array(z.string()).default([]),
});

export type Bookmark = z.infer<typeof bookmarkSchema>;

export function parseBookmark(input: unknown): Bookmark {
  return bookmarkSchema.parse(input);
}

export interface BookmarkDraft {
  title: string;
  url: string;
  description: string;
  categoryId: string | null;
  tags: string[];
}

export function emptyBookmarkDraft(): BookmarkDraft {
  return { title: "", url: "", description: "", categoryId: null, tags: [] };
}

export function draftFromBookmark(b: Bookmark): BookmarkDraft {
  return { title: b.title, url: b.url, description: b.description, categoryId: b.categoryId, tags: [...b.tags] };
}
```

- [ ] **Step 4: Write `bookmarkQuery.ts`**

```ts
// packages/core/src/domain/bookmarkQuery.ts
import type { Bookmark } from "./bookmark";

export function filterBookmarks(bs: Bookmark[], q: string): Bookmark[] {
  const needle = q.trim().toLowerCase();
  if (needle === "") return bs;
  return bs.filter((b) =>
    b.title.toLowerCase().includes(needle) ||
    b.url.toLowerCase().includes(needle) ||
    b.description.toLowerCase().includes(needle),
  );
}

export function sortBookmarks(bs: Bookmark[]): Bookmark[] {
  return [...bs].sort((a, b) => a.title.toLowerCase().localeCompare(b.title.toLowerCase()));
}
```

- [ ] **Step 5: Add barrel exports**

In `packages/core/src/index.ts`, after `export * from "./domain/note";` add:
```ts
export * from "./domain/bookmark";
export * from "./domain/bookmarkQuery";
```

- [ ] **Step 6: Run tests + typecheck**

Run: `pnpm --filter @retrorganizer/core test -- bookmark && pnpm --filter @retrorganizer/core typecheck`
Expected: PASS (bookmark 4 + bookmarkQuery 2).

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/domain/bookmark.ts packages/core/src/domain/bookmark.test.ts packages/core/src/domain/bookmarkQuery.ts packages/core/src/domain/bookmarkQuery.test.ts packages/core/src/index.ts
git commit -m "feat(core): bookmark domain + query for the Web module

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

### Task C2: Bookmarks repo + `useBookmarks` hook

**Files:**
- Create: `packages/core/src/repositories/bookmarks.ts`, `apps/web/src/bookmarks/useBookmarks.ts`
- Test: `apps/web/src/bookmarks/useBookmarks.test.tsx`
- Modify: `packages/core/src/index.ts`

**Interfaces:**
- Consumes: `createRepository`, `parseBookmark`, `type Bookmark`, `type BookmarkDraft` from core; `useAuth` from `../auth/AuthProvider`.
- Produces: `bookmarksRepo: Repository<Bookmark>`; `useBookmarks(): { bookmarks: Bookmark[]; loading: boolean; error: string | null; create(d: BookmarkDraft): Promise<void>; update(id: string, d: BookmarkDraft): Promise<void>; remove(id: string): Promise<void>; reload(): Promise<void> }`.

- [ ] **Step 1: Write the repo (one-liner)**

```ts
// packages/core/src/repositories/bookmarks.ts
import { createRepository } from "./base";
import { parseBookmark, type Bookmark } from "../domain/bookmark";

export const bookmarksRepo = createRepository<Bookmark>("bookmarks", parseBookmark);
```

In `packages/core/src/index.ts`, after `export * from "./repositories/notes";` add:
```ts
export * from "./repositories/bookmarks";
```

- [ ] **Step 2: Write the failing hook test**

```tsx
// apps/web/src/bookmarks/useBookmarks.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

const listByOwner = vi.fn();
const create = vi.fn();
const update = vi.fn();
const softDelete = vi.fn();
vi.mock("@retrorganizer/core", () => ({
  bookmarksRepo: {
    listByOwner: (...a: unknown[]) => listByOwner(...a),
    create: (...a: unknown[]) => create(...a),
    update: (...a: unknown[]) => update(...a),
    softDelete: (...a: unknown[]) => softDelete(...a),
  },
}));
vi.mock("../auth/AuthProvider", () => ({ useAuth: () => ({ user: { uid: "u1" } }) }));

import { useBookmarks } from "./useBookmarks";

beforeEach(() => {
  listByOwner.mockReset().mockResolvedValue([{ id: "b1", title: "X", url: "u" }]);
  create.mockReset().mockResolvedValue(undefined);
  update.mockReset().mockResolvedValue(undefined);
  softDelete.mockReset().mockResolvedValue(undefined);
});

describe("useBookmarks", () => {
  it("loads bookmarks for the current user", async () => {
    const { result } = renderHook(() => useBookmarks());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(listByOwner).toHaveBeenCalledWith("u1");
    expect(result.current.bookmarks).toHaveLength(1);
  });

  it("creates then reloads", async () => {
    const { result } = renderHook(() => useBookmarks());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.create({ title: "Y", url: "v", description: "", categoryId: null, tags: [] }); });
    expect(create).toHaveBeenCalledWith("u1", { title: "Y", url: "v", description: "", categoryId: null, tags: [] });
    expect(listByOwner).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter @retrorganizer/web test -- useBookmarks`
Expected: FAIL — cannot find `./useBookmarks`.

- [ ] **Step 4: Write the hook**

```ts
// apps/web/src/bookmarks/useBookmarks.ts
import { useCallback, useEffect, useState } from "react";
import { bookmarksRepo, type Bookmark, type BookmarkDraft } from "@retrorganizer/core";
import { useAuth } from "../auth/AuthProvider";

export interface UseBookmarks {
  bookmarks: Bookmark[];
  loading: boolean;
  error: string | null;
  create(d: BookmarkDraft): Promise<void>;
  update(id: string, d: BookmarkDraft): Promise<void>;
  remove(id: string): Promise<void>;
  reload(): Promise<void>;
}

export function useBookmarks(): UseBookmarks {
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!uid) { setBookmarks([]); setError(null); setLoading(false); return; }
    setLoading(true); setError(null);
    try { setBookmarks(await bookmarksRepo.listByOwner(uid)); }
    catch (e) { setError(e instanceof Error ? e.message : "Échec du chargement"); }
    finally { setLoading(false); }
  }, [uid]);

  useEffect(() => { void reload(); }, [reload]);

  const create = useCallback(async (d: BookmarkDraft) => {
    if (!uid) return;
    try { await bookmarksRepo.create(uid, d); }
    catch (e) { setError(e instanceof Error ? e.message : "Échec de l'enregistrement"); return; }
    await reload();
  }, [uid, reload]);

  const update = useCallback(async (id: string, d: BookmarkDraft) => {
    try { await bookmarksRepo.update(id, d); }
    catch (e) { setError(e instanceof Error ? e.message : "Échec de l'enregistrement"); return; }
    await reload();
  }, [reload]);

  const remove = useCallback(async (id: string) => {
    try { await bookmarksRepo.softDelete(id); }
    catch (e) { setError(e instanceof Error ? e.message : "Échec de la suppression"); return; }
    await reload();
  }, [reload]);

  return { bookmarks, loading, error, create, update, remove, reload };
}
```

- [ ] **Step 5: Run tests + typecheck**

Run: `pnpm --filter @retrorganizer/web test -- useBookmarks && pnpm typecheck`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/repositories/bookmarks.ts packages/core/src/index.ts apps/web/src/bookmarks/useBookmarks.ts apps/web/src/bookmarks/useBookmarks.test.tsx
git commit -m "feat(web): bookmarks repository + useBookmarks hook

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

### Task C3: BookmarkForm + WebLinks screen + routing

**Files:**
- Create: `apps/web/src/bookmarks/BookmarkForm.tsx`, `apps/web/src/bookmarks/WebLinks.tsx`
- Test: `apps/web/src/bookmarks/WebLinks.test.tsx`
- Modify: `apps/web/src/App.tsx`, `apps/web/src/App.test.tsx`

**Interfaces:**
- Consumes: `useBookmarks`, `emptyBookmarkDraft`, `draftFromBookmark`, `filterBookmarks`, `sortBookmarks`, `type BookmarkDraft` from core; `CategorySelect` from `../categories/CategorySelect`; `TagInput` from `../categories/TagInput`; `tokens` from `@retrorganizer/ui`.
- Produces: `BookmarkForm({ initial?, onSubmit, onCancel })`; `WebLinks()`.

- [ ] **Step 1: Write the failing screen test**

```tsx
// apps/web/src/bookmarks/WebLinks.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const create = vi.fn();
vi.mock("./useBookmarks", () => ({
  useBookmarks: () => ({
    bookmarks: [
      { id: "b1", ownerId: "u1", createdAt: 1, updatedAt: 1, deletedAt: null, title: "Anthropic", url: "https://anthropic.com", description: "AI", categoryId: null, tags: [] },
    ],
    create, update: vi.fn(), remove: vi.fn(),
  }),
}));
// CategorySelect/TagInput pull from contexts; stub them to keep the screen test isolated.
vi.mock("../categories/CategorySelect", () => ({ CategorySelect: () => <div /> }));
vi.mock("../categories/TagInput", () => ({ TagInput: () => <div /> }));

import { WebLinks } from "./WebLinks";

describe("WebLinks", () => {
  it("renders a bookmark with a link to its url", () => {
    render(<WebLinks />);
    const link = screen.getByRole("link", { name: /Anthropic/ });
    expect(link).toHaveAttribute("href", "https://anthropic.com");
  });

  it("opens the form when the new button is clicked", () => {
    render(<WebLinks />);
    fireEvent.click(screen.getByRole("button", { name: /Nouveau lien/ }));
    expect(screen.getByLabelText("Titre")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @retrorganizer/web test -- bookmarks/WebLinks`
Expected: FAIL — cannot find `./WebLinks`.

- [ ] **Step 3: Write `BookmarkForm.tsx`**

```tsx
// apps/web/src/bookmarks/BookmarkForm.tsx
import { useState } from "react";
import { tokens } from "@retrorganizer/ui";
import { emptyBookmarkDraft, type BookmarkDraft } from "@retrorganizer/core";
import { CategorySelect } from "../categories/CategorySelect";
import { TagInput } from "../categories/TagInput";

export interface BookmarkFormProps {
  initial?: BookmarkDraft;
  onSubmit(draft: BookmarkDraft): void;
  onCancel(): void;
}

export function BookmarkForm({ initial, onSubmit, onCancel }: BookmarkFormProps) {
  const [draft, setDraft] = useState<BookmarkDraft>(initial ?? emptyBookmarkDraft());
  function set<K extends keyof BookmarkDraft>(key: K, value: BookmarkDraft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }
  function submit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit(draft);
  }
  return (
    <form onSubmit={submit} style={{ padding: tokens.space.md, font: `13px ${tokens.font.body}`, display: "grid", gap: tokens.space.sm }}>
      <label>Titre
        <input aria-label="Titre" value={draft.title} onChange={(e) => set("title", e.target.value)} style={{ display: "block", width: "100%" }} />
      </label>
      <label>URL
        <input aria-label="URL" value={draft.url} onChange={(e) => set("url", e.target.value)} style={{ display: "block", width: "100%" }} />
      </label>
      <label>Description
        <textarea aria-label="Description" value={draft.description} onChange={(e) => set("description", e.target.value)} style={{ display: "block", width: "100%" }} />
      </label>
      <label>Catégorie
        <CategorySelect value={draft.categoryId} onChange={(id) => set("categoryId", id)} />
      </label>
      <label>Tags
        <TagInput value={draft.tags} onChange={(tags) => set("tags", tags)} />
      </label>
      <div style={{ display: "flex", gap: tokens.space.sm }}>
        <button type="submit">Enregistrer</button>
        <button type="button" onClick={onCancel}>Annuler</button>
      </div>
    </form>
  );
}
```

- [ ] **Step 4: Write `WebLinks.tsx`**

```tsx
// apps/web/src/bookmarks/WebLinks.tsx
import { useMemo, useState } from "react";
import { filterBookmarks, sortBookmarks, draftFromBookmark, type BookmarkDraft } from "@retrorganizer/core";
import { useBookmarks } from "./useBookmarks";
import { BookmarkForm } from "./BookmarkForm";

export function WebLinks() {
  const { bookmarks, create, update, remove } = useBookmarks();
  const [editing, setEditing] = useState<{ draft: BookmarkDraft | undefined; id: string | null } | null>(null);
  const [query, setQuery] = useState("");

  const visible = useMemo(() => sortBookmarks(filterBookmarks(bookmarks, query)), [bookmarks, query]);

  async function onSubmit(draft: BookmarkDraft) {
    if (editing?.id) await update(editing.id, draft);
    else await create(draft);
    setEditing(null);
  }

  if (editing) {
    return (
      <div className="legacy-content">
        <BookmarkForm initial={editing.draft} onSubmit={onSubmit} onCancel={() => setEditing(null)} />
        {editing.id && (
          <button type="button" style={{ margin: 12 }} onClick={async () => { await remove(editing.id!); setEditing(null); }}>
            Supprimer
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-full font-body-md text-on-surface">
      <div className="flex items-center justify-between border-b-2 border-primary pb-2 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="material-symbols-outlined text-primary" aria-hidden>language</span>
          <h1 className="font-headline-lg text-headline-lg text-on-surface truncate">Liens web</h1>
        </div>
        <span className="font-mono-data text-mono-data text-outline shrink-0">SEC: WEB_01</span>
      </div>

      <div className="flex items-center gap-2 mb-3">
        <div className="relative flex-1 min-w-0">
          <span className="material-symbols-outlined text-outline text-base absolute left-1 top-1/2 -translate-y-1/2" aria-hidden>search</span>
          <input aria-label="Rechercher un lien" value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher…" className="w-full pl-7 pr-2 py-1 bg-transparent border-b border-outline italic focus:outline-none" />
        </div>
        <button type="button" aria-label="Nouveau lien" onClick={() => setEditing({ draft: undefined, id: null })}
          className="flex items-center gap-1 px-2 py-1 border border-outline bg-primary text-on-primary retro-outset active:retro-inset font-label-sm text-label-sm">
          <span className="material-symbols-outlined text-[18px]" aria-hidden>add_link</span>
        </button>
      </div>

      {visible.length === 0 ? (
        <p className="py-6 text-center text-on-surface-variant italic">Aucun lien</p>
      ) : (
        <div className="space-y-3">
          {visible.map((b) => (
            <div key={b.id} className="border border-outline-variant p-3 bg-white/50">
              <div className="flex items-start justify-between gap-2">
                <a href={b.url} target="_blank" rel="noreferrer" className="font-headline-md text-headline-md text-primary truncate">{b.title}</a>
                <button type="button" aria-label={`Modifier ${b.title}`} onClick={() => setEditing({ draft: draftFromBookmark(b), id: b.id })}
                  className="material-symbols-outlined text-outline hover:text-primary text-[18px] shrink-0">edit</button>
              </div>
              <div className="font-mono-data text-mono-data text-on-surface-variant truncate">{b.url}</div>
              {b.description && <p className="text-body-md text-on-surface-variant mt-1">{b.description}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Wire routing in `App.tsx`**

Lazy import after `Anniversary`:
```tsx
const WebLinks = lazy(() => import("./bookmarks/WebLinks").then((m) => ({ default: m.WebLinks })));
```
Ternary branch after the `anniversary` branch:
```tsx
                          : s.id === "web"
                            ? <WebLinks />
```
`SCREEN_TITLE`: add `web: "Liens web",`.

- [ ] **Step 6: Add the App.test mock**

```tsx
vi.mock("./bookmarks/WebLinks", () => ({ WebLinks: () => <div data-testid="web" /> }));
```

- [ ] **Step 7: Run tests + typecheck**

Run: `pnpm --filter @retrorganizer/web test -- bookmarks App && pnpm typecheck`
Expected: PASS; App still 8 tabs.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/bookmarks/ apps/web/src/App.tsx apps/web/src/App.test.tsx
git commit -m "feat(web): Web (bookmarks) module — list, search, CRUD form

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

> **PR boundary:** Module C complete. Run full suite + build, push branch, open PR.

---

# MODULE D — Calls (call log)

### Task D1: Call domain + query

**Files:**
- Create: `packages/core/src/domain/call.ts`, `packages/core/src/domain/callQuery.ts`
- Test: `packages/core/src/domain/call.test.ts`, `packages/core/src/domain/callQuery.test.ts`
- Modify: `packages/core/src/index.ts`

**Interfaces:**
- Produces:
```ts
type CallDirection = "incoming" | "outgoing" | "missed";
const callSchema; type Call; parseCall(input): Call;
interface CallDraft { contactId: string | null; contactName: string; phoneNumber: string; direction: CallDirection; occurredAt: number; durationMin: number; notes: string; categoryId: string | null; tags: string[] }
emptyCallDraft(): CallDraft; draftFromCall(c: Call): CallDraft;
filterCalls(cs: Call[], q: string): Call[];   // matches contactName/phoneNumber/notes
sortCalls(cs: Call[]): Call[];                 // by occurredAt DESC (most recent first)
```

- [ ] **Step 1: Write the failing tests**

```ts
// packages/core/src/domain/call.test.ts
import { describe, it, expect } from "vitest";
import { parseCall, emptyCallDraft, draftFromCall } from "./call";

const base = { id: "c1", ownerId: "u1", createdAt: 1, updatedAt: 1, deletedAt: null };

describe("parseCall", () => {
  it("accepts a minimal call and defaults fields", () => {
    const c = parseCall({ ...base, occurredAt: 1000 });
    expect(c.direction).toBe("outgoing");
    expect(c.durationMin).toBe(0);
    expect(c.contactId).toBeNull();
    expect(c.contactName).toBe("");
    expect(c.notes).toBe("");
  });
  it("rejects an invalid direction", () => {
    expect(() => parseCall({ ...base, occurredAt: 1, direction: "sideways" })).toThrow();
  });
});

describe("call drafts", () => {
  it("emptyCallDraft has neutral defaults", () => {
    expect(emptyCallDraft()).toEqual({
      contactId: null, contactName: "", phoneNumber: "", direction: "outgoing",
      occurredAt: 0, durationMin: 0, notes: "", categoryId: null, tags: [],
    });
  });
  it("draftFromCall deep-copies tags", () => {
    const c = parseCall({ ...base, occurredAt: 1, tags: ["a"] });
    const d = draftFromCall(c);
    d.tags.push("b");
    expect(c.tags).toEqual(["a"]);
  });
});
```

```ts
// packages/core/src/domain/callQuery.test.ts
import { describe, it, expect } from "vitest";
import { filterCalls, sortCalls } from "./callQuery";
import { parseCall } from "./call";

const mk = (id: string, name: string, occurredAt: number, phone = "", notes = "") =>
  parseCall({ id, ownerId: "u1", createdAt: 1, updatedAt: 1, deletedAt: null, contactName: name, phoneNumber: phone, occurredAt, notes });

describe("callQuery", () => {
  const cs = [mk("1", "Ada", 1000, "+33 1", "rappeler"), mk("2", "Grace", 3000, "+1 555")];
  it("filters by name, phone, or notes", () => {
    expect(filterCalls(cs, "ada").map((c) => c.id)).toEqual(["1"]);
    expect(filterCalls(cs, "555").map((c) => c.id)).toEqual(["2"]);
    expect(filterCalls(cs, "rappeler").map((c) => c.id)).toEqual(["1"]);
  });
  it("sorts most-recent first", () => {
    expect(sortCalls(cs).map((c) => c.id)).toEqual(["2", "1"]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @retrorganizer/core test -- call`
Expected: FAIL — modules not found.

- [ ] **Step 3: Write `call.ts`**

```ts
// packages/core/src/domain/call.ts
import { z } from "zod";

export type CallDirection = "incoming" | "outgoing" | "missed";

export const callSchema = z.object({
  id: z.string(),
  ownerId: z.string().min(1),
  createdAt: z.number(),
  updatedAt: z.number(),
  deletedAt: z.number().nullable(),
  contactId: z.string().nullable().default(null),
  contactName: z.string().default(""),
  phoneNumber: z.string().default(""),
  direction: z.enum(["incoming", "outgoing", "missed"]).default("outgoing"),
  occurredAt: z.number(),
  durationMin: z.number().default(0),
  notes: z.string().default(""),
  categoryId: z.string().nullable().default(null),
  tags: z.array(z.string()).default([]),
});

export type Call = z.infer<typeof callSchema>;

export function parseCall(input: unknown): Call {
  return callSchema.parse(input);
}

export interface CallDraft {
  contactId: string | null;
  contactName: string;
  phoneNumber: string;
  direction: CallDirection;
  occurredAt: number;
  durationMin: number;
  notes: string;
  categoryId: string | null;
  tags: string[];
}

export function emptyCallDraft(): CallDraft {
  return {
    contactId: null, contactName: "", phoneNumber: "", direction: "outgoing",
    occurredAt: 0, durationMin: 0, notes: "", categoryId: null, tags: [],
  };
}

export function draftFromCall(c: Call): CallDraft {
  return {
    contactId: c.contactId, contactName: c.contactName, phoneNumber: c.phoneNumber,
    direction: c.direction, occurredAt: c.occurredAt, durationMin: c.durationMin,
    notes: c.notes, categoryId: c.categoryId, tags: [...c.tags],
  };
}
```

- [ ] **Step 4: Write `callQuery.ts`**

```ts
// packages/core/src/domain/callQuery.ts
import type { Call } from "./call";

export function filterCalls(cs: Call[], q: string): Call[] {
  const needle = q.trim().toLowerCase();
  if (needle === "") return cs;
  return cs.filter((c) =>
    c.contactName.toLowerCase().includes(needle) ||
    c.phoneNumber.toLowerCase().includes(needle) ||
    c.notes.toLowerCase().includes(needle),
  );
}

export function sortCalls(cs: Call[]): Call[] {
  return [...cs].sort((a, b) => b.occurredAt - a.occurredAt);
}
```

- [ ] **Step 5: Add barrel exports**

In `packages/core/src/index.ts`, after the bookmark exports add:
```ts
export * from "./domain/call";
export * from "./domain/callQuery";
```

- [ ] **Step 6: Run tests + typecheck**

Run: `pnpm --filter @retrorganizer/core test -- call && pnpm --filter @retrorganizer/core typecheck`
Expected: PASS (call 4 + callQuery 2).

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/domain/call.ts packages/core/src/domain/call.test.ts packages/core/src/domain/callQuery.ts packages/core/src/domain/callQuery.test.ts packages/core/src/index.ts
git commit -m "feat(core): call domain + query for the Calls module

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

### Task D2: Calls repo + `useCalls` hook

**Files:**
- Create: `packages/core/src/repositories/calls.ts`, `apps/web/src/calls/useCalls.ts`
- Test: `apps/web/src/calls/useCalls.test.tsx`
- Modify: `packages/core/src/index.ts`

**Interfaces:**
- Produces: `callsRepo: Repository<Call>`; `useCalls(): { calls: Call[]; loading; error; create(d: CallDraft); update(id, d: CallDraft); remove(id); reload }`.

- [ ] **Step 1: Write the repo + barrel export**

```ts
// packages/core/src/repositories/calls.ts
import { createRepository } from "./base";
import { parseCall, type Call } from "../domain/call";

export const callsRepo = createRepository<Call>("calls", parseCall);
```
In `packages/core/src/index.ts`, after `export * from "./repositories/bookmarks";` add:
```ts
export * from "./repositories/calls";
```

- [ ] **Step 2: Write the failing hook test**

```tsx
// apps/web/src/calls/useCalls.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

const listByOwner = vi.fn();
const create = vi.fn();
const update = vi.fn();
const softDelete = vi.fn();
vi.mock("@retrorganizer/core", () => ({
  callsRepo: {
    listByOwner: (...a: unknown[]) => listByOwner(...a),
    create: (...a: unknown[]) => create(...a),
    update: (...a: unknown[]) => update(...a),
    softDelete: (...a: unknown[]) => softDelete(...a),
  },
}));
vi.mock("../auth/AuthProvider", () => ({ useAuth: () => ({ user: { uid: "u1" } }) }));

import { useCalls } from "./useCalls";

beforeEach(() => {
  listByOwner.mockReset().mockResolvedValue([{ id: "c1", contactName: "Ada", occurredAt: 1 }]);
  create.mockReset().mockResolvedValue(undefined);
  update.mockReset().mockResolvedValue(undefined);
  softDelete.mockReset().mockResolvedValue(undefined);
});

describe("useCalls", () => {
  it("loads calls for the current user", async () => {
    const { result } = renderHook(() => useCalls());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(listByOwner).toHaveBeenCalledWith("u1");
    expect(result.current.calls).toHaveLength(1);
  });

  it("removes then reloads", async () => {
    const { result } = renderHook(() => useCalls());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.remove("c1"); });
    expect(softDelete).toHaveBeenCalledWith("c1");
    expect(listByOwner).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter @retrorganizer/web test -- useCalls`
Expected: FAIL — cannot find `./useCalls`.

- [ ] **Step 4: Write the hook**

```ts
// apps/web/src/calls/useCalls.ts
import { useCallback, useEffect, useState } from "react";
import { callsRepo, type Call, type CallDraft } from "@retrorganizer/core";
import { useAuth } from "../auth/AuthProvider";

export interface UseCalls {
  calls: Call[];
  loading: boolean;
  error: string | null;
  create(d: CallDraft): Promise<void>;
  update(id: string, d: CallDraft): Promise<void>;
  remove(id: string): Promise<void>;
  reload(): Promise<void>;
}

export function useCalls(): UseCalls {
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  const [calls, setCalls] = useState<Call[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!uid) { setCalls([]); setError(null); setLoading(false); return; }
    setLoading(true); setError(null);
    try { setCalls(await callsRepo.listByOwner(uid)); }
    catch (e) { setError(e instanceof Error ? e.message : "Échec du chargement"); }
    finally { setLoading(false); }
  }, [uid]);

  useEffect(() => { void reload(); }, [reload]);

  const create = useCallback(async (d: CallDraft) => {
    if (!uid) return;
    try { await callsRepo.create(uid, d); }
    catch (e) { setError(e instanceof Error ? e.message : "Échec de l'enregistrement"); return; }
    await reload();
  }, [uid, reload]);

  const update = useCallback(async (id: string, d: CallDraft) => {
    try { await callsRepo.update(id, d); }
    catch (e) { setError(e instanceof Error ? e.message : "Échec de l'enregistrement"); return; }
    await reload();
  }, [reload]);

  const remove = useCallback(async (id: string) => {
    try { await callsRepo.softDelete(id); }
    catch (e) { setError(e instanceof Error ? e.message : "Échec de la suppression"); return; }
    await reload();
  }, [reload]);

  return { calls, loading, error, create, update, remove, reload };
}
```

- [ ] **Step 5: Run tests + typecheck**

Run: `pnpm --filter @retrorganizer/web test -- useCalls && pnpm typecheck`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/repositories/calls.ts packages/core/src/index.ts apps/web/src/calls/useCalls.ts apps/web/src/calls/useCalls.test.tsx
git commit -m "feat(web): calls repository + useCalls hook

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

### Task D3: CallForm + CallLog screen + routing

**Files:**
- Create: `apps/web/src/calls/CallForm.tsx`, `apps/web/src/calls/CallLog.tsx`
- Test: `apps/web/src/calls/CallLog.test.tsx`
- Modify: `apps/web/src/App.tsx`, `apps/web/src/App.test.tsx`

**Interfaces:**
- Consumes: `useCalls`, `emptyCallDraft`, `draftFromCall`, `filterCalls`, `sortCalls`, `startOfDay`, `type CallDraft`, `type CallDirection` from core; `useContacts` from `../contacts/useContacts`; `toDateInput`, `fromDateInput` from `../calendar/datetime`; `CategorySelect`, `TagInput`; `tokens`.
- Produces: `CallForm({ initial?, onSubmit, onCancel })`; `CallLog()`.

- [ ] **Step 1: Write the failing screen test**

```tsx
// apps/web/src/calls/CallLog.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("./useCalls", () => ({
  useCalls: () => ({
    calls: [
      { id: "c1", ownerId: "u1", createdAt: 1, updatedAt: 1, deletedAt: null, contactId: null,
        contactName: "Ada", phoneNumber: "+33 1", direction: "incoming", occurredAt: new Date(2026, 0, 2).getTime(),
        durationMin: 5, notes: "ok", categoryId: null, tags: [] },
    ],
    create: vi.fn(), update: vi.fn(), remove: vi.fn(),
  }),
}));
vi.mock("../contacts/useContacts", () => ({ useContacts: () => ({ contacts: [] }) }));
vi.mock("../categories/CategorySelect", () => ({ CategorySelect: () => <div /> }));
vi.mock("../categories/TagInput", () => ({ TagInput: () => <div /> }));

import { CallLog } from "./CallLog";

describe("CallLog", () => {
  it("renders a call entry with its contact name", () => {
    render(<CallLog />);
    expect(screen.getByText("Ada")).toBeInTheDocument();
  });
  it("opens the form on the new button", () => {
    render(<CallLog />);
    fireEvent.click(screen.getByRole("button", { name: /Nouvel appel/ }));
    expect(screen.getByLabelText("Nom / contact")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @retrorganizer/web test -- calls/CallLog`
Expected: FAIL — cannot find `./CallLog`.

- [ ] **Step 3: Write `CallForm.tsx`**

```tsx
// apps/web/src/calls/CallForm.tsx
import { useState } from "react";
import { tokens } from "@retrorganizer/ui";
import { emptyCallDraft, startOfDay, type CallDraft } from "@retrorganizer/core";
import { useContacts } from "../contacts/useContacts";
import { toDateInput, fromDateInput } from "../calendar/datetime";
import { CategorySelect } from "../categories/CategorySelect";
import { TagInput } from "../categories/TagInput";

const DIRECTIONS: { label: string; value: CallDraft["direction"] }[] = [
  { label: "Entrant", value: "incoming" },
  { label: "Sortant", value: "outgoing" },
  { label: "Manqué", value: "missed" },
];

export interface CallFormProps {
  initial?: CallDraft;
  onSubmit(draft: CallDraft): void;
  onCancel(): void;
}

export function CallForm({ initial, onSubmit, onCancel }: CallFormProps) {
  const [draft, setDraft] = useState<CallDraft>(initial ?? { ...emptyCallDraft(), occurredAt: startOfDay(Date.now()) });
  const { contacts } = useContacts();
  function set<K extends keyof CallDraft>(key: K, value: CallDraft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }
  function submit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit(draft);
  }
  return (
    <form onSubmit={submit} style={{ padding: tokens.space.md, font: `13px ${tokens.font.body}`, display: "grid", gap: tokens.space.sm }}>
      <label>Nom / contact
        <input aria-label="Nom / contact" value={draft.contactName} onChange={(e) => set("contactName", e.target.value)} style={{ display: "block", width: "100%" }} />
      </label>
      {contacts.length > 0 && (
        <label>Lier à un contact
          <select aria-label="Lier à un contact" value={draft.contactId ?? ""}
            onChange={(e) => {
              const id = e.target.value === "" ? null : e.target.value;
              const c = contacts.find((x) => x.id === id);
              setDraft((d) => ({ ...d, contactId: id, contactName: c ? c.displayName : d.contactName }));
            }} style={{ display: "block" }}>
            <option value="">Aucun</option>
            {contacts.map((c) => <option key={c.id} value={c.id}>{c.displayName}</option>)}
          </select>
        </label>
      )}
      <label>Numéro
        <input aria-label="Numéro" value={draft.phoneNumber} onChange={(e) => set("phoneNumber", e.target.value)} style={{ display: "block", width: "100%" }} />
      </label>
      <label>Sens
        <select aria-label="Sens" value={draft.direction} onChange={(e) => set("direction", e.target.value as CallDraft["direction"])} style={{ display: "block" }}>
          {DIRECTIONS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
        </select>
      </label>
      <label>Date
        <input aria-label="Date" type="date" value={draft.occurredAt ? toDateInput(draft.occurredAt) : ""}
          onChange={(e) => set("occurredAt", e.target.value ? fromDateInput(e.target.value) : 0)} style={{ display: "block" }} />
      </label>
      <label>Durée (min)
        <input aria-label="Durée (min)" type="number" min={0} value={draft.durationMin}
          onChange={(e) => set("durationMin", Number(e.target.value) || 0)} style={{ display: "block" }} />
      </label>
      <label>Notes
        <textarea aria-label="Notes" value={draft.notes} onChange={(e) => set("notes", e.target.value)} style={{ display: "block", width: "100%" }} />
      </label>
      <label>Catégorie
        <CategorySelect value={draft.categoryId} onChange={(id) => set("categoryId", id)} />
      </label>
      <label>Tags
        <TagInput value={draft.tags} onChange={(tags) => set("tags", tags)} />
      </label>
      <div style={{ display: "flex", gap: tokens.space.sm }}>
        <button type="submit">Enregistrer</button>
        <button type="button" onClick={onCancel}>Annuler</button>
      </div>
    </form>
  );
}
```

- [ ] **Step 4: Write `CallLog.tsx`**

```tsx
// apps/web/src/calls/CallLog.tsx
import { useMemo, useState } from "react";
import { filterCalls, sortCalls, draftFromCall, type Call, type CallDraft } from "@retrorganizer/core";
import { useCalls } from "./useCalls";
import { CallForm } from "./CallForm";

const DIR_ICON: Record<Call["direction"], string> = {
  incoming: "call_received",
  outgoing: "call_made",
  missed: "call_missed",
};
const MONTHS = ["JAN", "FÉV", "MAR", "AVR", "MAI", "JUI", "JUL", "AOÛ", "SEP", "OCT", "NOV", "DÉC"];
function dateLabel(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getDate()).padStart(2, "0")}-${MONTHS[d.getMonth()]}-${d.getFullYear()}`;
}

export function CallLog() {
  const { calls, create, update, remove } = useCalls();
  const [editing, setEditing] = useState<{ draft: CallDraft | undefined; id: string | null } | null>(null);
  const [query, setQuery] = useState("");

  const visible = useMemo(() => sortCalls(filterCalls(calls, query)), [calls, query]);

  async function onSubmit(draft: CallDraft) {
    if (editing?.id) await update(editing.id, draft);
    else await create(draft);
    setEditing(null);
  }

  if (editing) {
    return (
      <div className="legacy-content">
        <CallForm initial={editing.draft} onSubmit={onSubmit} onCancel={() => setEditing(null)} />
        {editing.id && (
          <button type="button" style={{ margin: 12 }} onClick={async () => { await remove(editing.id!); setEditing(null); }}>
            Supprimer
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-full font-body-md text-on-surface">
      <div className="flex items-center justify-between border-b-2 border-primary pb-2 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="material-symbols-outlined text-primary" aria-hidden>call</span>
          <h1 className="font-headline-lg text-headline-lg text-on-surface truncate">Journal d'appels</h1>
        </div>
        <span className="font-mono-data text-mono-data text-outline shrink-0">SEC: CALLS_01</span>
      </div>

      <div className="flex items-center gap-2 mb-3">
        <div className="relative flex-1 min-w-0">
          <span className="material-symbols-outlined text-outline text-base absolute left-1 top-1/2 -translate-y-1/2" aria-hidden>search</span>
          <input aria-label="Rechercher un appel" value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher…" className="w-full pl-7 pr-2 py-1 bg-transparent border-b border-outline italic focus:outline-none" />
        </div>
        <button type="button" aria-label="Nouvel appel" onClick={() => setEditing({ draft: undefined, id: null })}
          className="flex items-center gap-1 px-2 py-1 border border-outline bg-primary text-on-primary retro-outset active:retro-inset font-label-sm text-label-sm">
          <span className="material-symbols-outlined text-[18px]" aria-hidden>add_call</span>
        </button>
      </div>

      {visible.length === 0 ? (
        <p className="py-6 text-center text-on-surface-variant italic">Aucun appel</p>
      ) : (
        <div className="flex flex-col">
          {visible.map((c) => (
            <button key={c.id} type="button" onClick={() => setEditing({ draft: draftFromCall(c), id: c.id })}
              className="flex items-center gap-3 py-2 border-b border-outline-variant text-left hover:bg-primary/5">
              <span className={`material-symbols-outlined shrink-0 ${c.direction === "missed" ? "text-error" : "text-primary"}`} aria-hidden>{DIR_ICON[c.direction]}</span>
              <div className="flex-1 min-w-0">
                <div className="text-body-md truncate">{c.contactName || c.phoneNumber || "Inconnu"}</div>
                <div className="font-mono-data text-mono-data text-on-surface-variant truncate">
                  {dateLabel(c.occurredAt)}{c.durationMin > 0 ? ` · ${c.durationMin} min` : ""}{c.notes ? ` · ${c.notes}` : ""}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Wire routing in `App.tsx`**

Lazy import after `WebLinks`:
```tsx
const CallLog = lazy(() => import("./calls/CallLog").then((m) => ({ default: m.CallLog })));
```
Ternary branch after the `web` branch:
```tsx
                          : s.id === "calls"
                            ? <CallLog />
```
`SCREEN_TITLE`: add `calls: "Journal d'appels",`.

- [ ] **Step 6: Add the App.test mock**

```tsx
vi.mock("./calls/CallLog", () => ({ CallLog: () => <div data-testid="calls" /> }));
```

- [ ] **Step 7: Run tests + typecheck**

Run: `pnpm --filter @retrorganizer/web test -- calls App && pnpm typecheck`
Expected: PASS; App still 8 tabs.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/calls/ apps/web/src/App.tsx apps/web/src/App.test.tsx
git commit -m "feat(web): Calls (call log) module — list, search, CRUD form

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

> **PR boundary:** Module D complete. Run full suite + build, push branch, open PR.

---

## Final verification (after all 4 modules)

- [ ] `pnpm typecheck` — 4/4 packages clean.
- [ ] `export PATH="/opt/homebrew/opt/openjdk/bin:$PATH" && pnpm exec firebase emulators:exec --only auth,firestore "pnpm test"` — all green.
- [ ] `pnpm --filter @retrorganizer/web build` — clean.
- [ ] Manual: each of the 4 tabs renders its real screen (no `ComingSoon`); create/edit/delete works for Web + Calls; Planner year-nav + Anniversary list render real data.

## Notes / decisions baked in

- **No `firestore.rules` change** — `bookmarks` and `calls` are covered by the generic `/{collection}/{docId}` owner rule.
- **No per-collection emulator repo test** — the generic `createRepository` factory is already emulator-tested via `contacts.test.ts`/`tasks`; new repos are one-line factory instantiations covered by domain parse tests + hook tests (which mock the repo).
- **Planner month tap → `/diary`** (no day deep-link param) to avoid modifying the MVP Diary module. A future enhancement could add a `?day=` param to Diary.
- **Anniversary & Web reuse existing data** per the approved design: Anniversary derives from `contact.importantDates`; the `bookmarks` collection is independent of per-contact `webLinks`.
- **Trash/restore** for bookmarks & calls is inherited free (soft-delete via `createRepository`), but surfacing them in the existing `TrashPanel` is out of scope for this plan unless requested.
