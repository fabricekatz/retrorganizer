# Retrorganizer — Phase 2b : Calendrier (UI) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construire l'UI du module Calendrier sur la couche données 2a : helpers de grille, formulaire d'événement (dates, all-day, récurrence, rappel, liens contact), vues mois / semaine / jour / agenda, et `CalendarModule` orchestrant navigation, changement de vue et import/export ICS — branché sur l'onglet Diary.

**Architecture:** Les helpers de date purs vivent dans `packages/core` (testables, réutilisables RN). Les vues `apps/web/src/calendar/*` sont des composants présentationnels qui reçoivent des `Occurrence[]` déjà expansées ; `CalendarModule` détient l'état (vue, date d'ancrage), appelle `useEvents` + `expandEvents`, et ouvre `EventForm`. La grille s'affiche en **heure locale** (les événements sont stockés en UTC ms et placés dans les cellules locales).

**Tech Stack:** TypeScript strict, React + Vitest + @testing-library/react. Réutilise la couche 2a (`Event`, `EventDraft`, `eventsRepo`, `expandEvents`, `eventsToICS`, `icsToEventDrafts`, `useEvents`) et la Phase 1 (`useContacts` pour le sélecteur de contacts).

## Global Constraints

- Produit : **Retrorganizer**. TypeScript **strict** (noUncheckedIndexedAccess ON) — dans les TESTS, `const [x] = arr` → `const x = arr[0]!` ; `.mock.calls[0][0]` → `.mock.calls[0]![0] as <Type>` ; ne jamais affaiblir le code de production.
- Aucune app ne parle directement à Firestore — uniquement via `@retrorganizer/core` (`useEvents`/`eventsRepo`).
- Règle métier `end >= start` : le formulaire la valide AVANT submit (message lisible) en plus du refine de `parseEvent`.
- Dates : événements en **millisecondes epoch UTC** ; la grille du calendrier raisonne en **heure locale** (cellules = jours locaux). `recurrence` = chaîne RRULE nue (`"FREQ=WEEKLY"`) ou null.
- Couleur d'accent du module Diary : `moduleAccent.diary` (`@retrorganizer/ui`).
- Réutiliser : `tokens` (ui), `Event`/`EventDraft`/`Occurrence`/`expandEvents`/`emptyEventDraft`/`draftFromEvent`/`eventsToICS`/`icsToEventDrafts` (core), `useEvents` (web), `useContacts` (web).
- Tests sur récurrence/affichage obligatoires : chaque vue + le module ont un test.
- Commits fréquents, un par tâche minimum.

## Interfaces héritées (à consommer, ne pas redéfinir)

Depuis `@retrorganizer/core` :
- `Event` (BaseEntity + title, start, end, allDay, location, notes, recurrence: string|null, recurrenceExceptions, reminderOffsets, contactIds, taskIds, categoryId, color, tags)
- `EventDraft`, `emptyEventDraft()`, `draftFromEvent(e)`
- `Occurrence` = `{ event: Event; start: number; end: number }`
- `expandEvents(events: Event[], rangeStart: number, rangeEnd: number): Occurrence[]`
- `eventsToICS(events: Event[]): string`, `icsToEventDrafts(text: string): EventDraft[]`

Depuis `apps/web` : `useEvents()` (→ `{ events, loading, error, create, update, remove, reload }`), `useContacts()` (→ `{ contacts, ... }`).
Depuis `@retrorganizer/ui` : `tokens`, `moduleAccent`.

---

### Task 1: Helpers de grille de calendrier (core)

**Files:**
- Create: `packages/core/src/domain/calendarGrid.ts`
- Modify: `packages/core/src/index.ts` (exporter calendarGrid)
- Test: `packages/core/src/domain/calendarGrid.test.ts`

**Interfaces:**
- Consumes: rien.
- Produces (toutes en **heure locale**) :
  - `startOfDay(ms: number): number` — minuit local du jour de `ms`.
  - `addDays(ms: number, n: number): number` — `n` jours plus tard (gère les changements d'heure via `Date.setDate`).
  - `startOfWeek(ms: number): number` — lundi 00:00 local de la semaine de `ms`.
  - `sameDay(a: number, b: number): boolean` — même jour local.
  - `monthMatrix(year: number, month: number): number[]` — 42 millis de début de jour (grille 6×7, mois `0-11`, commence le lundi de la semaine du 1er).
  - `weekDays(ms: number): number[]` — 7 millis de début de jour (lundi→dimanche) de la semaine de `ms`.
  - `minutesIntoDay(ms: number): number` — minutes locales écoulées depuis minuit (0–1439.99).

- [ ] **Step 1: Write the failing test — `packages/core/src/domain/calendarGrid.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { startOfDay, addDays, startOfWeek, sameDay, monthMatrix, weekDays, minutesIntoDay } from "./calendarGrid";

describe("calendarGrid", () => {
  it("startOfDay zeroes the time of day (local)", () => {
    const noon = new Date(2026, 0, 15, 12, 30).getTime();
    const sod = startOfDay(noon);
    expect(new Date(sod).getHours()).toBe(0);
    expect(new Date(sod).getMinutes()).toBe(0);
    expect(sameDay(sod, noon)).toBe(true);
  });

  it("addDays advances by whole days", () => {
    const d = new Date(2026, 0, 31).getTime();
    expect(new Date(addDays(d, 1)).getDate()).toBe(1); // Feb 1
    expect(new Date(addDays(d, 1)).getMonth()).toBe(1);
  });

  it("startOfWeek returns the Monday 00:00", () => {
    // 2026-01-15 is a Thursday
    const ws = startOfWeek(new Date(2026, 0, 15, 9).getTime());
    expect(new Date(ws).getDay()).toBe(1); // Monday
    expect(new Date(ws).getHours()).toBe(0);
    expect(new Date(ws).getDate()).toBe(12); // Mon 2026-01-12
  });

  it("monthMatrix returns 42 consecutive day-starts beginning on a Monday", () => {
    const cells = monthMatrix(2026, 0); // January 2026
    expect(cells).toHaveLength(42);
    expect(new Date(cells[0]!).getDay()).toBe(1); // Monday
    for (let i = 1; i < cells.length; i++) {
      expect(cells[i]).toBe(addDays(cells[i - 1]!, 1));
    }
  });

  it("weekDays returns 7 day-starts Mon..Sun", () => {
    const days = weekDays(new Date(2026, 0, 15).getTime());
    expect(days).toHaveLength(7);
    expect(new Date(days[0]!).getDay()).toBe(1);
    expect(new Date(days[6]!).getDay()).toBe(0); // Sunday
  });

  it("minutesIntoDay measures local minutes since midnight", () => {
    const t = startOfDay(new Date(2026, 0, 15).getTime()) + 90 * 60000;
    expect(minutesIntoDay(t)).toBe(90);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @retrorganizer/core test -- calendarGrid`
Expected: FAIL — module `./calendarGrid` not found.

- [ ] **Step 3: Implement `packages/core/src/domain/calendarGrid.ts`**

```ts
export function startOfDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function addDays(ms: number, n: number): number {
  const d = new Date(ms);
  d.setDate(d.getDate() + n);
  return d.getTime();
}

export function startOfWeek(ms: number): number {
  const sod = startOfDay(ms);
  const dow = (new Date(sod).getDay() + 6) % 7; // 0 = Monday
  return addDays(sod, -dow);
}

export function sameDay(a: number, b: number): boolean {
  return startOfDay(a) === startOfDay(b);
}

export function monthMatrix(year: number, month: number): number[] {
  const first = startOfDay(new Date(year, month, 1).getTime());
  const gridStart = startOfWeek(first);
  return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
}

export function weekDays(ms: number): number[] {
  const ws = startOfWeek(ms);
  return Array.from({ length: 7 }, (_, i) => addDays(ws, i));
}

export function minutesIntoDay(ms: number): number {
  return (ms - startOfDay(ms)) / 60000;
}
```

- [ ] **Step 4: Export from `packages/core/src/index.ts`** — add:

```ts
export * from "./domain/calendarGrid";
```

- [ ] **Step 5: Run to verify it passes**

Run: `pnpm --filter @retrorganizer/core test -- calendarGrid`
Expected: PASS — 6 tests. Then `pnpm --filter @retrorganizer/core typecheck` → clean.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/domain/calendarGrid.ts packages/core/src/domain/calendarGrid.test.ts packages/core/src/index.ts
git commit -m "feat(core): local-time calendar grid helpers"
```

---

### Task 2: `EventForm` (web)

**Files:**
- Create: `apps/web/src/calendar/datetime.ts`
- Create: `apps/web/src/calendar/EventForm.tsx`
- Test: `apps/web/src/calendar/EventForm.test.tsx`

**Interfaces:**
- Consumes: `tokens` (ui); `EventDraft`, `emptyEventDraft`, `draftFromEvent` (core); `useContacts` (web, `../contacts/useContacts`).
- Produces:
  - `datetime.ts`: `toLocalInput(ms): string` (`yyyy-MM-ddThh:mm`), `fromLocalInput(s): number`, `toDateInput(ms): string` (`yyyy-MM-dd`), `fromDateInput(s): number` — all LOCAL.
  - `EVENT_RECUR_PRESETS: { label: string; value: string }[]`, `EVENT_REMINDER_PRESETS: { label: string; value: number }[]` (value `-1` = none).
  - `EventForm`: `<EventForm initial?={EventDraft} onSubmit onCancel />` — controlled form over an `EventDraft`. Fields: title (required), all-day checkbox, start/end (`datetime-local` when timed, `date` when all-day), location, notes, recurrence `<select>` (preset → `recurrence` string|null), reminder `<select>` (preset → `reminderOffsets`), and a contact link list (checkboxes from `useContacts().contacts`, toggling `contactIds`). On submit: if `end < start` set an inline error and do NOT call onSubmit; else `onSubmit(draft)`. Submit button "Enregistrer".

- [ ] **Step 1: Write the failing test — `apps/web/src/calendar/EventForm.test.tsx`**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { EventForm } from "./EventForm";
import type { EventDraft } from "@retrorganizer/core";

vi.mock("../contacts/useContacts", () => ({
  useContacts: () => ({ contacts: [{ id: "c1", displayName: "Ada Lovelace" }], loading: false }),
}));

describe("EventForm", () => {
  it("submits a draft with title, times and a weekly recurrence", () => {
    const onSubmit = vi.fn();
    render(<EventForm onSubmit={onSubmit} onCancel={() => {}} />);
    fireEvent.change(screen.getByLabelText("Titre"), { target: { value: "Réunion" } });
    fireEvent.change(screen.getByLabelText("Début"), { target: { value: "2026-01-05T09:00" } });
    fireEvent.change(screen.getByLabelText("Fin"), { target: { value: "2026-01-05T10:00" } });
    fireEvent.change(screen.getByLabelText("Récurrence"), { target: { value: "FREQ=WEEKLY" } });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const d = onSubmit.mock.calls[0]![0] as EventDraft;
    expect(d.title).toBe("Réunion");
    expect(d.recurrence).toBe("FREQ=WEEKLY");
    expect(d.start).toBe(new Date("2026-01-05T09:00").getTime());
    expect(d.end).toBe(new Date("2026-01-05T10:00").getTime());
  });

  it("blocks submit and shows an error when end is before start", () => {
    const onSubmit = vi.fn();
    render(<EventForm onSubmit={onSubmit} onCancel={() => {}} />);
    fireEvent.change(screen.getByLabelText("Titre"), { target: { value: "X" } });
    fireEvent.change(screen.getByLabelText("Début"), { target: { value: "2026-01-05T10:00" } });
    fireEvent.change(screen.getByLabelText("Fin"), { target: { value: "2026-01-05T09:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(/fin/i);
  });

  it("toggles a contact link", () => {
    const onSubmit = vi.fn();
    render(<EventForm onSubmit={onSubmit} onCancel={() => {}} />);
    fireEvent.change(screen.getByLabelText("Titre"), { target: { value: "X" } });
    fireEvent.change(screen.getByLabelText("Début"), { target: { value: "2026-01-05T09:00" } });
    fireEvent.change(screen.getByLabelText("Fin"), { target: { value: "2026-01-05T10:00" } });
    fireEvent.click(screen.getByLabelText("Ada Lovelace"));
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    const d = onSubmit.mock.calls[0]![0] as EventDraft;
    expect(d.contactIds).toEqual(["c1"]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @retrorganizer/web test -- EventForm`
Expected: FAIL — module `./EventForm` not found.

- [ ] **Step 3: Implement `apps/web/src/calendar/datetime.ts`**

```ts
function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function toLocalInput(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromLocalInput(s: string): number {
  return new Date(s).getTime();
}

export function toDateInput(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fromDateInput(s: string): number {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1).getTime();
}
```

- [ ] **Step 4: Implement `apps/web/src/calendar/EventForm.tsx`**

```tsx
import { useState } from "react";
import { tokens } from "@retrorganizer/ui";
import { emptyEventDraft, type EventDraft } from "@retrorganizer/core";
import { useContacts } from "../contacts/useContacts";
import { toLocalInput, fromLocalInput, toDateInput, fromDateInput } from "./datetime";

export const EVENT_RECUR_PRESETS: { label: string; value: string }[] = [
  { label: "Aucune", value: "" },
  { label: "Tous les jours", value: "FREQ=DAILY" },
  { label: "Toutes les semaines", value: "FREQ=WEEKLY" },
  { label: "Tous les mois", value: "FREQ=MONTHLY" },
  { label: "Tous les ans", value: "FREQ=YEARLY" },
];

export const EVENT_REMINDER_PRESETS: { label: string; value: number }[] = [
  { label: "Aucun", value: -1 },
  { label: "10 minutes avant", value: 10 },
  { label: "1 heure avant", value: 60 },
  { label: "1 jour avant", value: 1440 },
];

export interface EventFormProps {
  initial?: EventDraft;
  onSubmit(draft: EventDraft): void;
  onCancel(): void;
}

export function EventForm({ initial, onSubmit, onCancel }: EventFormProps) {
  const [draft, setDraft] = useState<EventDraft>(initial ?? emptyEventDraft());
  const [error, setError] = useState<string | null>(null);
  const { contacts } = useContacts();

  function set<K extends keyof EventDraft>(key: K, value: EventDraft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (draft.end < draft.start) {
      setError("La fin doit être après le début.");
      return;
    }
    onSubmit(draft);
  }

  const reminderValue = draft.reminderOffsets[0] ?? -1;

  return (
    <form onSubmit={submit} style={{ padding: tokens.space.md, font: `13px ${tokens.font.body}`, display: "grid", gap: tokens.space.sm }}>
      <label>Titre
        <input aria-label="Titre" value={draft.title} onChange={(e) => set("title", e.target.value)}
          style={{ display: "block", width: "100%" }} />
      </label>

      <label>
        <input type="checkbox" aria-label="Toute la journée" checked={draft.allDay}
          onChange={(e) => set("allDay", e.target.checked)} /> Toute la journée
      </label>

      {draft.allDay ? (
        <>
          <label>Début
            <input aria-label="Début" type="date" value={draft.start ? toDateInput(draft.start) : ""}
              onChange={(e) => set("start", fromDateInput(e.target.value))} style={{ display: "block" }} />
          </label>
          <label>Fin
            <input aria-label="Fin" type="date" value={draft.end ? toDateInput(draft.end) : ""}
              onChange={(e) => set("end", fromDateInput(e.target.value))} style={{ display: "block" }} />
          </label>
        </>
      ) : (
        <>
          <label>Début
            <input aria-label="Début" type="datetime-local" value={draft.start ? toLocalInput(draft.start) : ""}
              onChange={(e) => set("start", fromLocalInput(e.target.value))} style={{ display: "block" }} />
          </label>
          <label>Fin
            <input aria-label="Fin" type="datetime-local" value={draft.end ? toLocalInput(draft.end) : ""}
              onChange={(e) => set("end", fromLocalInput(e.target.value))} style={{ display: "block" }} />
          </label>
        </>
      )}

      <label>Lieu
        <input aria-label="Lieu" value={draft.location} onChange={(e) => set("location", e.target.value)}
          style={{ display: "block", width: "100%" }} />
      </label>

      <label>Récurrence
        <select aria-label="Récurrence" value={draft.recurrence ?? ""}
          onChange={(e) => set("recurrence", e.target.value === "" ? null : e.target.value)} style={{ display: "block" }}>
          {EVENT_RECUR_PRESETS.map((p) => <option key={p.label} value={p.value}>{p.label}</option>)}
        </select>
      </label>

      <label>Rappel
        <select aria-label="Rappel" value={reminderValue}
          onChange={(e) => set("reminderOffsets", Number(e.target.value) < 0 ? [] : [Number(e.target.value)])} style={{ display: "block" }}>
          {EVENT_REMINDER_PRESETS.map((p) => <option key={p.label} value={p.value}>{p.label}</option>)}
        </select>
      </label>

      <label>Notes
        <textarea aria-label="Notes" value={draft.notes} onChange={(e) => set("notes", e.target.value)}
          style={{ display: "block", width: "100%" }} />
      </label>

      {contacts.length > 0 && (
        <fieldset style={{ border: `1px solid ${tokens.color.line}` }}>
          <legend>Contacts liés</legend>
          {contacts.map((c) => (
            <label key={c.id} style={{ display: "block" }}>
              <input type="checkbox" aria-label={c.displayName} checked={draft.contactIds.includes(c.id)}
                onChange={(e) =>
                  set("contactIds", e.target.checked
                    ? [...draft.contactIds, c.id]
                    : draft.contactIds.filter((id) => id !== c.id))} />
              {" "}{c.displayName}
            </label>
          ))}
        </fieldset>
      )}

      {error && <p role="alert" style={{ color: "#a8431f" }}>{error}</p>}
      <div style={{ display: "flex", gap: tokens.space.sm }}>
        <button type="submit">Enregistrer</button>
        <button type="button" onClick={onCancel}>Annuler</button>
      </div>
    </form>
  );
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `pnpm --filter @retrorganizer/web test -- EventForm`
Expected: PASS — 3 tests. Then `pnpm --filter @retrorganizer/web typecheck` → clean.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/calendar/datetime.ts apps/web/src/calendar/EventForm.tsx apps/web/src/calendar/EventForm.test.tsx
git commit -m "feat(web): EventForm (times, all-day, recurrence/reminder presets, contact links)"
```

---

### Task 3: `MonthView` (web)

**Files:**
- Create: `apps/web/src/calendar/MonthView.tsx`
- Test: `apps/web/src/calendar/MonthView.test.tsx`

**Interfaces:**
- Consumes: `tokens` (ui); `Occurrence`, `monthMatrix`, `sameDay`, `startOfDay` (core).
- Produces:
  - `MonthView`: `<MonthView year month occurrences onSelectDay onSelectOccurrence />` where `year`/`month` (0–11) define the grid (`monthMatrix`), `occurrences: Occurrence[]`, `onSelectDay(dayStartMs)`, `onSelectOccurrence(occ)`. Renders a 7-column grid (Lun…Dim header) of 42 day cells. Each cell shows the day-of-month number (dimmed when outside `month`) and, for occurrences where `sameDay(occ.start, cell)`, a clickable chip with the event title. Clicking empty cell space calls `onSelectDay`.

- [ ] **Step 1: Write the failing test — `apps/web/src/calendar/MonthView.test.tsx`**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MonthView } from "./MonthView";
import { startOfDay, type Occurrence, type Event } from "@retrorganizer/core";

function occOn(year: number, month: number, day: number, title: string): Occurrence {
  const start = new Date(year, month, day, 9, 0).getTime();
  const event = { id: "e" + day, title, start, end: start + 3600000 } as Event;
  return { event, start, end: start + 3600000 };
}

describe("MonthView", () => {
  it("renders a chip for an occurrence on its day and fires onSelectOccurrence", () => {
    const onSelectOccurrence = vi.fn();
    const occ = occOn(2026, 0, 15, "Réunion");
    render(<MonthView year={2026} month={0} occurrences={[occ]}
      onSelectDay={() => {}} onSelectOccurrence={onSelectOccurrence} />);
    const chip = screen.getByRole("button", { name: /Réunion/ });
    fireEvent.click(chip);
    expect(onSelectOccurrence).toHaveBeenCalledWith(occ);
  });

  it("renders 42 day cells", () => {
    render(<MonthView year={2026} month={0} occurrences={[]}
      onSelectDay={() => {}} onSelectOccurrence={() => {}} />);
    expect(screen.getAllByTestId("month-cell")).toHaveLength(42);
  });

  it("calls onSelectDay with the day start when a cell is clicked", () => {
    const onSelectDay = vi.fn();
    render(<MonthView year={2026} month={0} occurrences={[]}
      onSelectDay={onSelectDay} onSelectOccurrence={() => {}} />);
    fireEvent.click(screen.getAllByTestId("month-cell")[10]!);
    expect(onSelectDay).toHaveBeenCalledTimes(1);
    expect(typeof onSelectDay.mock.calls[0]![0]).toBe("number");
    expect(onSelectDay.mock.calls[0]![0]).toBe(startOfDay(onSelectDay.mock.calls[0]![0] as number));
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @retrorganizer/web test -- MonthView`
Expected: FAIL — module `./MonthView` not found.

- [ ] **Step 3: Implement `apps/web/src/calendar/MonthView.tsx`**

```tsx
import { tokens } from "@retrorganizer/ui";
import { monthMatrix, sameDay, type Occurrence } from "@retrorganizer/core";

const WEEKDAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

export interface MonthViewProps {
  year: number;
  month: number; // 0-11
  occurrences: Occurrence[];
  onSelectDay(dayStartMs: number): void;
  onSelectOccurrence(occ: Occurrence): void;
}

export function MonthView({ year, month, occurrences, onSelectDay, onSelectOccurrence }: MonthViewProps) {
  const cells = monthMatrix(year, month);
  return (
    <div style={{ font: `12px ${tokens.font.body}` }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", borderBottom: `1px solid ${tokens.color.line}` }}>
        {WEEKDAYS.map((w) => (
          <div key={w} style={{ padding: tokens.space.xs, textAlign: "center", color: tokens.color.muted }}>{w}</div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
        {cells.map((cell) => {
          const inMonth = new Date(cell).getMonth() === month;
          const dayOccs = occurrences.filter((o) => sameDay(o.start, cell));
          return (
            <div key={cell} data-testid="month-cell" onClick={() => onSelectDay(cell)}
              style={{ minHeight: 72, border: `1px solid ${tokens.color.line}`, padding: tokens.space.xs,
                background: tokens.color.surface, cursor: "pointer",
                color: inMonth ? tokens.color.ink : tokens.color.muted }}>
              <div style={{ textAlign: "right" }}>{new Date(cell).getDate()}</div>
              {dayOccs.map((o, i) => (
                <button key={i} type="button"
                  onClick={(e) => { e.stopPropagation(); onSelectOccurrence(o); }}
                  style={{ display: "block", width: "100%", textAlign: "left", border: "none",
                    borderRadius: tokens.radius.sm, marginTop: 2, padding: "1px 4px", cursor: "pointer",
                    background: o.event.color || tokens.color.paper, color: tokens.color.ink,
                    overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                  {o.event.title}
                </button>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter @retrorganizer/web test -- MonthView`
Expected: PASS — 3 tests. Then `pnpm --filter @retrorganizer/web typecheck` → clean.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/calendar/MonthView.tsx apps/web/src/calendar/MonthView.test.tsx
git commit -m "feat(web): MonthView 6x7 grid with event chips"
```

---

### Task 4: `AgendaView` (web)

**Files:**
- Create: `apps/web/src/calendar/AgendaView.tsx`
- Test: `apps/web/src/calendar/AgendaView.test.tsx`

**Interfaces:**
- Consumes: `tokens` (ui); `Occurrence`, `sameDay`, `startOfDay` (core).
- Produces:
  - `AgendaView`: `<AgendaView occurrences onSelectOccurrence />` — renders occurrences (assumed already sorted by start) grouped by local day: a day header (formatted) then one clickable row per occurrence showing start time + title. Empty list → a "Aucun événement" message.

- [ ] **Step 1: Write the failing test — `apps/web/src/calendar/AgendaView.test.tsx`**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AgendaView } from "./AgendaView";
import type { Occurrence, Event } from "@retrorganizer/core";

function occ(year: number, month: number, day: number, hour: number, title: string): Occurrence {
  const start = new Date(year, month, day, hour).getTime();
  return { event: { id: title, title, start, end: start + 3600000 } as Event, start, end: start + 3600000 };
}

describe("AgendaView", () => {
  it("lists occurrences and fires onSelectOccurrence", () => {
    const onSelect = vi.fn();
    const a = occ(2026, 0, 5, 9, "Standup");
    render(<AgendaView occurrences={[a]} onSelectOccurrence={onSelect} />);
    fireEvent.click(screen.getByRole("button", { name: /Standup/ }));
    expect(onSelect).toHaveBeenCalledWith(a);
  });

  it("shows an empty message when there are no occurrences", () => {
    render(<AgendaView occurrences={[]} onSelectOccurrence={() => {}} />);
    expect(screen.getByText("Aucun événement")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @retrorganizer/web test -- AgendaView`
Expected: FAIL — module `./AgendaView` not found.

- [ ] **Step 3: Implement `apps/web/src/calendar/AgendaView.tsx`**

```tsx
import { tokens } from "@retrorganizer/ui";
import { sameDay, type Occurrence } from "@retrorganizer/core";

export interface AgendaViewProps {
  occurrences: Occurrence[];
  onSelectOccurrence(occ: Occurrence): void;
}

function dayLabel(ms: number): string {
  return new Date(ms).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
}

function timeLabel(ms: number): string {
  return new Date(ms).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

export function AgendaView({ occurrences, onSelectOccurrence }: AgendaViewProps) {
  if (occurrences.length === 0) {
    return <p style={{ padding: tokens.space.lg, color: tokens.color.muted }}>Aucun événement</p>;
  }
  return (
    <div style={{ font: `13px ${tokens.font.body}` }}>
      {occurrences.map((o, i) => {
        const newDay = i === 0 || !sameDay(o.start, occurrences[i - 1]!.start);
        return (
          <div key={i}>
            {newDay && (
              <div style={{ padding: tokens.space.xs, fontWeight: "bold", color: tokens.color.ink,
                background: tokens.color.paper, borderBottom: `1px solid ${tokens.color.line}` }}>
                {dayLabel(o.start)}
              </div>
            )}
            <button type="button" onClick={() => onSelectOccurrence(o)}
              style={{ display: "flex", gap: tokens.space.sm, width: "100%", textAlign: "left",
                border: "none", borderBottom: `1px solid ${tokens.color.line}`, background: "transparent",
                padding: tokens.space.xs, cursor: "pointer", color: tokens.color.ink }}>
              <span style={{ color: tokens.color.muted, minWidth: 48 }}>{o.event.allDay ? "Jour" : timeLabel(o.start)}</span>
              <span>{o.event.title}</span>
            </button>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter @retrorganizer/web test -- AgendaView`
Expected: PASS — 2 tests. Then `pnpm --filter @retrorganizer/web typecheck` → clean.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/calendar/AgendaView.tsx apps/web/src/calendar/AgendaView.test.tsx
git commit -m "feat(web): AgendaView chronological list grouped by day"
```

---

### Task 5: `TimeGridView` (jour + semaine) (web)

**Files:**
- Create: `apps/web/src/calendar/TimeGridView.tsx`
- Test: `apps/web/src/calendar/TimeGridView.test.tsx`

**Interfaces:**
- Consumes: `tokens` (ui); `Occurrence`, `sameDay`, `minutesIntoDay` (core).
- Produces:
  - `TimeGridView`: `<TimeGridView days occurrences onSelectOccurrence />` where `days: number[]` is the list of local day-start ms to render as columns (1 for day view, 7 for week view). Renders an hour scale (00–23, `HOUR_PX = 36`) on the left and one column per day. Timed occurrences with `sameDay(occ.start, day)` are absolutely-positioned blocks: `top = minutesIntoDay(start)/60*HOUR_PX`, `height = max(16, (end-start)/3600000*HOUR_PX)`, clickable → `onSelectOccurrence`. All-day occurrences for a day render as a chip in a top strip for that column.

- [ ] **Step 1: Write the failing test — `apps/web/src/calendar/TimeGridView.test.tsx`**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TimeGridView } from "./TimeGridView";
import { startOfDay, type Occurrence, type Event } from "@retrorganizer/core";

const DAY = new Date(2026, 0, 5).getTime();

function timed(hour: number, title: string): Occurrence {
  const start = new Date(2026, 0, 5, hour).getTime();
  return { event: { id: title, title, start, end: start + 3600000, allDay: false } as Event, start, end: start + 3600000 };
}

describe("TimeGridView", () => {
  it("renders a day column and positions a timed occurrence block", () => {
    const onSelect = vi.fn();
    render(<TimeGridView days={[startOfDay(DAY)]} occurrences={[timed(9, "Réunion")]} onSelectOccurrence={onSelect} />);
    const block = screen.getByRole("button", { name: /Réunion/ });
    fireEvent.click(block);
    expect(onSelect).toHaveBeenCalledTimes(1);
    // 09:00 -> top = 9*36 = 324px
    expect(block.style.top).toBe("324px");
  });

  it("renders 7 day columns for a week", () => {
    const days = Array.from({ length: 7 }, (_, i) => startOfDay(new Date(2026, 0, 5 + i).getTime()));
    render(<TimeGridView days={days} occurrences={[]} onSelectOccurrence={() => {}} />);
    expect(screen.getAllByTestId("day-column")).toHaveLength(7);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @retrorganizer/web test -- TimeGridView`
Expected: FAIL — module `./TimeGridView` not found.

- [ ] **Step 3: Implement `apps/web/src/calendar/TimeGridView.tsx`**

```tsx
import { tokens } from "@retrorganizer/ui";
import { sameDay, minutesIntoDay, type Occurrence } from "@retrorganizer/core";

const HOUR_PX = 36;
const HOURS = Array.from({ length: 24 }, (_, h) => h);

export interface TimeGridViewProps {
  days: number[]; // local day-start ms, 1 (day) or 7 (week)
  occurrences: Occurrence[];
  onSelectOccurrence(occ: Occurrence): void;
}

export function TimeGridView({ days, occurrences, onSelectOccurrence }: TimeGridViewProps) {
  return (
    <div style={{ display: "flex", font: `11px ${tokens.font.body}`, overflow: "auto" }}>
      <div style={{ width: 40, flexShrink: 0 }}>
        <div style={{ height: 20 }} />
        {HOURS.map((h) => (
          <div key={h} style={{ height: HOUR_PX, color: tokens.color.muted, textAlign: "right", paddingRight: 4 }}>
            {String(h).padStart(2, "0")}:00
          </div>
        ))}
      </div>
      {days.map((day) => {
        const dayOccs = occurrences.filter((o) => sameDay(o.start, day));
        const allDay = dayOccs.filter((o) => o.event.allDay);
        const timed = dayOccs.filter((o) => !o.event.allDay);
        return (
          <div key={day} data-testid="day-column"
            style={{ flex: 1, minWidth: 80, borderLeft: `1px solid ${tokens.color.line}` }}>
            <div style={{ height: 20, borderBottom: `1px solid ${tokens.color.line}`, overflow: "hidden" }}>
              {allDay.map((o, i) => (
                <button key={i} type="button" onClick={() => onSelectOccurrence(o)}
                  style={{ border: "none", background: o.event.color || tokens.color.paper, cursor: "pointer", fontSize: 10 }}>
                  {o.event.title}
                </button>
              ))}
            </div>
            <div style={{ position: "relative", height: 24 * HOUR_PX, background: tokens.color.surface }}>
              {HOURS.map((h) => (
                <div key={h} style={{ position: "absolute", top: h * HOUR_PX, left: 0, right: 0,
                  borderTop: `1px solid ${tokens.color.line}` }} />
              ))}
              {timed.map((o, i) => (
                <button key={i} type="button" onClick={() => onSelectOccurrence(o)}
                  style={{ position: "absolute", left: 2, right: 2,
                    top: (minutesIntoDay(o.start) / 60) * HOUR_PX,
                    height: Math.max(16, ((o.end - o.start) / 3600000) * HOUR_PX),
                    border: `1px solid ${tokens.color.line}`, borderRadius: tokens.radius.sm,
                    background: o.event.color || tokens.color.paper, color: tokens.color.ink,
                    textAlign: "left", padding: "1px 3px", cursor: "pointer", overflow: "hidden" }}>
                  {o.event.title}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter @retrorganizer/web test -- TimeGridView`
Expected: PASS — 2 tests. Then `pnpm --filter @retrorganizer/web typecheck` → clean.

> Note exécutant : la couleur `o.event.color` est `""` par défaut, donc `o.event.color || tokens.color.paper` retombe sur la couleur papier. Le test vérifie `block.style.top === "324px"` (9 h × 36 px) — ne pas changer `HOUR_PX`.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/calendar/TimeGridView.tsx apps/web/src/calendar/TimeGridView.test.tsx
git commit -m "feat(web): TimeGridView day/week time grid with positioned blocks"
```

---

### Task 6: `CalendarModule` + route Diary (web)

**Files:**
- Create: `apps/web/src/calendar/CalendarModule.tsx`
- Modify: `apps/web/src/App.tsx` (route `diary` → `CalendarModule`)
- Test: `apps/web/src/calendar/CalendarModule.test.tsx`

**Interfaces:**
- Consumes: `tokens` (ui); `useEvents` (Task of 2a); `expandEvents`, `monthMatrix`, `weekDays`, `startOfDay`, `addDays`, `draftFromEvent`, `emptyEventDraft`, `eventsToICS`, `icsToEventDrafts`, `type Event`, `type EventDraft`, `type Occurrence` (core); `MonthView`, `AgendaView`, `TimeGridView`, `EventForm` (Tasks 2–5).
- Produces:
  - `CalendarModule`: `<CalendarModule initialAnchor?={number} />` (default `startOfDay(Date.now())`). Holds `view: "month"|"week"|"day"|"agenda"`, `anchor: number`, and edit state (`editing: { draft, id } | null`). Computes the visible `[rangeStart, rangeEnd]` from `view`+`anchor`, calls `expandEvents(events, rangeStart, rangeEnd)`, and renders the matching view. Toolbar: view buttons, `‹`/Aujourd'hui/`›` navigation (shifts `anchor` by month/week/day; agenda shifts by 30 days), `+ Nouvel événement`, and `Exporter ICS` / `Importer ICS` (file input). Selecting a day → new draft (start = day 09:00, end +1h); selecting an occurrence → `draftFromEvent`; submit → `create` or `update`; delete → `remove`; ICS import → `create` each parsed draft. Wires `App.tsx` route `diary` → `<CalendarModule />`.

- [ ] **Step 1: Write the failing test — `apps/web/src/calendar/CalendarModule.test.tsx`**

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CalendarModule } from "./CalendarModule";

const listByOwner = vi.fn();
const create = vi.fn();
vi.mock("@retrorganizer/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@retrorganizer/core")>();
  return {
    ...actual,
    eventsRepo: {
      listByOwner: (...a: unknown[]) => listByOwner(...a),
      create: (...a: unknown[]) => create(...a),
      update: vi.fn(),
      softDelete: vi.fn(),
    },
  };
});
vi.mock("../auth/AuthProvider", () => ({ useAuth: () => ({ user: { uid: "u1", email: "a@x.io" } }) }));
vi.mock("../contacts/useContacts", () => ({ useContacts: () => ({ contacts: [], loading: false }) }));

beforeEach(() => {
  listByOwner.mockReset().mockResolvedValue([]);
  create.mockReset().mockResolvedValue(undefined);
});

const ANCHOR = new Date(2026, 0, 15).getTime();

describe("CalendarModule", () => {
  it("renders the month view by default with the four view switches", async () => {
    render(<CalendarModule initialAnchor={ANCHOR} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Mois" })).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Semaine" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Jour" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Agenda" })).toBeInTheDocument();
    expect(screen.getAllByTestId("month-cell")).toHaveLength(42);
  });

  it("creates an event through the new-event flow", async () => {
    render(<CalendarModule initialAnchor={ANCHOR} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "+ Nouvel événement" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "+ Nouvel événement" }));
    fireEvent.change(screen.getByLabelText("Titre"), { target: { value: "Réunion" } });
    fireEvent.change(screen.getByLabelText("Début"), { target: { value: "2026-01-15T09:00" } });
    fireEvent.change(screen.getByLabelText("Fin"), { target: { value: "2026-01-15T10:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
    expect(create.mock.calls[0]![0]).toBe("u1");
    expect((create.mock.calls[0]![1] as { title: string }).title).toBe("Réunion");
  });

  it("switches to the agenda view", async () => {
    render(<CalendarModule initialAnchor={ANCHOR} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Agenda" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Agenda" }));
    expect(screen.getByText("Aucun événement")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @retrorganizer/web test -- CalendarModule`
Expected: FAIL — module `./CalendarModule` not found.

- [ ] **Step 3: Implement `apps/web/src/calendar/CalendarModule.tsx`**

```tsx
import { useMemo, useState } from "react";
import { tokens } from "@retrorganizer/ui";
import {
  expandEvents, monthMatrix, weekDays, startOfDay, addDays,
  draftFromEvent, emptyEventDraft, eventsToICS, icsToEventDrafts,
  type Event, type EventDraft, type Occurrence,
} from "@retrorganizer/core";
import { useEvents } from "./useEvents";
import { MonthView } from "./MonthView";
import { AgendaView } from "./AgendaView";
import { TimeGridView } from "./TimeGridView";
import { EventForm } from "./EventForm";

type View = "month" | "week" | "day" | "agenda";

function range(view: View, anchor: number): [number, number] {
  if (view === "month") {
    const cells = monthMatrix(new Date(anchor).getFullYear(), new Date(anchor).getMonth());
    return [cells[0]!, addDays(cells[41]!, 1)];
  }
  if (view === "week") {
    const days = weekDays(anchor);
    return [days[0]!, addDays(days[6]!, 1)];
  }
  if (view === "day") {
    const sod = startOfDay(anchor);
    return [sod, addDays(sod, 1)];
  }
  const sod = startOfDay(anchor);
  return [sod, addDays(sod, 30)];
}

function shift(view: View, anchor: number, dir: number): number {
  if (view === "month") {
    const d = new Date(anchor);
    d.setMonth(d.getMonth() + dir);
    return d.getTime();
  }
  if (view === "week") return addDays(anchor, 7 * dir);
  if (view === "agenda") return addDays(anchor, 30 * dir);
  return addDays(anchor, dir);
}

export interface CalendarModuleProps {
  initialAnchor?: number;
}

export function CalendarModule({ initialAnchor }: CalendarModuleProps) {
  const { events, loading, error, create, update, remove } = useEvents();
  const [view, setView] = useState<View>("month");
  const [anchor, setAnchor] = useState<number>(initialAnchor ?? startOfDay(Date.now()));
  const [editing, setEditing] = useState<{ draft: EventDraft; id: string | null } | null>(null);

  const [rangeStart, rangeEnd] = range(view, anchor);
  const occurrences = useMemo(
    () => expandEvents(events, rangeStart, rangeEnd),
    [events, rangeStart, rangeEnd],
  );

  function newOnDay(dayStartMs: number) {
    const start = dayStartMs + 9 * 3600000;
    setEditing({ draft: { ...emptyEventDraft(), start, end: start + 3600000 }, id: null });
  }
  function openOccurrence(occ: Occurrence) {
    setEditing({ draft: draftFromEvent(occ.event), id: occ.event.id });
  }
  async function onSubmit(draft: EventDraft) {
    if (editing?.id) await update(editing.id, draft);
    else await create(draft);
    setEditing(null);
  }
  async function onImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const drafts = icsToEventDrafts(await file.text());
    for (const d of drafts) await create(d);
    e.target.value = "";
  }
  function exportICS() {
    const blob = new Blob([eventsToICS(events)], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "retrorganizer.ics"; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  const btn = (v: View, label: string) => (
    <button type="button" onClick={() => setView(v)}
      style={{ fontWeight: view === v ? "bold" : "normal" }}>{label}</button>
  );

  if (editing) {
    return (
      <div>
        <EventForm initial={editing.draft} onSubmit={onSubmit} onCancel={() => setEditing(null)} />
        {editing.id && (
          <button type="button" style={{ margin: tokens.space.md }}
            onClick={async () => { await remove(editing.id!); setEditing(null); }}>Supprimer</button>
        )}
      </div>
    );
  }

  return (
    <div style={{ font: `13px ${tokens.font.body}` }}>
      <div style={{ display: "flex", gap: tokens.space.sm, alignItems: "center", flexWrap: "wrap",
        padding: tokens.space.sm, borderBottom: `1px solid ${tokens.color.line}` }}>
        {btn("month", "Mois")}{btn("week", "Semaine")}{btn("day", "Jour")}{btn("agenda", "Agenda")}
        <span style={{ width: tokens.space.md }} />
        <button type="button" onClick={() => setAnchor(shift(view, anchor, -1))}>‹</button>
        <button type="button" onClick={() => setAnchor(initialAnchor ?? startOfDay(Date.now()))}>Aujourd'hui</button>
        <button type="button" onClick={() => setAnchor(shift(view, anchor, 1))}>›</button>
        <span style={{ flex: 1 }} />
        <button type="button" onClick={() => newOnDay(startOfDay(anchor))}>+ Nouvel événement</button>
        <button type="button" onClick={exportICS}>Exporter ICS</button>
        <label style={{ cursor: "pointer" }}>Importer ICS
          <input type="file" accept=".ics,text/calendar" aria-label="Importer ICS" onChange={onImport} style={{ display: "none" }} />
        </label>
      </div>

      {error && <p role="alert" style={{ color: "#a8431f", padding: tokens.space.sm }}>{error}</p>}
      {loading ? <p style={{ padding: tokens.space.lg }}>Chargement…</p> : (
        view === "month" ? (
          <MonthView year={new Date(anchor).getFullYear()} month={new Date(anchor).getMonth()}
            occurrences={occurrences} onSelectDay={newOnDay} onSelectOccurrence={openOccurrence} />
        ) : view === "agenda" ? (
          <AgendaView occurrences={occurrences} onSelectOccurrence={openOccurrence} />
        ) : (
          <TimeGridView days={view === "day" ? [startOfDay(anchor)] : weekDays(anchor)}
            occurrences={occurrences} onSelectOccurrence={openOccurrence} />
        )
      )}
    </div>
  );
}
```

- [ ] **Step 4: Wire the route in `apps/web/src/App.tsx`**

Add the import near the other route imports:

```tsx
import { CalendarModule } from "./calendar/CalendarModule";
```

Then update the section route element so `diary` renders the module (the `address` branch from Phase 1 stays). Replace the existing route-mapping block:

```tsx
{SECTIONS.map((s) => (
  <Route key={s.id} path={s.path}
    element={
      s.id === "address"
        ? <ContactsModule />
        : s.mvp
          ? <SectionPlaceholder label={s.label} />
          : <ComingSoon label={s.label} />
    } />
))}
```

with:

```tsx
{SECTIONS.map((s) => (
  <Route key={s.id} path={s.path}
    element={
      s.id === "diary"
        ? <CalendarModule />
        : s.id === "address"
          ? <ContactsModule />
          : s.mvp
            ? <SectionPlaceholder label={s.label} />
            : <ComingSoon label={s.label} />
    } />
))}
```

- [ ] **Step 5: Run to verify it passes**

Run: `pnpm --filter @retrorganizer/web test -- CalendarModule`
Expected: PASS — 3 tests (default month view + 4 switches; create flow; agenda switch).
Then full web suite `pnpm --filter @retrorganizer/web test` (all prior green) and `pnpm --filter @retrorganizer/web typecheck` → clean.

- [ ] **Step 6: Build verification**

Run: `pnpm build`
Expected: succeeds; `apps/web/dist` produced.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/calendar/CalendarModule.tsx apps/web/src/calendar/CalendarModule.test.tsx apps/web/src/App.tsx
git commit -m "feat(web): CalendarModule (views, nav, ICS) wired to Diary tab"
```

---

### Task 7: Backport du fix `useContacts` (web)

**Files:**
- Modify: `apps/web/src/contacts/useContacts.ts`
- Modify: `apps/web/src/contacts/useContacts.test.tsx`

**Interfaces:**
- Consumes: rien de neuf.
- Produces: `useContacts` mutations (`create`/`update`/`remove`) call `reload()` OUTSIDE their try/catch (so a reload failure no longer mislabels a successful write), and the null-user branch clears `error`. Mirrors the `useEvents` shape from Phase 2a.

**Contexte (suivi tracé en 2a) :** la revue finale de 2a a noté que `useContacts` (Phase 1) a le même motif « reload dans le try/catch » que celui corrigé dans `useEvents`. Ce task le backporte.

- [ ] **Step 1: Read the current `apps/web/src/contacts/useContacts.ts`** to confirm the pattern: each mutation currently wraps `await contactsRepo.X(...); await reload();` in a single try/catch, and the `reload` no-uid branch does `setEvents([]); setLoading(false)` without clearing error.

- [ ] **Step 2: Write the failing test — add to `apps/web/src/contacts/useContacts.test.tsx`**

Add this test inside the existing `describe("useContacts", ...)` block (keep all existing tests). It asserts that when the repo write SUCCEEDS but `reload` (the second `listByOwner`) REJECTS, the error is the load message, not the save message:

```tsx
it("surfaces a load error (not a save error) when reload fails after a successful create", async () => {
  // first load ok, create ok, reload (2nd listByOwner) rejects
  listByOwner.mockReset()
    .mockResolvedValueOnce([])
    .mockRejectedValueOnce(new Error("load failed"));
  create.mockReset().mockResolvedValue(undefined);
  const { result } = renderHook(() => useContacts());
  await waitFor(() => expect(result.current.loading).toBe(false));
  await act(async () => { await result.current.create({ displayName: "Z" } as never); });
  expect(create).toHaveBeenCalled();
  expect(result.current.error).toBe("load failed");
});
```

> Note: this relies on the existing test file's `listByOwner`/`create` mocks and `renderHook`/`act`/`waitFor` imports. If `act`/`waitFor` aren't already imported from `@testing-library/react` in this file, add them to the import.

- [ ] **Step 3: Run to verify it fails**

Run: `pnpm --filter @retrorganizer/web test -- useContacts`
Expected: FAIL — current code sets `error` to "Échec de l'enregistrement" (the create catch swallows the reload error), so the assertion `toBe("load failed")` fails.

- [ ] **Step 4: Refactor the mutations in `apps/web/src/contacts/useContacts.ts`**

Change each mutation to move `reload()` outside the try/catch, and clear error in the no-uid branch. The three mutations become:

```ts
const create = useCallback(async (d: ContactDraft) => {
  if (!uid) return;
  try { await contactsRepo.create(uid, d); }
  catch (e) { setError(e instanceof Error ? e.message : "Échec de l'enregistrement"); return; }
  await reload();
}, [uid, reload]);

const update = useCallback(async (id: string, d: ContactDraft) => {
  try { await contactsRepo.update(id, d); }
  catch (e) { setError(e instanceof Error ? e.message : "Échec de l'enregistrement"); return; }
  await reload();
}, [reload]);

const remove = useCallback(async (id: string) => {
  try { await contactsRepo.softDelete(id); }
  catch (e) { setError(e instanceof Error ? e.message : "Échec de la suppression"); return; }
  await reload();
}, [reload]);
```

And in `reload`, the no-uid branch:

```ts
if (!uid) { setContacts([]); setError(null); setLoading(false); return; }
```

- [ ] **Step 5: Run to verify it passes**

Run: `pnpm --filter @retrorganizer/web test -- useContacts`
Expected: PASS — all existing useContacts tests plus the new one.
Then full web suite `pnpm --filter @retrorganizer/web test` and `pnpm --filter @retrorganizer/web typecheck` → clean.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/contacts/useContacts.ts apps/web/src/contacts/useContacts.test.tsx
git commit -m "fix(web): reload outside mutation try/catch in useContacts (backport)"
```

---

## Définition de « terminé » pour la Phase 2b

- `pnpm exec firebase emulators:exec --only auth,firestore "pnpm test"` : tous les tests verts, incluant les nouvelles suites core (**calendarGrid**) et web (**EventForm, MonthView, AgendaView, TimeGridView, CalendarModule**) et le test de régression **useContacts**.
- `pnpm --filter @retrorganizer/core typecheck` et `pnpm --filter @retrorganizer/web typecheck` propres ; `pnpm build` produit `apps/web/dist`.
- L'onglet **Diary** affiche le calendrier : vues **mois / semaine / jour / agenda**, navigation ‹/Aujourd'hui/›, création/édition/suppression d'événements (récurrence, rappel, liens contact), et import/export **ICS**.

À l'issue de la Phase 2b, la Phase 2 (Calendrier) du MVP 1 est complète. Étape suivante : **Phase 3 — Tâches** (priorité, échéance, sous-étapes, récurrence, liens contact/événement), qui réactivera aussi le champ `taskIds` des événements.
