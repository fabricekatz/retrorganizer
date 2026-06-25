# Retrorganizer — Phase 3 : Tâches — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Livrer le module Tâches : modèle `Task` (priorité, échéance, statut, sous-étapes, récurrence), `tasksRepo`, filtres/tri, hook `useTasks`, formulaire (avec liens contact/événement), liste filtrable avec complétion, et `TasksModule` — branché sur l'onglet ToDo. Les tâches terminées sont historisées ; une tâche récurrente avance son échéance à la complétion.

**Architecture:** La logique pure (modèle/draft, filtres/tri, avance de récurrence) vit dans `packages/core` (réutilisable RN). `apps/web/src/tasks/` consomme `tasksRepo` via `useTasks` et réutilise les patterns des modules Contacts/Calendrier (hook, form, list, module). Le lien tâche↔événement est stocké côté tâche (`eventId`, source de vérité unique).

**Tech Stack:** TypeScript strict, zod, `rrule` (déjà là, pour l'avance de récurrence), Firestore via `createRepository`, React + Vitest + @testing-library/react. Réutilise `useContacts` (sélecteur de contacts) et `useEvents` (sélecteur d'événement).

## Global Constraints

- Produit : **Retrorganizer**. TypeScript **strict** (noUncheckedIndexedAccess ON) — dans les TESTS, `const [x] = arr` → `const x = arr[0]!` ; `.mock.calls[0][0]` → `.mock.calls[0]![0] as <Type>` ; ne jamais affaiblir le code de production.
- Aucune app ne parle directement à Firestore — uniquement via `@retrorganizer/core` (`tasksRepo`/`getFirebase`).
- **Tâches terminées historisées** : compléter une tâche met `status: "done"` + `completedAt`, sans soft-delete. `listByOwner` exclut seulement les `deletedAt`.
- **Lien tâche↔événement** : stocké côté tâche (`eventId: string | null`), source de vérité unique — on n'écrit PAS dans `event.taskIds` depuis la tâche (évite la double-écriture divergente). Lien tâche↔contact via `contactIds`.
- **Récurrence** : compléter une tâche récurrente (recurrence non null + dueDate) **avance** `dueDate` à la prochaine occurrence et remet `status: "todo"` (pattern « todo récurrent »), au lieu de la marquer done.
- Dates en **millisecondes epoch UTC** ; `recurrence` = chaîne RRULE nue (`"FREQ=WEEKLY"`) ou null.
- Couleur d'accent du module ToDo : `moduleAccent.todo` (`@retrorganizer/ui`).
- Réutiliser : `BaseEntity`, `createRepository`, `rrulestr` (via le helper interne de `recurrence.ts`), `tokens`/`moduleAccent`, `useContacts`, `useEvents`.
- Tests sur filtres/récurrence obligatoires (spec §12.4).
- Commits fréquents, un par tâche minimum.

## Interfaces héritées (à consommer, ne pas redéfinir)

Depuis `@retrorganizer/core` :
- `BaseEntity`, `createRepository<T>(name, parse)` (create/get/update/softDelete/listByOwner)
- `recurrence.ts` exporte déjà `expandEvents`/`expandEvent` et un helper interne `toICalUtc(ms)` (non exporté — `nextOccurrenceAfter` est AJOUTÉ dans ce même fichier en Task 2 pour le réutiliser)
- `Event` (pour le sélecteur d'événement), `Contact` (pour le sélecteur de contact)

Depuis `apps/web` : `useContacts()` (→ `{ contacts }`), `useEvents()` (→ `{ events }`).
Depuis `@retrorganizer/ui` : `tokens`, `moduleAccent`.

---

### Task 1: Modèle `Task` + `TaskDraft` + `tasksRepo` (core)

**Files:**
- Create: `packages/core/src/domain/task.ts`
- Create: `packages/core/src/repositories/tasks.ts`
- Modify: `packages/core/src/index.ts` (exporter task + tasks repo)
- Test: `packages/core/src/domain/task.test.ts`

**Interfaces:**
- Consumes: `BaseEntity`, `createRepository` (Phase 0).
- Produces:
  - `Subtask` = `{ title: string; done: boolean }`
  - `TaskPriority` = `"low" | "normal" | "high"`, `TaskStatus` = `"todo" | "in_progress" | "done"`
  - `Task` = `BaseEntity & { title: string; description: string; priority: TaskPriority; dueDate: number | null; status: TaskStatus; completedAt: number | null; subtasks: Subtask[]; recurrence: string | null; contactIds: string[]; eventId: string | null; categoryId: string | null; tags: string[] }`
  - `parseTask(input: unknown): Task` (zod parse; `title` min 1; defaults for the rest).
  - `TaskDraft` = editable content fields; `emptyTaskDraft(): TaskDraft`; `draftFromTask(t: Task): TaskDraft` (deep-copies arrays).
  - `tasksRepo`: `Repository<Task>` = `createRepository<Task>("tasks", parseTask)`.

- [ ] **Step 1: Write the failing test — `packages/core/src/domain/task.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { parseTask, emptyTaskDraft, draftFromTask } from "./task";

describe("parseTask", () => {
  it("accepts a minimal task and defaults fields", () => {
    const t = parseTask({
      id: "t1", ownerId: "u1", createdAt: 1, updatedAt: 1, deletedAt: null, title: "Acheter du pain",
    });
    expect(t.title).toBe("Acheter du pain");
    expect(t.priority).toBe("normal");
    expect(t.status).toBe("todo");
    expect(t.dueDate).toBeNull();
    expect(t.completedAt).toBeNull();
    expect(t.subtasks).toEqual([]);
    expect(t.eventId).toBeNull();
    expect(t.contactIds).toEqual([]);
  });

  it("rejects a task without a title", () => {
    expect(() => parseTask({
      id: "t1", ownerId: "u1", createdAt: 1, updatedAt: 1, deletedAt: null, title: "",
    })).toThrow();
  });

  it("rejects an invalid priority", () => {
    expect(() => parseTask({
      id: "t1", ownerId: "u1", createdAt: 1, updatedAt: 1, deletedAt: null, title: "X", priority: "urgent",
    })).toThrow();
  });
});

describe("task drafts", () => {
  it("emptyTaskDraft has neutral defaults", () => {
    const d = emptyTaskDraft();
    expect(d.title).toBe("");
    expect(d.priority).toBe("normal");
    expect(d.status).toBe("todo");
    expect(d.dueDate).toBeNull();
    expect(d.subtasks).toEqual([]);
  });

  it("draftFromTask deep-copies arrays", () => {
    const t = parseTask({
      id: "t1", ownerId: "u1", createdAt: 1, updatedAt: 1, deletedAt: null, title: "X",
      subtasks: [{ title: "a", done: false }], contactIds: ["c1"],
    });
    const d = draftFromTask(t);
    d.subtasks.push({ title: "b", done: true });
    d.contactIds.push("c2");
    expect(t.subtasks).toEqual([{ title: "a", done: false }]);
    expect(t.contactIds).toEqual(["c1"]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @retrorganizer/core test -- task.test`
Expected: FAIL — module `./task` not found.

- [ ] **Step 3: Implement `packages/core/src/domain/task.ts`**

```ts
import { z } from "zod";
import type { BaseEntity } from "./types";

export const subtaskSchema = z.object({ title: z.string(), done: z.boolean() });
export type Subtask = z.infer<typeof subtaskSchema>;

export type TaskPriority = "low" | "normal" | "high";
export type TaskStatus = "todo" | "in_progress" | "done";

export const taskSchema = z.object({
  id: z.string(),
  ownerId: z.string().min(1),
  createdAt: z.number(),
  updatedAt: z.number(),
  deletedAt: z.number().nullable(),
  title: z.string().min(1),
  description: z.string().default(""),
  priority: z.enum(["low", "normal", "high"]).default("normal"),
  dueDate: z.number().nullable().default(null),
  status: z.enum(["todo", "in_progress", "done"]).default("todo"),
  completedAt: z.number().nullable().default(null),
  subtasks: z.array(subtaskSchema).default([]),
  recurrence: z.string().nullable().default(null),
  contactIds: z.array(z.string()).default([]),
  eventId: z.string().nullable().default(null),
  categoryId: z.string().nullable().default(null),
  tags: z.array(z.string()).default([]),
});

export type Task = z.infer<typeof taskSchema>;

export function parseTask(input: unknown): Task {
  return taskSchema.parse(input);
}

export interface TaskDraft {
  title: string;
  description: string;
  priority: TaskPriority;
  dueDate: number | null;
  status: TaskStatus;
  completedAt: number | null;
  subtasks: Subtask[];
  recurrence: string | null;
  contactIds: string[];
  eventId: string | null;
  categoryId: string | null;
  tags: string[];
}

export function emptyTaskDraft(): TaskDraft {
  return {
    title: "", description: "", priority: "normal", dueDate: null, status: "todo",
    completedAt: null, subtasks: [], recurrence: null, contactIds: [], eventId: null,
    categoryId: null, tags: [],
  };
}

export function draftFromTask(t: Task): TaskDraft {
  return {
    title: t.title, description: t.description, priority: t.priority, dueDate: t.dueDate,
    status: t.status, completedAt: t.completedAt,
    subtasks: t.subtasks.map((s) => ({ ...s })),
    recurrence: t.recurrence, contactIds: [...t.contactIds], eventId: t.eventId,
    categoryId: t.categoryId, tags: [...t.tags],
  };
}
```

- [ ] **Step 4: Implement `packages/core/src/repositories/tasks.ts`**

```ts
import { createRepository } from "./base";
import { parseTask, type Task } from "../domain/task";

export const tasksRepo = createRepository<Task>("tasks", parseTask);
```

- [ ] **Step 5: Export from `packages/core/src/index.ts`** — add:

```ts
export * from "./domain/task";
export * from "./repositories/tasks";
```

- [ ] **Step 6: Run to verify it passes**

Run: `pnpm --filter @retrorganizer/core test -- task.test`
Expected: PASS — 5 tests. Then `pnpm --filter @retrorganizer/core typecheck` → clean.

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/domain/task.ts packages/core/src/domain/task.test.ts packages/core/src/repositories/tasks.ts packages/core/src/index.ts
git commit -m "feat(core): Task model (priority/status/subtasks/recurrence), tasksRepo"
```

---

### Task 2: Filtres/tri des tâches + `nextOccurrenceAfter` (core)

**Files:**
- Create: `packages/core/src/domain/taskQuery.ts`
- Modify: `packages/core/src/domain/recurrence.ts` (add `nextOccurrenceAfter`)
- Modify: `packages/core/src/index.ts` (exporter taskQuery)
- Test: `packages/core/src/domain/taskQuery.test.ts`
- Test: `packages/core/src/domain/recurrenceNext.test.ts`

**Interfaces:**
- Consumes: `Task` (Task 1); `rrulestr` + the internal `toICalUtc` already in `recurrence.ts`.
- Produces:
  - `filterTasks(tasks: Task[], opts: { status?: TaskStatus | "all"; search?: string }): Task[]` — `status` "all"/undefined → no status filter; otherwise keep matching `status`. `search` → case-insensitive substring over title + description (empty → all).
  - `sortTasks(tasks: Task[], key: "priority" | "dueDate" | "title"): Task[]` — NEW array; `priority` high→normal→low (high first); `dueDate` ascending with nulls last; `title` locale case-insensitive. Stable copy.
  - `nextOccurrenceAfter(recurrence: string, afterMs: number): number | null` (in `recurrence.ts`) — first RRULE occurrence strictly after `afterMs` (anchored at `afterMs`), or null.

- [ ] **Step 1: Write the failing test — `packages/core/src/domain/taskQuery.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { filterTasks, sortTasks } from "./taskQuery";
import { parseTask, type Task } from "./task";

function mk(id: string, extra: Partial<Task> = {}): Task {
  return parseTask({ id, ownerId: "u1", createdAt: 1, updatedAt: 1, deletedAt: null, title: id, ...extra });
}

describe("filterTasks", () => {
  const tasks = [
    mk("a", { status: "todo", title: "Acheter pain" }),
    mk("b", { status: "done", title: "Payer facture" }),
  ];
  it("returns all for status 'all'", () => {
    expect(filterTasks(tasks, { status: "all" }).map((t) => t.id)).toEqual(["a", "b"]);
  });
  it("filters by status", () => {
    expect(filterTasks(tasks, { status: "done" }).map((t) => t.id)).toEqual(["b"]);
  });
  it("filters by search over title/description", () => {
    expect(filterTasks(tasks, { search: "pain" }).map((t) => t.id)).toEqual(["a"]);
  });
});

describe("sortTasks", () => {
  it("sorts by priority high first without mutating input", () => {
    const tasks = [mk("a", { priority: "low" }), mk("b", { priority: "high" }), mk("c", { priority: "normal" })];
    const sorted = sortTasks(tasks, "priority");
    expect(sorted.map((t) => t.id)).toEqual(["b", "c", "a"]);
    expect(tasks.map((t) => t.id)).toEqual(["a", "b", "c"]);
  });
  it("sorts by dueDate ascending with nulls last", () => {
    const tasks = [mk("a", { dueDate: null }), mk("b", { dueDate: 200 }), mk("c", { dueDate: 100 })];
    expect(sortTasks(tasks, "dueDate").map((t) => t.id)).toEqual(["c", "b", "a"]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @retrorganizer/core test -- taskQuery`
Expected: FAIL — module `./taskQuery` not found.

- [ ] **Step 3: Implement `packages/core/src/domain/taskQuery.ts`**

```ts
import type { Task, TaskStatus, TaskPriority } from "./task";

const PRIORITY_RANK: Record<TaskPriority, number> = { high: 0, normal: 1, low: 2 };

export function filterTasks(tasks: Task[], opts: { status?: TaskStatus | "all"; search?: string }): Task[] {
  const needle = (opts.search ?? "").trim().toLowerCase();
  return tasks.filter((t) => {
    if (opts.status && opts.status !== "all" && t.status !== opts.status) return false;
    if (needle !== "") {
      const hay = `${t.title} ${t.description}`.toLowerCase();
      if (!hay.includes(needle)) return false;
    }
    return true;
  });
}

export function sortTasks(tasks: Task[], key: "priority" | "dueDate" | "title"): Task[] {
  const copy = [...tasks];
  copy.sort((a, b) => {
    if (key === "priority") return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    if (key === "dueDate") {
      if (a.dueDate === b.dueDate) return 0;
      if (a.dueDate === null) return 1;
      if (b.dueDate === null) return -1;
      return a.dueDate - b.dueDate;
    }
    return a.title.localeCompare(b.title, undefined, { sensitivity: "base" });
  });
  return copy;
}
```

- [ ] **Step 4: Write the failing test — `packages/core/src/domain/recurrenceNext.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { nextOccurrenceAfter } from "./recurrence";

const DUE = Date.UTC(2026, 0, 5, 9, 0, 0);
const DAY = 24 * 3600_000;

describe("nextOccurrenceAfter", () => {
  it("advances a daily rule by one day", () => {
    expect(nextOccurrenceAfter("FREQ=DAILY", DUE)).toBe(DUE + DAY);
  });
  it("advances a weekly rule by seven days", () => {
    expect(nextOccurrenceAfter("FREQ=WEEKLY", DUE)).toBe(DUE + 7 * DAY);
  });
  it("returns null when the rule has no future occurrence (COUNT=1)", () => {
    expect(nextOccurrenceAfter("FREQ=DAILY;COUNT=1", DUE)).toBeNull();
  });
});
```

- [ ] **Step 5: Run to verify it fails**

Run: `pnpm --filter @retrorganizer/core test -- recurrenceNext`
Expected: FAIL — `nextOccurrenceAfter` not exported.

- [ ] **Step 6: Append `nextOccurrenceAfter` to `packages/core/src/domain/recurrence.ts`**

```ts
export function nextOccurrenceAfter(recurrence: string, afterMs: number): number | null {
  const rule = rrulestr(`DTSTART:${toICalUtc(afterMs)}\nRRULE:${recurrence}`);
  const next = rule.after(new Date(afterMs), false);
  return next ? next.getTime() : null;
}
```

> Note: `toICalUtc` and `rrulestr` already exist at the top of `recurrence.ts` (used by `expandEvent`). Reuse them — do not redeclare. `rule.after(date, false)` returns the first occurrence strictly after `date`.

- [ ] **Step 7: Export from `packages/core/src/index.ts`** — add:

```ts
export * from "./domain/taskQuery";
```

(`nextOccurrenceAfter` is surfaced automatically via the existing `export * from "./domain/recurrence"`.)

- [ ] **Step 8: Run to verify both pass**

Run: `pnpm --filter @retrorganizer/core test -- taskQuery recurrenceNext`
Expected: PASS — 5 taskQuery + 3 recurrenceNext. Then `pnpm --filter @retrorganizer/core typecheck` → clean.

- [ ] **Step 9: Commit**

```bash
git add packages/core/src/domain/taskQuery.ts packages/core/src/domain/taskQuery.test.ts packages/core/src/domain/recurrence.ts packages/core/src/domain/recurrenceNext.test.ts packages/core/src/index.ts
git commit -m "feat(core): task filters/sort + nextOccurrenceAfter (recurring task advance)"
```

---

### Task 3: `useTasks` hook (web)

**Files:**
- Create: `apps/web/src/tasks/useTasks.ts`
- Test: `apps/web/src/tasks/useTasks.test.tsx`

**Interfaces:**
- Consumes: `tasksRepo`, `Task`, `TaskDraft` (core); `useAuth` (web).
- Produces:
  - `useTasks(): { tasks: Task[]; loading: boolean; error: string | null; create(d: TaskDraft): Promise<void>; update(id: string, d: Partial<Task>): Promise<void>; remove(id: string): Promise<void>; reload(): Promise<void> }`
  - Same shape/behavior as `useEvents` (Phase 2a): loads `tasksRepo.listByOwner(uid)` on mount/uid-change; mutations wrapped in try/catch that set `error`, then `reload()` OUTSIDE the try/catch; null-uid → `tasks []`, `loading false`, `error` cleared. Note `update` takes `Partial<Task>` (so the complete-toggle can patch just `status`/`dueDate`/`completedAt`).

- [ ] **Step 1: Write the failing test — `apps/web/src/tasks/useTasks.test.tsx`**

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useTasks } from "./useTasks";

const listByOwner = vi.fn();
const create = vi.fn();
const update = vi.fn();
vi.mock("@retrorganizer/core", () => ({
  tasksRepo: {
    listByOwner: (...a: unknown[]) => listByOwner(...a),
    create: (...a: unknown[]) => create(...a),
    update: (...a: unknown[]) => update(...a),
    softDelete: vi.fn(),
  },
}));
let mockUser: { uid: string; email: string } | null = { uid: "u1", email: "a@x.io" };
vi.mock("../auth/AuthProvider", () => ({ useAuth: () => ({ user: mockUser }) }));

beforeEach(() => {
  mockUser = { uid: "u1", email: "a@x.io" };
  listByOwner.mockReset().mockResolvedValue([
    { id: "t1", ownerId: "u1", title: "X", description: "", priority: "normal", dueDate: null, status: "todo", completedAt: null, subtasks: [], recurrence: null, contactIds: [], eventId: null, categoryId: null, tags: [], createdAt: 1, updatedAt: 1, deletedAt: null },
  ]);
  create.mockReset().mockResolvedValue(undefined);
  update.mockReset().mockResolvedValue(undefined);
});

describe("useTasks", () => {
  it("loads tasks on mount", async () => {
    const { result } = renderHook(() => useTasks());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(listByOwner).toHaveBeenCalledWith("u1");
    expect(result.current.tasks.map((t) => t.id)).toEqual(["t1"]);
  });

  it("update patches then reloads", async () => {
    const { result } = renderHook(() => useTasks());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.update("t1", { status: "done" }); });
    expect(update).toHaveBeenCalledWith("t1", { status: "done" });
    expect(listByOwner).toHaveBeenCalledTimes(2);
  });

  it("returns empty/not-loading with no user", async () => {
    mockUser = null;
    const { result } = renderHook(() => useTasks());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.tasks).toEqual([]);
    expect(listByOwner).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @retrorganizer/web test -- useTasks`
Expected: FAIL — module `./useTasks` not found.

- [ ] **Step 3: Implement `apps/web/src/tasks/useTasks.ts`**

```ts
import { useCallback, useEffect, useState } from "react";
import { tasksRepo, type Task, type TaskDraft } from "@retrorganizer/core";
import { useAuth } from "../auth/AuthProvider";

export interface UseTasks {
  tasks: Task[];
  loading: boolean;
  error: string | null;
  create(d: TaskDraft): Promise<void>;
  update(id: string, patch: Partial<Task>): Promise<void>;
  remove(id: string): Promise<void>;
  reload(): Promise<void>;
}

export function useTasks(): UseTasks {
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!uid) { setTasks([]); setError(null); setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      setTasks(await tasksRepo.listByOwner(uid));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Échec du chargement");
    } finally {
      setLoading(false);
    }
  }, [uid]);

  useEffect(() => { void reload(); }, [reload]);

  const create = useCallback(async (d: TaskDraft) => {
    if (!uid) return;
    try { await tasksRepo.create(uid, d); }
    catch (e) { setError(e instanceof Error ? e.message : "Échec de l'enregistrement"); return; }
    await reload();
  }, [uid, reload]);

  const update = useCallback(async (id: string, patch: Partial<Task>) => {
    try { await tasksRepo.update(id, patch); }
    catch (e) { setError(e instanceof Error ? e.message : "Échec de l'enregistrement"); return; }
    await reload();
  }, [reload]);

  const remove = useCallback(async (id: string) => {
    try { await tasksRepo.softDelete(id); }
    catch (e) { setError(e instanceof Error ? e.message : "Échec de la suppression"); return; }
    await reload();
  }, [reload]);

  return { tasks, loading, error, create, update, remove, reload };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter @retrorganizer/web test -- useTasks`
Expected: PASS — 3 tests. Then full web suite + `pnpm --filter @retrorganizer/web typecheck` → clean.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/tasks/useTasks.ts apps/web/src/tasks/useTasks.test.tsx
git commit -m "feat(web): useTasks hook over tasksRepo (Partial patch update)"
```

---

### Task 4: `SubtaskField` + `TaskForm` (web)

**Files:**
- Create: `apps/web/src/tasks/SubtaskField.tsx`
- Create: `apps/web/src/tasks/TaskForm.tsx`
- Test: `apps/web/src/tasks/TaskForm.test.tsx`

**Interfaces:**
- Consumes: `tokens` (ui); `TaskDraft`, `emptyTaskDraft`, `type Subtask` (core); `useContacts`, `useEvents` (web); `toDateInput`/`fromDateInput` (`../calendar/datetime`).
- Produces:
  - `SubtaskField`: `<SubtaskField rows onChange />` where `rows: Subtask[]`; each row a `done` checkbox + title input + remove; add button `+ Sous-étape`. aria-labels: `Sous-étape titre {i+1}`, `Sous-étape faite {i+1}`.
  - `TaskForm`: `<TaskForm initial?={TaskDraft} onSubmit onCancel />` — controlled form over a `TaskDraft`. Fields: title (required), description, priority `<select>` (basse/normale/haute → low/normal/high), due date (`date` input, optional → dueDate ms|null), status `<select>` (à faire/en cours/terminé), `SubtaskField`, recurrence `<select>` (reuse `EVENT_RECUR_PRESETS`-style: Aucune/Quotidienne/Hebdo/Mensuelle), an event `<select>` (Aucun + one option per `useEvents().events` by title → eventId|null), and contact link checkboxes (`useContacts().contacts`). Submit calls `onSubmit(draft)`; button "Enregistrer".

- [ ] **Step 1: Write the failing test — `apps/web/src/tasks/TaskForm.test.tsx`**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TaskForm } from "./TaskForm";
import type { TaskDraft } from "@retrorganizer/core";

vi.mock("../contacts/useContacts", () => ({
  useContacts: () => ({ contacts: [{ id: "c1", displayName: "Ada Lovelace" }], loading: false }),
}));
vi.mock("../calendar/useEvents", () => ({
  useEvents: () => ({ events: [{ id: "e1", title: "Réunion" }], loading: false }),
}));

describe("TaskForm", () => {
  it("submits a draft with priority, due date, a subtask, and an event link", () => {
    const onSubmit = vi.fn();
    render(<TaskForm onSubmit={onSubmit} onCancel={() => {}} />);
    fireEvent.change(screen.getByLabelText("Titre"), { target: { value: "Préparer le slide" } });
    fireEvent.change(screen.getByLabelText("Priorité"), { target: { value: "high" } });
    fireEvent.change(screen.getByLabelText("Échéance"), { target: { value: "2026-01-10" } });
    fireEvent.click(screen.getByRole("button", { name: "+ Sous-étape" }));
    fireEvent.change(screen.getByLabelText("Sous-étape titre 1"), { target: { value: "Plan" } });
    fireEvent.change(screen.getByLabelText("Événement lié"), { target: { value: "e1" } });
    fireEvent.click(screen.getByLabelText("Ada Lovelace"));
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const d = onSubmit.mock.calls[0]![0] as TaskDraft;
    expect(d.title).toBe("Préparer le slide");
    expect(d.priority).toBe("high");
    expect(d.dueDate).toBe(new Date(2026, 0, 10).getTime());
    expect(d.subtasks).toEqual([{ title: "Plan", done: false }]);
    expect(d.eventId).toBe("e1");
    expect(d.contactIds).toEqual(["c1"]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @retrorganizer/web test -- TaskForm`
Expected: FAIL — module `./TaskForm` not found.

- [ ] **Step 3: Implement `apps/web/src/tasks/SubtaskField.tsx`**

```tsx
import { tokens } from "@retrorganizer/ui";
import type { Subtask } from "@retrorganizer/core";

export interface SubtaskFieldProps {
  rows: Subtask[];
  onChange(rows: Subtask[]): void;
}

export function SubtaskField({ rows, onChange }: SubtaskFieldProps) {
  function update(i: number, patch: Partial<Subtask>) {
    onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  }
  function add() { onChange([...rows, { title: "", done: false }]); }
  function removeAt(i: number) { onChange(rows.filter((_, j) => j !== i)); }

  return (
    <fieldset style={{ border: `1px solid ${tokens.color.line}`, marginBottom: tokens.space.sm }}>
      <legend>Sous-étapes</legend>
      {rows.map((r, i) => (
        <div key={i} style={{ display: "flex", gap: tokens.space.xs, marginBottom: tokens.space.xs }}>
          <input type="checkbox" aria-label={`Sous-étape faite ${i + 1}`} checked={r.done}
            onChange={(e) => update(i, { done: e.target.checked })} />
          <input aria-label={`Sous-étape titre ${i + 1}`} value={r.title} placeholder="sous-étape"
            onChange={(e) => update(i, { title: e.target.value })} style={{ flex: 1 }} />
          <button type="button" aria-label={`Supprimer sous-étape ${i + 1}`} onClick={() => removeAt(i)}>×</button>
        </div>
      ))}
      <button type="button" onClick={add}>+ Sous-étape</button>
    </fieldset>
  );
}
```

- [ ] **Step 4: Implement `apps/web/src/tasks/TaskForm.tsx`**

```tsx
import { useState } from "react";
import { tokens } from "@retrorganizer/ui";
import { emptyTaskDraft, type TaskDraft } from "@retrorganizer/core";
import { useContacts } from "../contacts/useContacts";
import { useEvents } from "../calendar/useEvents";
import { toDateInput, fromDateInput } from "../calendar/datetime";
import { SubtaskField } from "./SubtaskField";

const PRIORITIES: { label: string; value: TaskDraft["priority"] }[] = [
  { label: "Basse", value: "low" }, { label: "Normale", value: "normal" }, { label: "Haute", value: "high" },
];
const STATUSES: { label: string; value: TaskDraft["status"] }[] = [
  { label: "À faire", value: "todo" }, { label: "En cours", value: "in_progress" }, { label: "Terminé", value: "done" },
];
const RECUR: { label: string; value: string }[] = [
  { label: "Aucune", value: "" }, { label: "Tous les jours", value: "FREQ=DAILY" },
  { label: "Toutes les semaines", value: "FREQ=WEEKLY" }, { label: "Tous les mois", value: "FREQ=MONTHLY" },
];

export interface TaskFormProps {
  initial?: TaskDraft;
  onSubmit(draft: TaskDraft): void;
  onCancel(): void;
}

export function TaskForm({ initial, onSubmit, onCancel }: TaskFormProps) {
  const [draft, setDraft] = useState<TaskDraft>(initial ?? emptyTaskDraft());
  const { contacts } = useContacts();
  const { events } = useEvents();

  function set<K extends keyof TaskDraft>(key: K, value: TaskDraft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }
  function submit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit(draft);
  }

  return (
    <form onSubmit={submit} style={{ padding: tokens.space.md, font: `13px ${tokens.font.body}`, display: "grid", gap: tokens.space.sm }}>
      <label>Titre
        <input aria-label="Titre" value={draft.title} onChange={(e) => set("title", e.target.value)}
          style={{ display: "block", width: "100%" }} />
      </label>
      <label>Description
        <textarea aria-label="Description" value={draft.description} onChange={(e) => set("description", e.target.value)}
          style={{ display: "block", width: "100%" }} />
      </label>
      <label>Priorité
        <select aria-label="Priorité" value={draft.priority} onChange={(e) => set("priority", e.target.value as TaskDraft["priority"])} style={{ display: "block" }}>
          {PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
      </label>
      <label>Échéance
        <input aria-label="Échéance" type="date" value={draft.dueDate ? toDateInput(draft.dueDate) : ""}
          onChange={(e) => set("dueDate", e.target.value ? fromDateInput(e.target.value) : null)} style={{ display: "block" }} />
      </label>
      <label>Statut
        <select aria-label="Statut" value={draft.status} onChange={(e) => set("status", e.target.value as TaskDraft["status"])} style={{ display: "block" }}>
          {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </label>
      <SubtaskField rows={draft.subtasks} onChange={(rows) => set("subtasks", rows)} />
      <label>Récurrence
        <select aria-label="Récurrence" value={draft.recurrence ?? ""} onChange={(e) => set("recurrence", e.target.value === "" ? null : e.target.value)} style={{ display: "block" }}>
          {RECUR.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
      </label>
      <label>Événement lié
        <select aria-label="Événement lié" value={draft.eventId ?? ""} onChange={(e) => set("eventId", e.target.value === "" ? null : e.target.value)} style={{ display: "block" }}>
          <option value="">Aucun</option>
          {events.map((ev) => <option key={ev.id} value={ev.id}>{ev.title}</option>)}
        </select>
      </label>
      {contacts.length > 0 && (
        <fieldset style={{ border: `1px solid ${tokens.color.line}` }}>
          <legend>Contacts liés</legend>
          {contacts.map((c) => (
            <label key={c.id} style={{ display: "block" }}>
              <input type="checkbox" aria-label={c.displayName} checked={draft.contactIds.includes(c.id)}
                onChange={(e) => set("contactIds", e.target.checked
                  ? [...draft.contactIds, c.id]
                  : draft.contactIds.filter((id) => id !== c.id))} />
              {" "}{c.displayName}
            </label>
          ))}
        </fieldset>
      )}
      <div style={{ display: "flex", gap: tokens.space.sm }}>
        <button type="submit">Enregistrer</button>
        <button type="button" onClick={onCancel}>Annuler</button>
      </div>
    </form>
  );
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `pnpm --filter @retrorganizer/web test -- TaskForm`
Expected: PASS — 1 test. Then `pnpm --filter @retrorganizer/web typecheck` → clean.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/tasks/SubtaskField.tsx apps/web/src/tasks/TaskForm.tsx apps/web/src/tasks/TaskForm.test.tsx
git commit -m "feat(web): SubtaskField + TaskForm (priority/due/status/subtasks/links)"
```

---

### Task 5: `TaskList` (web)

**Files:**
- Create: `apps/web/src/tasks/TaskList.tsx`
- Test: `apps/web/src/tasks/TaskList.test.tsx`

**Interfaces:**
- Consumes: `tokens` (ui); `Task` (core).
- Produces:
  - `TaskList`: `<TaskList tasks onSelect onNew onToggleComplete statusFilter onStatusFilterChange search onSearchChange sortKey onSortKeyChange />`. Renders: a search input (`aria-label="Rechercher"`), a status `<select>` (`aria-label="Filtrer par statut"`: Tous/À faire/En cours/Terminé → all/todo/in_progress/done), a sort `<select>` (`aria-label="Trier par"`: Priorité/Échéance/Titre → priority/dueDate/title), a `+ Nouvelle tâche` button, and one row per task with: a complete checkbox (`aria-label="Terminer {title}"`, checked when `status === "done"`, fires `onToggleComplete(task)`), the title (struck through when done), a priority badge, the due date if set, and subtask progress `n/m` when subtasks exist. Clicking the row (not the checkbox) fires `onSelect(task)`.

- [ ] **Step 1: Write the failing test — `apps/web/src/tasks/TaskList.test.tsx`**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TaskList } from "./TaskList";
import { parseTask, type Task } from "@retrorganizer/core";

function mk(id: string, extra: Partial<Task> = {}): Task {
  return parseTask({ id, ownerId: "u1", createdAt: 1, updatedAt: 1, deletedAt: null, title: id, ...extra });
}

const base = {
  onSelect: () => {}, onNew: () => {}, onToggleComplete: () => {},
  statusFilter: "all" as const, onStatusFilterChange: () => {},
  search: "", onSearchChange: () => {},
  sortKey: "priority" as const, onSortKeyChange: () => {},
};

describe("TaskList", () => {
  it("renders a row per task and fires onSelect", () => {
    const onSelect = vi.fn();
    const tasks = [mk("Acheter pain"), mk("Payer facture")];
    render(<TaskList {...base} tasks={tasks} onSelect={onSelect} />);
    fireEvent.click(screen.getByText("Acheter pain"));
    expect(onSelect).toHaveBeenCalledWith(tasks[0]);
  });

  it("fires onToggleComplete from the checkbox without selecting", () => {
    const onSelect = vi.fn();
    const onToggleComplete = vi.fn();
    const tasks = [mk("Acheter pain")];
    render(<TaskList {...base} tasks={tasks} onSelect={onSelect} onToggleComplete={onToggleComplete} />);
    fireEvent.click(screen.getByLabelText("Terminer Acheter pain"));
    expect(onToggleComplete).toHaveBeenCalledWith(tasks[0]);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("shows subtask progress", () => {
    const tasks = [mk("X", { subtasks: [{ title: "a", done: true }, { title: "b", done: false }] })];
    render(<TaskList {...base} tasks={tasks} />);
    expect(screen.getByText("1/2")).toBeInTheDocument();
  });

  it("typing in search calls onSearchChange", () => {
    const onSearchChange = vi.fn();
    render(<TaskList {...base} tasks={[]} onSearchChange={onSearchChange} />);
    fireEvent.change(screen.getByLabelText("Rechercher"), { target: { value: "pain" } });
    expect(onSearchChange).toHaveBeenCalledWith("pain");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @retrorganizer/web test -- TaskList`
Expected: FAIL — module `./TaskList` not found.

- [ ] **Step 3: Implement `apps/web/src/tasks/TaskList.tsx`**

```tsx
import { tokens } from "@retrorganizer/ui";
import type { Task, TaskStatus } from "@retrorganizer/core";

export type StatusFilter = TaskStatus | "all";
export type TaskSortKey = "priority" | "dueDate" | "title";

export interface TaskListProps {
  tasks: Task[];
  onSelect(t: Task): void;
  onNew(): void;
  onToggleComplete(t: Task): void;
  statusFilter: StatusFilter;
  onStatusFilterChange(s: StatusFilter): void;
  search: string;
  onSearchChange(s: string): void;
  sortKey: TaskSortKey;
  onSortKeyChange(k: TaskSortKey): void;
}

const PRIORITY_LABEL: Record<Task["priority"], string> = { low: "Basse", normal: "Normale", high: "Haute" };

function dueLabel(ms: number): string {
  return new Date(ms).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

export function TaskList(props: TaskListProps) {
  const { tasks, onSelect, onNew, onToggleComplete, statusFilter, onStatusFilterChange, search, onSearchChange, sortKey, onSortKeyChange } = props;
  return (
    <div style={{ padding: tokens.space.sm, font: `13px ${tokens.font.body}` }}>
      <div style={{ display: "flex", gap: tokens.space.sm, marginBottom: tokens.space.sm, flexWrap: "wrap" }}>
        <input aria-label="Rechercher" placeholder="Rechercher" value={search} onChange={(e) => onSearchChange(e.target.value)} />
        <select aria-label="Filtrer par statut" value={statusFilter} onChange={(e) => onStatusFilterChange(e.target.value as StatusFilter)}>
          <option value="all">Tous</option>
          <option value="todo">À faire</option>
          <option value="in_progress">En cours</option>
          <option value="done">Terminé</option>
        </select>
        <select aria-label="Trier par" value={sortKey} onChange={(e) => onSortKeyChange(e.target.value as TaskSortKey)}>
          <option value="priority">Priorité</option>
          <option value="dueDate">Échéance</option>
          <option value="title">Titre</option>
        </select>
        <button type="button" onClick={onNew}>+ Nouvelle tâche</button>
      </div>
      <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {tasks.map((t) => {
          const doneCount = t.subtasks.filter((s) => s.done).length;
          return (
            <li key={t.id} style={{ display: "flex", alignItems: "center", gap: tokens.space.sm,
              borderBottom: `1px solid ${tokens.color.line}`, padding: tokens.space.xs }}>
              <input type="checkbox" aria-label={`Terminer ${t.title}`} checked={t.status === "done"}
                onChange={() => onToggleComplete(t)} />
              <button type="button" onClick={() => onSelect(t)}
                style={{ flex: 1, textAlign: "left", border: "none", background: "transparent", cursor: "pointer",
                  color: tokens.color.ink, textDecoration: t.status === "done" ? "line-through" : "none" }}>
                {t.title}
              </button>
              <span style={{ color: tokens.color.muted, fontSize: 11 }}>{PRIORITY_LABEL[t.priority]}</span>
              {t.dueDate !== null && <span style={{ color: tokens.color.muted, fontSize: 11 }}>{dueLabel(t.dueDate)}</span>}
              {t.subtasks.length > 0 && <span style={{ color: tokens.color.muted, fontSize: 11 }}>{doneCount}/{t.subtasks.length}</span>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter @retrorganizer/web test -- TaskList`
Expected: PASS — 4 tests. Then `pnpm --filter @retrorganizer/web typecheck` → clean.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/tasks/TaskList.tsx apps/web/src/tasks/TaskList.test.tsx
git commit -m "feat(web): TaskList (filters, sort, complete toggle, subtask progress)"
```

---

### Task 6: `TasksModule` + route ToDo (web)

**Files:**
- Create: `apps/web/src/tasks/TasksModule.tsx`
- Modify: `apps/web/src/App.tsx` (route `todo` → `TasksModule`)
- Test: `apps/web/src/tasks/TasksModule.test.tsx`

> Note: `App.test.tsx` does NOT need a `TasksModule` stub — it renders only the default `/diary` route (CalendarModule, already stubbed), so `TasksModule` is never mounted by the App test. Do not add a dead mock.

**Interfaces:**
- Consumes: `tokens` (ui); `useTasks` (Task 3); `filterTasks`, `sortTasks`, `nextOccurrenceAfter`, `draftFromTask`, `emptyTaskDraft`, `type Task`, `type TaskDraft` (core); `TaskList` (Task 5), `TaskForm` (Task 4).
- Produces:
  - `TasksModule`: `<TasksModule />`. Holds `editing: { draft, id } | null`, `statusFilter`, `search`, `sortKey`. Computes `visible = sortTasks(filterTasks(tasks, { status: statusFilter, search }), sortKey)`. New → empty draft edit; select → `draftFromTask` edit; submit → create/update + back to list; delete → remove. **Complete toggle** (`onToggleComplete(task)`): if the task is recurring (`recurrence` set) and has a `dueDate` and is NOT already done → advance: `update(id, { dueDate: nextOccurrenceAfter(recurrence, dueDate) ?? dueDate, status: "todo", completedAt: null })`; otherwise toggle: if currently done → `update(id, { status: "todo", completedAt: null })`, else `update(id, { status: "done", completedAt: Date.now() })`. Wires `App.tsx` route `todo` → `<TasksModule />`.

- [ ] **Step 1: Write the failing test — `apps/web/src/tasks/TasksModule.test.tsx`**

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { TasksModule } from "./TasksModule";

const listByOwner = vi.fn();
const create = vi.fn();
const update = vi.fn();
vi.mock("@retrorganizer/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@retrorganizer/core")>();
  return {
    ...actual,
    tasksRepo: {
      listByOwner: (...a: unknown[]) => listByOwner(...a),
      create: (...a: unknown[]) => create(...a),
      update: (...a: unknown[]) => update(...a),
      softDelete: vi.fn(),
    },
  };
});
vi.mock("../auth/AuthProvider", () => ({ useAuth: () => ({ user: { uid: "u1", email: "a@x.io" } }) }));
vi.mock("../contacts/useContacts", () => ({ useContacts: () => ({ contacts: [], loading: false }) }));
vi.mock("../calendar/useEvents", () => ({ useEvents: () => ({ events: [], loading: false }) }));

const task = (extra: Record<string, unknown> = {}) => ({
  id: "t1", ownerId: "u1", createdAt: 1, updatedAt: 1, deletedAt: null, title: "Acheter pain",
  description: "", priority: "normal", dueDate: null, status: "todo", completedAt: null,
  subtasks: [], recurrence: null, contactIds: [], eventId: null, categoryId: null, tags: [], ...extra,
});

beforeEach(() => {
  listByOwner.mockReset().mockResolvedValue([task()]);
  create.mockReset().mockResolvedValue(undefined);
  update.mockReset().mockResolvedValue(undefined);
});

describe("TasksModule", () => {
  it("completing a non-recurring task marks it done", async () => {
    render(<TasksModule />);
    await waitFor(() => expect(screen.getByLabelText("Terminer Acheter pain")).toBeInTheDocument());
    fireEvent.click(screen.getByLabelText("Terminer Acheter pain"));
    await waitFor(() => expect(update).toHaveBeenCalledTimes(1));
    expect(update.mock.calls[0]![0]).toBe("t1");
    expect((update.mock.calls[0]![1] as { status: string }).status).toBe("done");
  });

  it("completing a recurring task advances its due date and stays todo", async () => {
    const DUE = Date.UTC(2026, 0, 5, 9);
    listByOwner.mockReset().mockResolvedValue([task({ recurrence: "FREQ=WEEKLY", dueDate: DUE })]);
    render(<TasksModule />);
    await waitFor(() => expect(screen.getByLabelText("Terminer Acheter pain")).toBeInTheDocument());
    fireEvent.click(screen.getByLabelText("Terminer Acheter pain"));
    await waitFor(() => expect(update).toHaveBeenCalledTimes(1));
    const patch = update.mock.calls[0]![1] as { status: string; dueDate: number };
    expect(patch.status).toBe("todo");
    expect(patch.dueDate).toBe(DUE + 7 * 24 * 3600000);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @retrorganizer/web test -- TasksModule`
Expected: FAIL — module `./TasksModule` not found.

- [ ] **Step 3: Implement `apps/web/src/tasks/TasksModule.tsx`**

```tsx
import { useMemo, useState } from "react";
import { tokens } from "@retrorganizer/ui";
import {
  filterTasks, sortTasks, nextOccurrenceAfter, draftFromTask, emptyTaskDraft,
  type Task, type TaskDraft,
} from "@retrorganizer/core";
import { useTasks } from "./useTasks";
import { TaskList, type StatusFilter, type TaskSortKey } from "./TaskList";
import { TaskForm } from "./TaskForm";

export function TasksModule() {
  const { tasks, loading, error, create, update, remove } = useTasks();
  const [editing, setEditing] = useState<{ draft: TaskDraft; id: string | null } | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<TaskSortKey>("priority");

  const visible = useMemo(
    () => sortTasks(filterTasks(tasks, { status: statusFilter, search }), sortKey),
    [tasks, statusFilter, search, sortKey],
  );

  async function onSubmit(draft: TaskDraft) {
    if (editing?.id) await update(editing.id, draft);
    else await create(draft);
    setEditing(null);
  }

  async function onToggleComplete(t: Task) {
    if (t.recurrence && t.dueDate !== null && t.status !== "done") {
      await update(t.id, {
        dueDate: nextOccurrenceAfter(t.recurrence, t.dueDate) ?? t.dueDate,
        status: "todo",
        completedAt: null,
      });
      return;
    }
    if (t.status === "done") await update(t.id, { status: "todo", completedAt: null });
    else await update(t.id, { status: "done", completedAt: Date.now() });
  }

  if (loading) return <div style={{ padding: tokens.space.lg }}>Chargement…</div>;

  if (editing) {
    return (
      <div>
        <TaskForm initial={editing.draft} onSubmit={onSubmit} onCancel={() => setEditing(null)} />
        {editing.id && (
          <button type="button" style={{ margin: tokens.space.md }}
            onClick={async () => { await remove(editing.id!); setEditing(null); }}>Supprimer</button>
        )}
      </div>
    );
  }

  return (
    <div>
      {error && <p role="alert" style={{ color: "#a8431f", padding: tokens.space.sm }}>{error}</p>}
      <TaskList
        tasks={visible}
        onSelect={(t) => setEditing({ draft: draftFromTask(t), id: t.id })}
        onNew={() => setEditing({ draft: emptyTaskDraft(), id: null })}
        onToggleComplete={onToggleComplete}
        statusFilter={statusFilter} onStatusFilterChange={setStatusFilter}
        search={search} onSearchChange={setSearch}
        sortKey={sortKey} onSortKeyChange={setSortKey}
      />
    </div>
  );
}
```

- [ ] **Step 4: Wire the route in `apps/web/src/App.tsx`**

Add the import:

```tsx
import { TasksModule } from "./tasks/TasksModule";
```

Then add a `todo` branch to the route element (keep the `diary` and `address` branches). Replace:

```tsx
element={
  s.id === "diary"
    ? <CalendarModule />
    : s.id === "address"
      ? <ContactsModule />
      : s.mvp
        ? <SectionPlaceholder label={s.label} />
        : <ComingSoon label={s.label} />
}
```

with:

```tsx
element={
  s.id === "diary"
    ? <CalendarModule />
    : s.id === "todo"
      ? <TasksModule />
      : s.id === "address"
        ? <ContactsModule />
        : s.mvp
          ? <SectionPlaceholder label={s.label} />
          : <ComingSoon label={s.label} />
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `pnpm --filter @retrorganizer/web test -- TasksModule`
Expected: PASS — 2 tests (non-recurring complete → done; recurring complete → advance + todo).
Then full web suite `pnpm --filter @retrorganizer/web test` (App.test still green) and `pnpm --filter @retrorganizer/web typecheck` → clean.

- [ ] **Step 6: Build verification**

Run: `pnpm build`
Expected: succeeds; `apps/web/dist` produced.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/tasks/TasksModule.tsx apps/web/src/tasks/TasksModule.test.tsx apps/web/src/App.tsx
git commit -m "feat(web): TasksModule (filters, recurring complete-advance) wired to ToDo tab"
```

---

## Définition de « terminé » pour la Phase 3

- `pnpm exec firebase emulators:exec --only auth,firestore "pnpm test"` : tous les tests verts, incluant les nouvelles suites core (**task, taskQuery, recurrenceNext**) et web (**useTasks, TaskForm, TaskList, TasksModule**).
- `pnpm --filter @retrorganizer/core typecheck` et `pnpm --filter @retrorganizer/web typecheck` propres ; `pnpm build` produit `apps/web/dist`.
- L'onglet **ToDo** affiche les tâches : filtres statut/recherche, tri (priorité/échéance/titre), création/édition/suppression (priorité, échéance, sous-étapes, récurrence, liens contact/événement), complétion avec case à cocher (terminées historisées), et **avance automatique de l'échéance** pour les tâches récurrentes.

> Périmètre filtres (spec §7.2 « par date/statut/catégorie/contexte ») : le MVP couvre **statut + recherche + tri par échéance**. Le filtre par **catégorie** est différé en Phase 5 (les catégories n'existent pas avant) ; le filtre par **bucket de date** (en retard/aujourd'hui/à venir) et par **tag/contexte** est un petit ajout différé à brancher sur `filterTasks` quand le besoin se confirme.

À l'issue de la Phase 3, restent au MVP 1 : **Phase 4 — Notes** (carnets, éditeur Tiptap, liens internes) et **Phase 5 — Transverse** (recherche globale, rappels/notifications, catégories/couleurs, corbeille). Rappel : le **fix DST des récurrences** (couche 2a) reste à traiter et bénéficiera aussi à `nextOccurrenceAfter`.
