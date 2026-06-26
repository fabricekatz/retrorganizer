# Task Reminders Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tasks with a due date can fire in-app reminders ahead of the deadline, the same way events already do — chosen via a "Rappel" field on the task form, surfaced through the existing reminder host.

**Architecture:** Mirror the event reminder model. Add `reminderOffsets: number[]` (minutes before the due date) to the Task domain. A new core function `computeDueTaskReminders(tasks, from, to)` produces the same `ReminderHit` shape as `computeDueReminders`, with `type: "task"`. The web `useReminders` hook loads tasks alongside events and merges both reminder streams; `ReminderHost` and the desktop `Notification` differentiate task vs event. The task form gets a day-based "Rappel" select (task due dates are date-only / local midnight, so presets are day-based, unlike the event form's minute-based ones).

**Tech Stack:** TypeScript (strict) + zod, React 18, Vitest + @testing-library/react (jsdom).

## Global Constraints

- TypeScript strict with `noUncheckedIndexedAccess`. Domain types are `z.infer<typeof schema>` — NO `& BaseEntity`, NO `as` casts in production code (test fixtures may cast).
- `packages/core` stays platform-agnostic. Reuse the existing `ReminderHit`/`reminderKey` primitives; do not duplicate them.
- Adding `reminderOffsets` to the Task type makes it a required field on the inferred `Task` type. Every `Task` (and `TaskDraft`) object literal in tests must gain `reminderOffsets: []` or the build breaks. Fixing those fixtures is part of Task 1 — the tree must be green (core AND web typecheck) at the end of Task 1.
- Match existing patterns: the event reminder `set("reminderOffsets", …)` select in `EventForm.tsx`, the `useReminders` ref/interval pattern, and the `ReminderHost` toast markup.
- Do not change the event reminder behavior, the recurrence engine, or the repositories.

---

### Task 1: Task domain — `reminderOffsets` field

**Files:**
- Modify: `packages/core/src/domain/task.ts`
- Test: `packages/core/src/domain/task.test.ts`
- Fix fixtures (add `reminderOffsets: []` to every `Task` literal the compiler flags): `apps/web/src/tasks/useTasks.test.tsx`, `apps/web/src/tasks/TasksModule.test.tsx`, `apps/web/src/tasks/TaskList.test.tsx`, `apps/web/src/trash/useTrash.test.tsx` (and any other the typecheck flags).

**Interfaces:**
- Produces: `Task` and `TaskDraft` gain `reminderOffsets: number[]`. `emptyTaskDraft()` returns `reminderOffsets: []`. `draftFromTask` copies it. Tasks 2–4 rely on `task.reminderOffsets`.

- [ ] **Step 1: Write the failing test**

Add to `packages/core/src/domain/task.test.ts` (keep existing tests):

```ts
import { parseTask, emptyTaskDraft, draftFromTask } from "./task";
// (if these imports already exist at the top, don't duplicate them)

describe("task reminderOffsets", () => {
  it("defaults reminderOffsets to [] when parsing", () => {
    const t = parseTask({ id: "t1", ownerId: "u1", createdAt: 1, updatedAt: 1, deletedAt: null, title: "X" });
    expect(t.reminderOffsets).toEqual([]);
  });

  it("emptyTaskDraft and draftFromTask carry reminderOffsets", () => {
    expect(emptyTaskDraft().reminderOffsets).toEqual([]);
    const t = parseTask({ id: "t2", ownerId: "u1", createdAt: 1, updatedAt: 1, deletedAt: null, title: "Y", reminderOffsets: [1440] });
    expect(draftFromTask(t).reminderOffsets).toEqual([1440]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @retrorganizer/core test -- task.test`
Expected: FAIL — `reminderOffsets` is `undefined` / not on the type.

- [ ] **Step 3: Implement in `packages/core/src/domain/task.ts`**

Add to `taskSchema` (after `tags`):

```ts
  reminderOffsets: z.array(z.number()).default([]),
```

Add to the `TaskDraft` interface (after `tags: string[];`):

```ts
  reminderOffsets: number[];
```

Add to `emptyTaskDraft()`'s returned object (after `tags: []`):

```ts
    reminderOffsets: [],
```

Add to `draftFromTask()`'s returned object (after `tags: [...t.tags]`):

```ts
    reminderOffsets: [...t.reminderOffsets],
```

- [ ] **Step 4: Run the core test to verify it passes**

Run: `pnpm --filter @retrorganizer/core test -- task.test`
Expected: PASS.

- [ ] **Step 5: Fix fixtures across the repo**

Run the full typecheck to find every Task literal now missing the field:

Run: `pnpm typecheck`
For each error of the form "Property 'reminderOffsets' is missing in type … Task", open that file and add `reminderOffsets: []` to the offending `Task` object literal (next to its `tags: []`). Do NOT touch objects passed to `parseTask(...)` — those take defaults and won't error. Re-run `pnpm typecheck` until clean.

- [ ] **Step 6: Run the affected web test files to confirm still green**

Run: `pnpm --filter @retrorganizer/web test -- tasks/ trash/`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/domain/task.ts packages/core/src/domain/task.test.ts apps/web/src/tasks apps/web/src/trash
git commit -m "feat(core): add reminderOffsets to the Task model"
```

---

### Task 2: `computeDueTaskReminders`

**Files:**
- Modify: `packages/core/src/reminders/dueReminders.ts`
- Test: `packages/core/src/reminders/dueReminders.test.ts`

**Interfaces:**
- Consumes: `Task` (with `reminderOffsets`, `dueDate`, `status`).
- Produces: `ReminderHit.type` becomes `"event" | "task"`. New `computeDueTaskReminders(tasks: Task[], fromMs: number, toMs: number): ReminderHit[]` — for each task with a non-null `dueDate` and `status !== "done"`, emits a hit at `dueDate - offset*60000` for each offset that falls in `(fromMs, toMs]`. Task 4 imports it.

- [ ] **Step 1: Write the failing test**

Add to `packages/core/src/reminders/dueReminders.test.ts` (keep existing event tests; add the import for `computeDueTaskReminders`, `parseTask`, `Task`):

```ts
import { computeDueTaskReminders } from "./dueReminders";
import { parseTask, type Task } from "../domain/task";

const DUE = Date.UTC(2026, 0, 10, 0, 0, 0); // task due (local-midnight-like instant for the test)
const DAY = 24 * 60 * 60000;

function mkTask(extra: Partial<Task> = {}): Task {
  return parseTask({ id: "t1", ownerId: "u1", createdAt: 1, updatedAt: 1, deletedAt: null, title: "Rapport", dueDate: DUE, ...extra });
}

describe("computeDueTaskReminders", () => {
  it("fires offset minutes before the due date, inside the window", () => {
    const t = mkTask({ reminderOffsets: [1440] }); // 1 day before
    const hits = computeDueTaskReminders([t], DUE - DAY - 1, DUE - DAY);
    expect(hits).toHaveLength(1);
    expect(hits[0]!.type).toBe("task");
    expect(hits[0]!.fireAt).toBe(DUE - DAY);
    expect(hits[0]!.entityId).toBe("t1");
    expect(hits[0]!.occurrenceStart).toBe(DUE);
  });

  it("ignores tasks with no due date, no offsets, or status done", () => {
    expect(computeDueTaskReminders([mkTask({ reminderOffsets: [] })], DUE - DAY - 1, DUE)).toEqual([]);
    expect(computeDueTaskReminders([mkTask({ dueDate: null, reminderOffsets: [1440] })], DUE - DAY - 1, DUE)).toEqual([]);
    expect(computeDueTaskReminders([mkTask({ reminderOffsets: [1440], status: "done" })], DUE - DAY - 1, DUE)).toEqual([]);
  });

  it("excludes a fire time at or before the window start", () => {
    const t = mkTask({ reminderOffsets: [1440] });
    expect(computeDueTaskReminders([t], DUE - DAY, DUE)).toEqual([]); // fireAt == fromMs → excluded
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @retrorganizer/core test -- dueReminders`
Expected: FAIL — `computeDueTaskReminders` not exported.

- [ ] **Step 3: Implement in `packages/core/src/reminders/dueReminders.ts`**

Change the `ReminderHit` `type` field:

```ts
export interface ReminderHit {
  type: "event" | "task";
  entityId: string;
  title: string;
  fireAt: number;
  occurrenceStart: number;
}
```

Add the import at the top (next to the Event import):

```ts
import type { Task } from "../domain/task";
```

Append the new function (the existing `computeDueReminders` and `reminderKey` stay unchanged):

```ts
export function computeDueTaskReminders(tasks: Task[], fromMs: number, toMs: number): ReminderHit[] {
  const hits: ReminderHit[] = [];
  for (const t of tasks) {
    if (t.dueDate === null || t.status === "done") continue;
    for (const offset of t.reminderOffsets) {
      const fireAt = t.dueDate - offset * 60000;
      if (fireAt > fromMs && fireAt <= toMs) {
        hits.push({ type: "task", entityId: t.id, title: t.title, fireAt, occurrenceStart: t.dueDate });
      }
    }
  }
  return hits.sort((a, b) => a.fireAt - b.fireAt);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @retrorganizer/core test -- dueReminders`
Expected: PASS (existing event tests + new task tests).

- [ ] **Step 5: Typecheck + commit**

Run: `pnpm --filter @retrorganizer/core typecheck` (expect clean).

```bash
git add packages/core/src/reminders/dueReminders.ts packages/core/src/reminders/dueReminders.test.ts
git commit -m "feat(core): computeDueTaskReminders for task due dates"
```

---

### Task 3: Task form "Rappel" field

**Files:**
- Modify: `apps/web/src/tasks/TaskForm.tsx`
- Test: `apps/web/src/tasks/TaskForm.test.tsx`

**Interfaces:**
- Consumes: `TaskDraft.reminderOffsets` (Task 1).
- Produces: a "Rappel" `<select aria-label="Rappel">` that writes `reminderOffsets` (`[]` for "Aucun", else `[value]`).

- [ ] **Step 1: Read the existing form test**

Run: `sed -n '1,60p' apps/web/src/tasks/TaskForm.test.tsx` to learn how it renders the form and submits. Note whether it asserts the full submitted draft (it should assert individual fields; `reminderOffsets: []` from `emptyTaskDraft` will already be on the submitted draft after Task 1, so existing assertions should be unaffected).

- [ ] **Step 2: Write the failing test**

Add a test asserting the select updates `reminderOffsets` on submit. Mirror the file's existing render/submit helper. Example (adapt prop names to the file's pattern):

```tsx
  it("sets a task reminder offset", () => {
    const onSubmit = vi.fn();
    render(<TaskForm onSubmit={onSubmit} onCancel={() => {}} />);
    fireEvent.change(screen.getByLabelText("Titre"), { target: { value: "Payer loyer" } });
    fireEvent.change(screen.getByLabelText("Rappel"), { target: { value: "1440" } });
    fireEvent.submit(screen.getByLabelText("Titre").closest("form")!);
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0]![0].reminderOffsets).toEqual([1440]);
  });
```

(If the file submits via a "Enregistrer" button instead of form submit, click that instead — match the existing tests.)

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter @retrorganizer/web test -- tasks/TaskForm`
Expected: FAIL — no "Rappel" control yet.

- [ ] **Step 4: Implement in `apps/web/src/tasks/TaskForm.tsx`**

Add the presets constant near the other constants (`PRIORITIES`, `STATUSES`, `RECUR`):

```tsx
const TASK_REMINDER_PRESETS: { label: string; value: number }[] = [
  { label: "Aucun", value: -1 },
  { label: "Le jour même", value: 0 },
  { label: "1 jour avant", value: 1440 },
  { label: "2 jours avant", value: 2880 },
  { label: "1 semaine avant", value: 10080 },
];
```

Add a "Rappel" field in the form, right after the "Échéance" `<label>` block (mirrors the EventForm pattern — single offset stored in a one-element array):

```tsx
      <label>Rappel
        <select aria-label="Rappel" value={draft.reminderOffsets[0] ?? -1}
          onChange={(e) => set("reminderOffsets", Number(e.target.value) < 0 ? [] : [Number(e.target.value)])}
          style={{ display: "block" }}>
          {TASK_REMINDER_PRESETS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
      </label>
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @retrorganizer/web test -- tasks/TaskForm`
Expected: PASS (existing tests + new one).

- [ ] **Step 6: Typecheck + commit**

Run: `pnpm --filter @retrorganizer/web typecheck` (expect clean).

```bash
git add apps/web/src/tasks/TaskForm.tsx apps/web/src/tasks/TaskForm.test.tsx
git commit -m "feat(web): task reminder (Rappel) field on the task form"
```

---

### Task 4: Merge task reminders into the host

**Files:**
- Modify: `apps/web/src/reminders/useReminders.ts`
- Modify: `apps/web/src/reminders/ReminderHost.tsx`
- Test: `apps/web/src/reminders/useReminders.test.tsx`, `apps/web/src/reminders/ReminderHost.test.tsx`

**Interfaces:**
- Consumes: `computeDueTaskReminders` (Task 2), `useTasks`.
- Produces: `useReminders` merges event + task hits; `ReminderHost` shows a task-specific label.

- [ ] **Step 1: Read both existing tests**

Run: `sed -n '1,80p' apps/web/src/reminders/useReminders.test.tsx` and `sed -n '1,60p' apps/web/src/reminders/ReminderHost.test.tsx`. Note how `useReminders.test` mocks `@retrorganizer/core` (it stubs `computeDueReminders`/`reminderKey`) and `../calendar/useEvents`, and uses fake timers + a `Notification` stub. You will add a `useTasks` mock and a `computeDueTaskReminders` stub the same way. Note how `ReminderHost.test` mocks `./useReminders`.

- [ ] **Step 2: Write failing tests**

In `useReminders.test.tsx`: add `../tasks/useTasks` to the mocks (`vi.mock("../tasks/useTasks", () => ({ useTasks: () => ({ tasks: mockTasks }) }))`), add `computeDueTaskReminders` to the `@retrorganizer/core` mock returning a task hit when advanced, and assert the merged `due` array contains the task hit after the timer fires. Mirror the existing event-hit test exactly, swapping in the task stub.

In `ReminderHost.test.tsx`: add a test that, with `useReminders` mocked to return a single hit of `type: "task"`, asserts the toast shows the task label `"Rappel de tâche"` (and the title).

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm --filter @retrorganizer/web test -- reminders/`
Expected: FAIL — task hits not merged; no task label.

- [ ] **Step 4: Implement `useReminders.ts`**

Update the import and add the tasks source + merge. Change the import line:

```ts
import { computeDueReminders, computeDueTaskReminders, reminderKey, type ReminderHit } from "@retrorganizer/core";
import { useEvents } from "../calendar/useEvents";
import { useTasks } from "../tasks/useTasks";
```

Inside the hook, after the events ref, add a tasks ref:

```ts
  const { tasks } = useTasks();
  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;
```

In the interval body, replace the single `computeDueReminders(...)` call so both are merged:

```ts
      const hits = [
        ...computeDueReminders(eventsRef.current, lastCheck.current, now),
        ...computeDueTaskReminders(tasksRef.current, lastCheck.current, now),
      ];
```

And make the desktop notification body type-aware:

```ts
        for (const h of hits) {
          new Notification(h.title, { body: h.type === "task" ? "Rappel de tâche" : "Rappel d'événement" });
        }
```

- [ ] **Step 5: Implement `ReminderHost.tsx`**

Make the toast label type-aware. Replace the label span:

```tsx
          <span><strong>{item.type === "task" ? "Rappel de tâche" : "Rappel"}</strong> — <span>{item.title}</span></span>
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `pnpm --filter @retrorganizer/web test -- reminders/`
Expected: PASS.

- [ ] **Step 7: Typecheck + commit**

Run: `pnpm --filter @retrorganizer/web typecheck` (expect clean).

```bash
git add apps/web/src/reminders/useReminders.ts apps/web/src/reminders/ReminderHost.tsx apps/web/src/reminders/useReminders.test.tsx apps/web/src/reminders/ReminderHost.test.tsx
git commit -m "feat(web): fire and display task reminders alongside events"
```

---

## Final verification (whole branch)

- [ ] Full suite under the emulator (Java on PATH): `pnpm exec firebase emulators:exec --only auth,firestore "pnpm test"` — expect core (+ task/dueReminders tests) and web green.
- [ ] `pnpm --filter @retrorganizer/web build` succeeds.
- [ ] Sanity: the reminder fires off `dueDate` (local midnight). A "Le jour même" (offset 0) reminder fires at the start of the due day; "1 jour avant" the day before — confirm this matches the intent in the final review.
