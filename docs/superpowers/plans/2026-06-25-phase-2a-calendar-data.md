# Retrorganizer — Phase 2a : Calendrier (couche données) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Poser la couche données du module Calendrier : modèle `Event` (zod, règle fin ≥ début), `eventsRepo`, expansion de récurrence RRULE avec exceptions, import/export ICS, et le hook `useEvents`. Aucune UI — livrable vérifiable par tests (CRUD événements, occurrences récurrentes, round-trip ICS).

**Architecture:** La logique pure vit dans `packages/core` (réutilisable React Native) : modèle/draft d'`Event`, expansion d'occurrences via la bibliothèque `rrule`, sérialisation ICS (VEVENT) réutilisant les primitives d'échappement/unfolding de la Phase 1. `apps/web` consomme `eventsRepo` via `useEvents`. La Phase 2b (vues calendrier) se branchera dessus.

**Tech Stack:** TypeScript strict, zod, **rrule** (NOUVELLE dépendance — expansion RRULE), Firestore via `createRepository`, Vitest, @testing-library/react.

## Global Constraints

- Produit : **Retrorganizer**. TypeScript **strict** (noUncheckedIndexedAccess ON) — dans les TESTS, remplacer `const [x] = arr` par `const x = arr[0]!` (sémantiquement identique) ; ne jamais affaiblir le code de production pour contourner strict.
- Aucune app ne parle directement à Firestore — uniquement via `@retrorganizer/core` (`eventsRepo`, `getFirebase`).
- Soft-delete uniquement (`deletedAt`) ; `listByOwner` exclut déjà les supprimés.
- **Règle métier** : un événement ne peut pas finir avant de commencer (`end >= start`), validée dans `parseEvent`.
- **Dates** : stockées en **millisecondes epoch UTC** (`number`). `allDay` est un booléen. La récurrence est une **chaîne RRULE** (RFC 5545, ex. `"FREQ=WEEKLY;BYDAY=MO"`) ou `null`. Les exceptions sont un tableau de millis de début d'occurrence à exclure.
- Réutiliser les helpers existants `@retrorganizer/core` : `createRepository`, `escapeValue`/`unescapeValue`/`unfoldLines`/`splitEscaped` (io), `BaseEntity`.
- Tests sur récurrences et import/export obligatoires (spec §12.4) : round-trips et expansion couverts.
- Commits fréquents, un par tâche minimum.

## Interfaces héritées (à consommer, ne pas redéfinir)

Depuis `@retrorganizer/core` :
- `BaseEntity` = `{ id, ownerId, createdAt, updatedAt, deletedAt: number|null }`
- `createRepository<T extends BaseEntity>(collectionName: string, parse: (input: unknown) => T): Repository<T>` avec `create(ownerId, data)`, `get(id)`, `update(id, patch)`, `softDelete(id)`, `listByOwner(ownerId)`
- `escapeValue(v)`, `unescapeValue(v)`, `unfoldLines(text)`, `splitEscaped(v, sep)` (dans `src/io/vcardEscape.ts`)
- `getFirebase()` (singleton Firebase)

Depuis `apps/web` : `useAuth()` (→ `{ user: { uid, email } | null }`).

---

### Task 1: Modèle `Event` + `EventDraft` + `eventsRepo` (core)

**Files:**
- Create: `packages/core/src/domain/event.ts`
- Modify: `packages/core/src/index.ts` (exporter event)
- Create: `packages/core/src/repositories/events.ts`
- Modify: `packages/core/src/index.ts` (exporter events repo)
- Test: `packages/core/src/domain/event.test.ts`

**Interfaces:**
- Consumes: `BaseEntity` (Phase 0), `createRepository` (Phase 0).
- Produces:
  - `Event` = `BaseEntity & { title: string; start: number; end: number; allDay: boolean; location: string; notes: string; recurrence: string | null; recurrenceExceptions: number[]; reminderOffsets: number[]; contactIds: string[]; taskIds: string[]; categoryId: string | null; color: string; tags: string[] }`
  - `parseEvent(input: unknown): Event` — zod parse with `start/end` numbers, defaults for arrays/strings, and a refine enforcing `end >= start` (throws otherwise).
  - `EventDraft` = the editable content fields (everything except the BaseEntity fields), with `recurrence: string | null`.
  - `emptyEventDraft(): EventDraft` — title "", start/end 0, allDay false, empty strings/arrays, recurrence null, categoryId null.
  - `draftFromEvent(e: Event): EventDraft` — projects an Event to a draft (deep-copies arrays).
  - `eventsRepo`: `Repository<Event>` = `createRepository<Event>("events", parseEvent)`.

- [ ] **Step 1: Write the failing test — `packages/core/src/domain/event.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { parseEvent, emptyEventDraft, draftFromEvent } from "./event";

describe("parseEvent", () => {
  it("accepts a valid event and defaults optional fields", () => {
    const e = parseEvent({
      id: "e1", ownerId: "u1", createdAt: 1, updatedAt: 1, deletedAt: null,
      title: "Réunion", start: 1000, end: 2000,
    });
    expect(e.title).toBe("Réunion");
    expect(e.allDay).toBe(false);
    expect(e.recurrence).toBeNull();
    expect(e.recurrenceExceptions).toEqual([]);
    expect(e.contactIds).toEqual([]);
    expect(e.color).toBe("");
  });

  it("rejects an event whose end is before its start", () => {
    expect(() => parseEvent({
      id: "e1", ownerId: "u1", createdAt: 1, updatedAt: 1, deletedAt: null,
      title: "Bad", start: 5000, end: 2000,
    })).toThrow();
  });

  it("rejects an event without a title", () => {
    expect(() => parseEvent({
      id: "e1", ownerId: "u1", createdAt: 1, updatedAt: 1, deletedAt: null,
      title: "", start: 1000, end: 2000,
    })).toThrow();
  });
});

describe("event drafts", () => {
  it("emptyEventDraft has neutral defaults", () => {
    const d = emptyEventDraft();
    expect(d.title).toBe("");
    expect(d.allDay).toBe(false);
    expect(d.recurrence).toBeNull();
    expect(d.contactIds).toEqual([]);
  });

  it("draftFromEvent deep-copies arrays", () => {
    const e = parseEvent({
      id: "e1", ownerId: "u1", createdAt: 1, updatedAt: 1, deletedAt: null,
      title: "X", start: 1000, end: 2000, contactIds: ["c1"],
    });
    const d = draftFromEvent(e);
    d.contactIds.push("c2");
    expect(e.contactIds).toEqual(["c1"]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @retrorganizer/core test -- event.test`
Expected: FAIL — module `./event` not found.

- [ ] **Step 3: Implement `packages/core/src/domain/event.ts`**

```ts
import { z } from "zod";
import type { BaseEntity } from "./types";

export const eventSchema = z
  .object({
    id: z.string(),
    ownerId: z.string().min(1),
    createdAt: z.number(),
    updatedAt: z.number(),
    deletedAt: z.number().nullable(),
    title: z.string().min(1),
    start: z.number(),
    end: z.number(),
    allDay: z.boolean().default(false),
    location: z.string().default(""),
    notes: z.string().default(""),
    recurrence: z.string().nullable().default(null),
    recurrenceExceptions: z.array(z.number()).default([]),
    reminderOffsets: z.array(z.number()).default([]),
    contactIds: z.array(z.string()).default([]),
    taskIds: z.array(z.string()).default([]),
    categoryId: z.string().nullable().default(null),
    color: z.string().default(""),
    tags: z.array(z.string()).default([]),
  })
  .refine((e) => e.end >= e.start, { message: "end must be >= start", path: ["end"] });

export type Event = z.infer<typeof eventSchema> & BaseEntity;

export function parseEvent(input: unknown): Event {
  return eventSchema.parse(input) as Event;
}

export interface EventDraft {
  title: string;
  start: number;
  end: number;
  allDay: boolean;
  location: string;
  notes: string;
  recurrence: string | null;
  recurrenceExceptions: number[];
  reminderOffsets: number[];
  contactIds: string[];
  taskIds: string[];
  categoryId: string | null;
  color: string;
  tags: string[];
}

export function emptyEventDraft(): EventDraft {
  return {
    title: "", start: 0, end: 0, allDay: false, location: "", notes: "",
    recurrence: null, recurrenceExceptions: [], reminderOffsets: [],
    contactIds: [], taskIds: [], categoryId: null, color: "", tags: [],
  };
}

export function draftFromEvent(e: Event): EventDraft {
  return {
    title: e.title, start: e.start, end: e.end, allDay: e.allDay,
    location: e.location, notes: e.notes, recurrence: e.recurrence,
    recurrenceExceptions: [...e.recurrenceExceptions],
    reminderOffsets: [...e.reminderOffsets],
    contactIds: [...e.contactIds], taskIds: [...e.taskIds],
    categoryId: e.categoryId, color: e.color, tags: [...e.tags],
  };
}
```

- [ ] **Step 4: Implement `packages/core/src/repositories/events.ts`**

```ts
import { createRepository } from "./base";
import { parseEvent, type Event } from "../domain/event";

export const eventsRepo = createRepository<Event>("events", parseEvent);
```

- [ ] **Step 5: Export from `packages/core/src/index.ts`** — add these lines with the other exports:

```ts
export * from "./domain/event";
export * from "./repositories/events";
```

- [ ] **Step 6: Run to verify it passes**

Run: `pnpm --filter @retrorganizer/core test -- event.test`
Expected: PASS — 5 tests. Then `pnpm --filter @retrorganizer/core typecheck` → clean.

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/domain/event.ts packages/core/src/domain/event.test.ts packages/core/src/repositories/events.ts packages/core/src/index.ts
git commit -m "feat(core): Event model (end>=start), EventDraft, eventsRepo"
```

---

### Task 2: Expansion de récurrence (rrule) (core)

**Files:**
- Modify: `packages/core/package.json` (add `rrule` dependency)
- Create: `packages/core/src/domain/recurrence.ts`
- Modify: `packages/core/src/index.ts` (exporter recurrence)
- Test: `packages/core/src/domain/recurrence.test.ts`

**Interfaces:**
- Consumes: `Event` (Task 1), `rrule` (new dep).
- Produces:
  - `Occurrence` = `{ event: Event; start: number; end: number }`
  - `expandEvent(e: Event, rangeStart: number, rangeEnd: number): Occurrence[]` — for a non-recurring event, returns `[{event, start, end}]` if it overlaps `[rangeStart, rangeEnd]` else `[]`. For a recurring event (RRULE in `e.recurrence`), expands occurrences whose START falls within `[rangeStart, rangeEnd]` (inclusive), excludes any in `e.recurrenceExceptions`, and gives each occurrence the same duration `e.end - e.start`.
  - `expandEvents(events: Event[], rangeStart: number, rangeEnd: number): Occurrence[]` — flat-maps `expandEvent` and sorts by `start` ascending.

- [ ] **Step 1: Add the dependency**

Run: `pnpm --filter @retrorganizer/core add rrule@^2.8.1`
Expected: `rrule` appears in `packages/core/package.json` dependencies; lockfile updated.

- [ ] **Step 2: Write the failing test — `packages/core/src/domain/recurrence.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { expandEvent, expandEvents } from "./recurrence";
import { parseEvent, type Event } from "./event";

// 2026-01-05 09:00 UTC for 1h
const START = Date.UTC(2026, 0, 5, 9, 0, 0);
const HOUR = 3600_000;

function mk(extra: Partial<Event> = {}): Event {
  return parseEvent({
    id: "e1", ownerId: "u1", createdAt: 1, updatedAt: 1, deletedAt: null,
    title: "Standup", start: START, end: START + HOUR, ...extra,
  });
}

describe("expandEvent", () => {
  it("returns a single occurrence for a non-recurring event in range", () => {
    const occ = expandEvent(mk(), START - HOUR, START + HOUR);
    expect(occ).toHaveLength(1);
    expect(occ[0]!.start).toBe(START);
    expect(occ[0]!.end).toBe(START + HOUR);
  });

  it("returns nothing when a non-recurring event is outside the range", () => {
    expect(expandEvent(mk(), START + 10 * HOUR, START + 20 * HOUR)).toEqual([]);
  });

  it("expands a daily rule into one occurrence per day within range", () => {
    const e = mk({ recurrence: "FREQ=DAILY" });
    const occ = expandEvent(e, START, START + 3 * 24 * HOUR); // 4 days inclusive
    expect(occ.map((o) => o.start)).toEqual([
      START, START + 24 * HOUR, START + 2 * 24 * HOUR, START + 3 * 24 * HOUR,
    ]);
    expect(occ.every((o) => o.end - o.start === HOUR)).toBe(true);
  });

  it("skips occurrences listed in recurrenceExceptions", () => {
    const skip = START + 24 * HOUR;
    const e = mk({ recurrence: "FREQ=DAILY", recurrenceExceptions: [skip] });
    const occ = expandEvent(e, START, START + 2 * 24 * HOUR);
    expect(occ.map((o) => o.start)).toEqual([START, START + 2 * 24 * HOUR]);
  });
});

describe("expandEvents", () => {
  it("flattens and sorts occurrences by start", () => {
    const a = mk({ start: START + HOUR, end: START + 2 * HOUR });
    const b = mk({ start: START, end: START + HOUR });
    const occ = expandEvents([a, b], START - HOUR, START + 3 * HOUR);
    expect(occ.map((o) => o.start)).toEqual([START, START + HOUR]);
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `pnpm --filter @retrorganizer/core test -- recurrence`
Expected: FAIL — module `./recurrence` not found.

- [ ] **Step 4: Implement `packages/core/src/domain/recurrence.ts`**

```ts
import { rrulestr } from "rrule";
import type { Event } from "./event";

export interface Occurrence {
  event: Event;
  start: number;
  end: number;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

// UTC instant -> iCal UTC datetime (yyyymmddThhmmssZ) for DTSTART
function toICalUtc(ms: number): string {
  const d = new Date(ms);
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

export function expandEvent(e: Event, rangeStart: number, rangeEnd: number): Occurrence[] {
  const duration = e.end - e.start;
  if (!e.recurrence) {
    if (e.start <= rangeEnd && e.end >= rangeStart) {
      return [{ event: e, start: e.start, end: e.end }];
    }
    return [];
  }
  const rule = rrulestr(`DTSTART:${toICalUtc(e.start)}\nRRULE:${e.recurrence}`);
  const exceptions = new Set(e.recurrenceExceptions);
  return rule
    .between(new Date(rangeStart), new Date(rangeEnd), true)
    .map((d) => d.getTime())
    .filter((ms) => !exceptions.has(ms))
    .map((ms) => ({ event: e, start: ms, end: ms + duration }));
}

export function expandEvents(events: Event[], rangeStart: number, rangeEnd: number): Occurrence[] {
  return events
    .flatMap((e) => expandEvent(e, rangeStart, rangeEnd))
    .sort((a, b) => a.start - b.start);
}
```

- [ ] **Step 5: Export from `packages/core/src/index.ts`** — add:

```ts
export * from "./domain/recurrence";
```

- [ ] **Step 6: Run to verify it passes**

Run: `pnpm --filter @retrorganizer/core test -- recurrence`
Expected: PASS — 5 tests. Then `pnpm --filter @retrorganizer/core typecheck` → clean.

> Note exécutant : `rrule`'s `rrulestr` returns an `RRule`; `.between(after, before, inc=true)` includes the boundaries. Occurrences from a UTC `DTSTART` land on exact UTC instants, so `recurrenceExceptions` (occurrence-start millis) match by equality.

- [ ] **Step 7: Commit**

```bash
git add packages/core/package.json packages/core/src/domain/recurrence.ts packages/core/src/domain/recurrence.test.ts packages/core/src/index.ts pnpm-lock.yaml
git commit -m "feat(core): RRULE occurrence expansion with exceptions (rrule)"
```

---

### Task 3: Export ICS (core)

**Files:**
- Create: `packages/core/src/io/ics.ts`
- Modify: `packages/core/src/index.ts` (exporter io/ics)
- Test: `packages/core/src/io/icsExport.test.ts`

**Interfaces:**
- Consumes: `Event` (Task 1), `escapeValue` (Phase 1 `io/vcardEscape`).
- Produces:
  - `eventToVEvent(e: Event): string` — a `BEGIN:VEVENT … END:VEVENT` block (CRLF) with: `UID:<id>@retrorganizer`, `DTSTAMP` (from `e.updatedAt`, UTC), `DTSTART`/`DTEND` (UTC datetime for timed events; `;VALUE=DATE` yyyymmdd for all-day, DTEND = day after start), `SUMMARY` (escaped title), `LOCATION`/`DESCRIPTION` only when non-empty (escaped), `RRULE:<recurrence>` when set, one `EXDATE:` line (comma-joined UTC datetimes) when there are exceptions.
  - `eventsToICS(events: Event[]): string` — full `BEGIN:VCALENDAR`/`VERSION:2.0`/`PRODID:-//Retrorganizer//FR//EN` wrapper around the VEVENT blocks (CRLF), ending `END:VCALENDAR`.
  - Internal date helpers `icalUtc(ms)` (yyyymmddThhmmssZ) and `icalDate(ms)` (yyyymmdd, UTC).

- [ ] **Step 1: Write the failing test — `packages/core/src/io/icsExport.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { eventToVEvent, eventsToICS } from "./ics";
import { parseEvent, type Event } from "../domain/event";

const START = Date.UTC(2026, 0, 5, 9, 0, 0);
const HOUR = 3600_000;

function mk(extra: Partial<Event> = {}): Event {
  return parseEvent({
    id: "e1", ownerId: "u1", createdAt: 10, updatedAt: 20, deletedAt: null,
    title: "Réu; A", start: START, end: START + HOUR, ...extra,
  });
}

describe("eventToVEvent", () => {
  it("emits a timed VEVENT with escaped summary", () => {
    const v = eventToVEvent(mk());
    expect(v).toContain("BEGIN:VEVENT");
    expect(v).toContain("UID:e1@retrorganizer");
    expect(v).toContain("DTSTART:20260105T090000Z");
    expect(v).toContain("DTEND:20260105T100000Z");
    expect(v).toContain("SUMMARY:Réu\\; A");
    expect(v.trim().endsWith("END:VEVENT")).toBe(true);
  });

  it("emits an all-day VEVENT with VALUE=DATE and next-day DTEND", () => {
    const v = eventToVEvent(mk({ allDay: true, start: Date.UTC(2026, 0, 5), end: Date.UTC(2026, 0, 5, 23, 59) }));
    expect(v).toContain("DTSTART;VALUE=DATE:20260105");
    expect(v).toContain("DTEND;VALUE=DATE:20260106");
  });

  it("includes RRULE and EXDATE when present", () => {
    const v = eventToVEvent(mk({ recurrence: "FREQ=DAILY", recurrenceExceptions: [START + 24 * HOUR] }));
    expect(v).toContain("RRULE:FREQ=DAILY");
    expect(v).toContain("EXDATE:20260106T090000Z");
  });

  it("omits LOCATION/DESCRIPTION when empty", () => {
    const v = eventToVEvent(mk());
    expect(v).not.toContain("LOCATION:");
    expect(v).not.toContain("DESCRIPTION:");
  });
});

describe("eventsToICS", () => {
  it("wraps blocks in a VCALENDAR", () => {
    const ics = eventsToICS([mk()]);
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("VERSION:2.0");
    expect(ics.trim().endsWith("END:VCALENDAR")).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @retrorganizer/core test -- icsExport`
Expected: FAIL — module `./ics` not found.

- [ ] **Step 3: Implement `packages/core/src/io/ics.ts`** (export side; import side added in Task 4)

```ts
import type { Event } from "../domain/event";
import { escapeValue } from "./vcardEscape";

const CRLF = "\r\n";

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function icalUtc(ms: number): string {
  const d = new Date(ms);
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

export function icalDate(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;
}

const DAY = 24 * 3600_000;

export function eventToVEvent(e: Event): string {
  const lines: string[] = ["BEGIN:VEVENT"];
  lines.push(`UID:${e.id}@retrorganizer`);
  lines.push(`DTSTAMP:${icalUtc(e.updatedAt)}`);
  if (e.allDay) {
    lines.push(`DTSTART;VALUE=DATE:${icalDate(e.start)}`);
    lines.push(`DTEND;VALUE=DATE:${icalDate(e.start + DAY)}`);
  } else {
    lines.push(`DTSTART:${icalUtc(e.start)}`);
    lines.push(`DTEND:${icalUtc(e.end)}`);
  }
  lines.push(`SUMMARY:${escapeValue(e.title)}`);
  if (e.location) lines.push(`LOCATION:${escapeValue(e.location)}`);
  if (e.notes) lines.push(`DESCRIPTION:${escapeValue(e.notes)}`);
  if (e.recurrence) lines.push(`RRULE:${e.recurrence}`);
  if (e.recurrenceExceptions.length > 0) {
    lines.push(`EXDATE:${e.recurrenceExceptions.map(icalUtc).join(",")}`);
  }
  lines.push("END:VEVENT");
  return lines.join(CRLF) + CRLF;
}

export function eventsToICS(events: Event[]): string {
  const head = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Retrorganizer//FR//EN"].join(CRLF) + CRLF;
  const body = events.map(eventToVEvent).join("");
  return head + body + "END:VCALENDAR" + CRLF;
}
```

- [ ] **Step 4: Export from `packages/core/src/index.ts`** — add:

```ts
export * from "./io/ics";
```

- [ ] **Step 5: Run to verify it passes**

Run: `pnpm --filter @retrorganizer/core test -- icsExport`
Expected: PASS — 5 tests.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/io/ics.ts packages/core/src/io/icsExport.test.ts packages/core/src/index.ts
git commit -m "feat(core): ICS (VEVENT) export with RRULE/EXDATE, all-day support"
```

---

### Task 4: Import ICS (core)

**Files:**
- Modify: `packages/core/src/io/ics.ts` (add import side)
- Test: `packages/core/src/io/icsImport.test.ts`

**Interfaces:**
- Consumes: `EventDraft`, `emptyEventDraft` (Task 1); `unfoldLines`, `unescapeValue`, `splitEscaped` (Phase 1 `io/vcardEscape`); `eventToVEvent`/`eventsToICS` (Task 3, for round-trip).
- Produces:
  - `icsToEventDrafts(text: string): EventDraft[]` — parses every `VEVENT` block. Maps `DTSTART`/`DTEND` (UTC datetime, floating datetime → treated as UTC, or `VALUE=DATE` → all-day, sets `allDay=true`, `end` = day-after-start minus 1ms so duration is the day), `SUMMARY`→title, `LOCATION`, `DESCRIPTION`→notes, `RRULE`→recurrence (string after `RRULE:`), `EXDATE`→recurrenceExceptions (each value parsed to UTC ms). Lines outside VEVENT and unknown properties are ignored. A VEVENT with no DTSTART is skipped.
  - Internal `parseICalDate(value, params): { ms: number; dateOnly: boolean }`.

- [ ] **Step 1: Write the failing test — `packages/core/src/io/icsImport.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { icsToEventDrafts, eventsToICS } from "./ics";
import { parseEvent, type Event } from "../domain/event";

const START = Date.UTC(2026, 0, 5, 9, 0, 0);
const HOUR = 3600_000;

describe("icsToEventDrafts", () => {
  it("parses a timed VEVENT", () => {
    const text = [
      "BEGIN:VCALENDAR", "VERSION:2.0",
      "BEGIN:VEVENT", "UID:e1@retrorganizer",
      "DTSTART:20260105T090000Z", "DTEND:20260105T100000Z",
      "SUMMARY:Réu\\; A", "LOCATION:Paris", "DESCRIPTION:notes",
      "RRULE:FREQ=DAILY", "EXDATE:20260106T090000Z",
      "END:VEVENT", "END:VCALENDAR",
    ].join("\r\n");
    const d = icsToEventDrafts(text)[0]!;
    expect(d.title).toBe("Réu; A");
    expect(d.start).toBe(START);
    expect(d.end).toBe(START + HOUR);
    expect(d.allDay).toBe(false);
    expect(d.location).toBe("Paris");
    expect(d.notes).toBe("notes");
    expect(d.recurrence).toBe("FREQ=DAILY");
    expect(d.recurrenceExceptions).toEqual([START + 24 * HOUR]);
  });

  it("parses an all-day VEVENT (VALUE=DATE)", () => {
    const text = [
      "BEGIN:VEVENT", "UID:x", "DTSTART;VALUE=DATE:20260105", "DTEND;VALUE=DATE:20260106",
      "SUMMARY:Congé", "END:VEVENT",
    ].join("\r\n");
    const d = icsToEventDrafts(text)[0]!;
    expect(d.allDay).toBe(true);
    expect(d.start).toBe(Date.UTC(2026, 0, 5));
    expect(d.title).toBe("Congé");
  });

  it("skips a VEVENT without DTSTART", () => {
    const text = ["BEGIN:VEVENT", "SUMMARY:Nope", "END:VEVENT"].join("\r\n");
    expect(icsToEventDrafts(text)).toEqual([]);
  });

  it("round-trips export -> import for a timed recurring event", () => {
    const e: Event = parseEvent({
      id: "e1", ownerId: "u1", createdAt: 10, updatedAt: 20, deletedAt: null,
      title: "Standup", start: START, end: START + HOUR,
      recurrence: "FREQ=WEEKLY;BYDAY=MO", recurrenceExceptions: [START + 7 * 24 * HOUR],
      location: "Salle 1", notes: "daily sync",
    });
    const d = icsToEventDrafts(eventsToICS([e]))[0]!;
    expect(d.title).toBe("Standup");
    expect(d.start).toBe(START);
    expect(d.recurrence).toBe("FREQ=WEEKLY;BYDAY=MO");
    expect(d.recurrenceExceptions).toEqual([START + 7 * 24 * HOUR]);
    expect(d.location).toBe("Salle 1");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @retrorganizer/core test -- icsImport`
Expected: FAIL — `icsToEventDrafts` not exported.

- [ ] **Step 3: Append the import side to `packages/core/src/io/ics.ts`**

```ts
import type { EventDraft } from "../domain/event";
import { emptyEventDraft } from "../domain/event";
import { unfoldLines, unescapeValue } from "./vcardEscape";

interface ICalLine { name: string; params: Record<string, string>; value: string; }

function parseICalLine(line: string): ICalLine | null {
  const colon = line.indexOf(":");
  if (colon === -1) return null;
  const head = line.slice(0, colon);
  const value = line.slice(colon + 1);
  const segs = head.split(";");
  const name = (segs[0] ?? "").toUpperCase();
  const params: Record<string, string> = {};
  for (let i = 1; i < segs.length; i++) {
    const seg = segs[i] ?? "";
    const eq = seg.indexOf("=");
    if (eq !== -1) params[seg.slice(0, eq).toUpperCase()] = seg.slice(eq + 1);
  }
  return { name, params, value };
}

// "20260105T090000Z" | "20260105T090000" | "20260105"
function parseICalDate(value: string, params: Record<string, string>): { ms: number; dateOnly: boolean } | null {
  const v = value.trim();
  const m = v.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})Z?)?$/);
  if (!m) return null;
  const [, y, mo, da, hh, mi, ss] = m;
  const dateOnly = hh === undefined || params["VALUE"] === "DATE";
  const ms = Date.UTC(
    Number(y), Number(mo) - 1, Number(da),
    Number(hh ?? "0"), Number(mi ?? "0"), Number(ss ?? "0"),
  );
  return { ms, dateOnly };
}

const DAY_MS = 24 * 3600_000;

export function icsToEventDrafts(text: string): EventDraft[] {
  const drafts: EventDraft[] = [];
  let cur: EventDraft | null = null;
  let hasStart = false;
  let explicitEnd = false;
  for (const raw of unfoldLines(text)) {
    const line = raw.trim();
    if (line === "") continue;
    const upper = line.toUpperCase();
    if (upper === "BEGIN:VEVENT") { cur = emptyEventDraft(); hasStart = false; explicitEnd = false; continue; }
    if (upper === "END:VEVENT") {
      if (cur && hasStart) {
        if (!explicitEnd) cur.end = cur.start; // zero-length fallback
        drafts.push(cur);
      }
      cur = null;
      continue;
    }
    if (!cur) continue;
    const p = parseICalLine(line);
    if (!p) continue;
    switch (p.name) {
      case "DTSTART": {
        const d = parseICalDate(p.value, p.params);
        if (d) { cur.start = d.ms; cur.allDay = d.dateOnly; hasStart = true; }
        break;
      }
      case "DTEND": {
        const d = parseICalDate(p.value, p.params);
        if (d) { cur.end = d.dateOnly ? d.ms - 1 : d.ms; explicitEnd = true; }
        break;
      }
      case "SUMMARY": cur.title = unescapeValue(p.value); break;
      case "LOCATION": cur.location = unescapeValue(p.value); break;
      case "DESCRIPTION": cur.notes = unescapeValue(p.value); break;
      case "RRULE": cur.recurrence = p.value.trim(); break;
      case "EXDATE": {
        for (const part of p.value.split(",")) {
          const d = parseICalDate(part, p.params);
          if (d) cur.recurrenceExceptions.push(d.ms);
        }
        break;
      }
      default: break;
    }
  }
  return drafts;
}
```

> Note: for an all-day event, export writes `DTEND;VALUE=DATE` = day-after-start; on import we set `end = thatDay - 1ms` so `end >= start` holds and the event spans the intended day. `splitEscaped` is not needed here (EXDATE is comma-split directly on the raw value, which contains no escaped commas in date lists).

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter @retrorganizer/core test -- icsImport`
Expected: PASS — 4 tests. Then run `pnpm --filter @retrorganizer/core test -- ics` to confirm export + import suites pass together, and `pnpm --filter @retrorganizer/core typecheck` → clean.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/io/ics.ts packages/core/src/io/icsImport.test.ts
git commit -m "feat(core): ICS import (VEVENT) with round-trip test"
```

---

### Task 5: `useEvents` hook (web)

**Files:**
- Create: `apps/web/src/calendar/useEvents.ts`
- Test: `apps/web/src/calendar/useEvents.test.tsx`

**Interfaces:**
- Consumes: `eventsRepo`, `Event`, `EventDraft` (core); `useAuth` (web `../auth/AuthProvider`).
- Produces:
  - `useEvents(): { events: Event[]; loading: boolean; error: string | null; create(d: EventDraft): Promise<void>; update(id: string, d: EventDraft): Promise<void>; remove(id: string): Promise<void>; reload(): Promise<void> }`
  - Same shape and behavior as `useContacts` (Phase 1): loads `eventsRepo.listByOwner(uid)` on mount/uid-change; mutations call repo (wrapped in try/catch that sets `error`) then `reload()`; `uid` null → `events []`, `loading false`.

- [ ] **Step 1: Write the failing test — `apps/web/src/calendar/useEvents.test.tsx`**

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useEvents } from "./useEvents";

const listByOwner = vi.fn();
const create = vi.fn();
vi.mock("@retrorganizer/core", () => ({
  eventsRepo: {
    listByOwner: (...a: unknown[]) => listByOwner(...a),
    create: (...a: unknown[]) => create(...a),
    update: vi.fn(),
    softDelete: vi.fn(),
  },
}));
let mockUser: { uid: string; email: string } | null = { uid: "u1", email: "a@x.io" };
vi.mock("../auth/AuthProvider", () => ({ useAuth: () => ({ user: mockUser }) }));

beforeEach(() => {
  mockUser = { uid: "u1", email: "a@x.io" };
  listByOwner.mockReset().mockResolvedValue([
    { id: "e1", ownerId: "u1", title: "X", start: 1, end: 2, allDay: false, location: "", notes: "", recurrence: null, recurrenceExceptions: [], reminderOffsets: [], contactIds: [], taskIds: [], categoryId: null, color: "", tags: [], createdAt: 1, updatedAt: 1, deletedAt: null },
  ]);
  create.mockReset().mockResolvedValue(undefined);
});

describe("useEvents", () => {
  it("loads events for the current user on mount", async () => {
    const { result } = renderHook(() => useEvents());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(listByOwner).toHaveBeenCalledWith("u1");
    expect(result.current.events.map((e) => e.id)).toEqual(["e1"]);
  });

  it("create calls repo then reloads", async () => {
    const { result } = renderHook(() => useEvents());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.create({ title: "New" } as never); });
    expect(create).toHaveBeenCalledWith("u1", { title: "New" });
    expect(listByOwner).toHaveBeenCalledTimes(2);
  });

  it("returns empty and not-loading when no user", async () => {
    mockUser = null;
    const { result } = renderHook(() => useEvents());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.events).toEqual([]);
    expect(listByOwner).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @retrorganizer/web test -- useEvents`
Expected: FAIL — module `./useEvents` not found.

- [ ] **Step 3: Implement `apps/web/src/calendar/useEvents.ts`**

```ts
import { useCallback, useEffect, useState } from "react";
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

export function useEvents(): UseEvents {
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!uid) { setEvents([]); setLoading(false); return; }
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
    try { await eventsRepo.create(uid, d); await reload(); }
    catch (e) { setError(e instanceof Error ? e.message : "Échec de l'enregistrement"); }
  }, [uid, reload]);

  const update = useCallback(async (id: string, d: EventDraft) => {
    try { await eventsRepo.update(id, d); await reload(); }
    catch (e) { setError(e instanceof Error ? e.message : "Échec de l'enregistrement"); }
  }, [reload]);

  const remove = useCallback(async (id: string) => {
    try { await eventsRepo.softDelete(id); await reload(); }
    catch (e) { setError(e instanceof Error ? e.message : "Échec de la suppression"); }
  }, [reload]);

  return { events, loading, error, create, update, remove, reload };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter @retrorganizer/web test -- useEvents`
Expected: PASS — 3 tests. Then full web suite `pnpm --filter @retrorganizer/web test` (Phase 0/1 still green) and `pnpm --filter @retrorganizer/web typecheck` → clean.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/calendar/useEvents.ts apps/web/src/calendar/useEvents.test.tsx
git commit -m "feat(web): useEvents hook over eventsRepo"
```

---

## Définition de « terminé » pour la Phase 2a

- `pnpm exec firebase emulators:exec --only auth,firestore "pnpm test"` : tous les tests verts, incluant les nouvelles suites core (**event, recurrence, icsExport, icsImport**) et web (**useEvents**).
- `pnpm --filter @retrorganizer/core typecheck` et `pnpm --filter @retrorganizer/web typecheck` propres.
- Expansion de récurrence (quotidienne/hebdo + exceptions) et round-trips ICS (timed + all-day + récurrent) couverts par des tests.

À l'issue de la Phase 2a, le plan **Phase 2b — UI Calendrier** est rédigé sur ce socle : helpers de grille de dates, `EventForm` (récurrence, rappels, liens contact), vues **mois / semaine / jour / agenda**, `CalendarModule`, et câblage de l'onglet **Diary**.
