# Categories Manager + Orphan Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user rename, recolor, and delete categories from a manager panel, and ensure deleting a category nulls its `categoryId` on every referencing contact, task, and event so no dangling reference remains.

**Architecture:** A new platform-agnostic core service `clearCategoryReferences(ownerId, categoryId)` lists contacts/tasks/events for the owner and nulls `categoryId` on those that reference the category. The web `useCategories.removeCategory` hook calls it before soft-deleting the category. A new `CategoryManager` panel (mirroring the existing `TrashPanel`) lists categories with an inline color input, a rename action, and a delete action, all driven by the existing `useCategories` hook. The panel is toggled from a new "Catégories" header button in `App`, exactly like the Corbeille/`TrashPanel` toggle.

**Tech Stack:** TypeScript (strict), Firestore repositories, React 18, `@retrorganizer/ui` tokens, Vitest + @testing-library/react, Firebase emulator for repo tests.

## Global Constraints

- TypeScript strict with `noUncheckedIndexedAccess`. Domain types are `z.infer<typeof schema>` — NO `& BaseEntity`, NO `as` casts in production code (test fixtures may cast).
- `packages/core` stays platform-agnostic (no DOM/Node-only APIs). The cleanup service uses only the existing repositories.
- Reuse existing primitives: `contactsRepo`/`tasksRepo`/`eventsRepo` (each `Repository<T>` with `listByOwner`/`update`), `categoriesRepo`, `useCategories`, `tokens`. Do NOT add a new color palette — recolor uses the native `<input type="color">`.
- Soft-delete semantics: deleting a category soft-deletes it (it appears in the Corbeille and can be restored). Orphan cleanup is one-way — restoring a category does NOT re-link entities. This is accepted behavior for MVP; do not build re-linking.
- Match the existing retro panel styling: copy `TrashPanel`'s container/header chrome (absolute panel, `tokens.color.*`, `tokens.space.*`, the box-shadow). Keep `App.test` pristine — the panel must be conditionally mounted (default closed) so it does not render in `App.test`.
- Notes have no `categoryId` and are not touched by cleanup.

---

### Task 1: Core — `clearCategoryReferences` service

**Files:**
- Create: `packages/core/src/repositories/categoryCleanup.ts`
- Modify: `packages/core/src/index.ts` (add one export line)
- Test: `packages/core/src/repositories/categoryCleanup.test.ts` (Firestore emulator)

**Interfaces:**
- Consumes: `contactsRepo`, `tasksRepo`, `eventsRepo` (each has `listByOwner(ownerId): Promise<T[]>` and `update(id, patch: Partial<T>): Promise<void>`). `Contact`, `Task`, `Event` each have `categoryId: string | null`.
- Produces: `clearCategoryReferences(ownerId: string, categoryId: string): Promise<void>` — nulls `categoryId` on every contact/task/event whose `categoryId === categoryId`. Task 2 imports it from `@retrorganizer/core`.

- [ ] **Step 1: Write the failing test**

The emulator harness mirrors `packages/core/src/repositories/contacts.test.ts` (anonymous sign-in, `afterEach` hard-deletes seeded docs). Create `packages/core/src/repositories/categoryCleanup.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { signInAnonymously } from "firebase/auth";
import { initFirebase, getFirebase } from "../firebase/app";
import { contactsRepo } from "./contacts";
import { tasksRepo } from "./tasks";
import { eventsRepo } from "./events";
import { categoriesRepo } from "./categories";
import { clearCategoryReferences } from "./categoryCleanup";

const PROJECT_ID = "retrorganizer-dev";
let ownerId: string;

beforeAll(async () => {
  initFirebase({ apiKey: "x", authDomain: "x", projectId: PROJECT_ID, appId: "x" }, true);
  const { auth } = getFirebase();
  const cred = await signInAnonymously(auth);
  ownerId = cred.user.uid;
});

afterEach(async () => {
  for (const repo of [contactsRepo, tasksRepo, eventsRepo, categoriesRepo]) {
    const active = await repo.listByOwner(ownerId);
    const deleted = await repo.listDeletedByOwner(ownerId);
    await Promise.all([...active, ...deleted].map((e) => repo.hardDelete(e.id)));
  }
});

describe("clearCategoryReferences", () => {
  it("nulls categoryId on referencing contacts, tasks, and events; leaves others", async () => {
    const cat = await categoriesRepo.create(ownerId, { name: "Travail", color: "#2f6f4f" });
    const other = await categoriesRepo.create(ownerId, { name: "Perso", color: "#a8431f" });

    const c1 = await contactsRepo.create(ownerId, { displayName: "Linked", categoryId: cat.id });
    const c2 = await contactsRepo.create(ownerId, { displayName: "Keep", categoryId: other.id });
    const t1 = await tasksRepo.create(ownerId, { title: "Linked task", categoryId: cat.id });
    const start = Date.now();
    const e1 = await eventsRepo.create(ownerId, { title: "Linked event", start, end: start + 3600000, categoryId: cat.id });

    await clearCategoryReferences(ownerId, cat.id);

    expect((await contactsRepo.get(c1.id))?.categoryId).toBeNull();
    expect((await contactsRepo.get(c2.id))?.categoryId).toBe(other.id);
    expect((await tasksRepo.get(t1.id))?.categoryId).toBeNull();
    expect((await eventsRepo.get(e1.id))?.categoryId).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec firebase emulators:exec --only auth,firestore "pnpm --filter @retrorganizer/core test -- categoryCleanup"`
(Java must be on PATH: `export PATH="/opt/homebrew/opt/openjdk/bin:$PATH"`.)
Expected: FAIL — `Failed to resolve import "./categoryCleanup"`.

- [ ] **Step 3: Write the implementation**

Create `packages/core/src/repositories/categoryCleanup.ts`:

```ts
import { contactsRepo } from "./contacts";
import { tasksRepo } from "./tasks";
import { eventsRepo } from "./events";

// Null categoryId on every contact, task, and event that references the given
// category. Call before soft-deleting a category so nothing keeps a dangling
// reference. Notes have no categoryId and are not touched.
export async function clearCategoryReferences(ownerId: string, categoryId: string): Promise<void> {
  const [contacts, tasks, events] = await Promise.all([
    contactsRepo.listByOwner(ownerId),
    tasksRepo.listByOwner(ownerId),
    eventsRepo.listByOwner(ownerId),
  ]);
  await Promise.all([
    ...contacts.filter((c) => c.categoryId === categoryId).map((c) => contactsRepo.update(c.id, { categoryId: null })),
    ...tasks.filter((t) => t.categoryId === categoryId).map((t) => tasksRepo.update(t.id, { categoryId: null })),
    ...events.filter((e) => e.categoryId === categoryId).map((e) => eventsRepo.update(e.id, { categoryId: null })),
  ]);
}
```

- [ ] **Step 4: Export from the core barrel**

In `packages/core/src/index.ts`, add after the existing `export * from "./repositories/categories";` line:

```ts
export * from "./repositories/categoryCleanup";
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm exec firebase emulators:exec --only auth,firestore "pnpm --filter @retrorganizer/core test -- categoryCleanup"`
Expected: PASS (1 test).

- [ ] **Step 6: Typecheck**

Run: `pnpm --filter @retrorganizer/core typecheck`
Expected: no errors. (If `update(id, { categoryId: null })` reports a type error, the concrete per-repo calls above should type-check without casts because each entity's `categoryId` is `string | null`; do NOT add an `as` cast — report it instead.)

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/repositories/categoryCleanup.ts packages/core/src/repositories/categoryCleanup.test.ts packages/core/src/index.ts
git commit -m "feat(core): clearCategoryReferences to null categoryId on delete"
```

---

### Task 2: Web — run cleanup on category delete

**Files:**
- Modify: `apps/web/src/categories/useCategories.ts`
- Test: `apps/web/src/categories/useCategories.test.tsx`

**Interfaces:**
- Consumes: `clearCategoryReferences` from `@retrorganizer/core` (Task 1).
- Produces: `removeCategory(id)` now calls `clearCategoryReferences(uid, id)` before `categoriesRepo.softDelete(id)`. Public signature unchanged.

- [ ] **Step 1: Update the test mock and add a failing test**

In `apps/web/src/categories/useCategories.test.tsx`, the `vi.mock("@retrorganizer/core", ...)` factory currently exposes only `categoriesRepo`. Add a `clearCategoryReferences` spy to the mock and assert delete order. At the top, alongside the existing `listByOwner`/`create` spies, add:

```ts
const softDelete = vi.fn();
const clearCategoryReferences = vi.fn();
```

Change the `vi.mock("@retrorganizer/core", ...)` factory to expose them:

```ts
vi.mock("@retrorganizer/core", () => ({
  categoriesRepo: {
    listByOwner: (...a: unknown[]) => listByOwner(...a),
    create: (...a: unknown[]) => create(...a),
    update: vi.fn(),
    softDelete: (...a: unknown[]) => softDelete(...a),
  },
  clearCategoryReferences: (...a: unknown[]) => clearCategoryReferences(...a),
}));
```

In `beforeEach`, reset them: `softDelete.mockReset().mockResolvedValue(undefined); clearCategoryReferences.mockReset().mockResolvedValue(undefined);`

Add this test inside the `describe("useCategories", ...)` block:

```ts
  it("removeCategory clears references before soft-deleting, then reloads", async () => {
    const { result } = renderHook(() => useCategories());
    await waitFor(() => expect(result.current.loading).toBe(false));
    listByOwner.mockClear();
    await act(async () => { await result.current.removeCategory("cat1"); });
    expect(clearCategoryReferences).toHaveBeenCalledWith("u1", "cat1");
    expect(softDelete).toHaveBeenCalledWith("cat1");
    expect(clearCategoryReferences.mock.invocationCallOrder[0]!).toBeLessThan(softDelete.mock.invocationCallOrder[0]!);
    expect(listByOwner).toHaveBeenCalledTimes(1); // reload after delete
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @retrorganizer/web test -- categories/useCategories`
Expected: FAIL — `clearCategoryReferences` not called (current `removeCategory` only soft-deletes).

- [ ] **Step 3: Implement**

In `apps/web/src/categories/useCategories.ts`:

Change the import to include the new service:

```ts
import { categoriesRepo, clearCategoryReferences, type Category, type CategoryDraft } from "@retrorganizer/core";
```

Replace `removeCategory` with:

```ts
  const removeCategory = useCallback(async (id: string) => {
    if (!uid) return;
    try {
      await clearCategoryReferences(uid, id);
      await categoriesRepo.softDelete(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Échec de la suppression");
      return;
    }
    await reload();
  }, [uid, reload]);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @retrorganizer/web test -- categories/useCategories`
Expected: PASS (all existing tests plus the new one).

- [ ] **Step 5: Typecheck**

Run: `pnpm --filter @retrorganizer/web typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/categories/useCategories.ts apps/web/src/categories/useCategories.test.tsx
git commit -m "feat(web): clear category references when deleting a category"
```

---

### Task 3: Web — CategoryManager panel

**Files:**
- Create: `apps/web/src/categories/CategoryManager.tsx`
- Test: `apps/web/src/categories/CategoryManager.test.tsx`

**Interfaces:**
- Consumes: `useCategories` (categories, loading, error, updateCategory, removeCategory); `tokens`.
- Produces: `CategoryManager({ onClose }: { onClose(): void })`. Task 4 mounts it.

- [ ] **Step 1: Write the failing test**

Mirror how `CategorySelect.test.tsx` mocks `./useCategories`. Create `apps/web/src/categories/CategoryManager.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CategoryManager } from "./CategoryManager";

const updateCategory = vi.fn();
const removeCategory = vi.fn();
let categories = [
  { id: "c1", ownerId: "u1", createdAt: 1, updatedAt: 1, deletedAt: null, name: "Travail", color: "#2f6f4f" },
];

vi.mock("./useCategories", () => ({
  useCategories: () => ({
    categories, loading: false, error: null,
    createCategory: vi.fn(), updateCategory, removeCategory, reload: vi.fn(),
  }),
}));

beforeEach(() => {
  updateCategory.mockReset();
  removeCategory.mockReset();
  categories = [{ id: "c1", ownerId: "u1", createdAt: 1, updatedAt: 1, deletedAt: null, name: "Travail", color: "#2f6f4f" }];
});

describe("CategoryManager", () => {
  it("lists categories and recolors via the color input", () => {
    render(<CategoryManager onClose={() => {}} />);
    expect(screen.getByText("Travail")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Couleur Travail"), { target: { value: "#1f4e79" } });
    expect(updateCategory).toHaveBeenCalledWith("c1", { color: "#1f4e79" });
  });

  it("renames via prompt", () => {
    vi.stubGlobal("prompt", vi.fn(() => "Boulot"));
    render(<CategoryManager onClose={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Renommer" }));
    expect(updateCategory).toHaveBeenCalledWith("c1", { name: "Boulot" });
    vi.unstubAllGlobals();
  });

  it("deletes after confirmation", () => {
    vi.stubGlobal("confirm", vi.fn(() => true));
    render(<CategoryManager onClose={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Supprimer" }));
    expect(removeCategory).toHaveBeenCalledWith("c1");
    vi.unstubAllGlobals();
  });

  it("shows an empty state when there are no categories", () => {
    categories = [];
    render(<CategoryManager onClose={() => {}} />);
    expect(screen.getByText("Aucune catégorie")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @retrorganizer/web test -- categories/CategoryManager`
Expected: FAIL — cannot resolve `./CategoryManager`.

- [ ] **Step 3: Implement the component**

Create `apps/web/src/categories/CategoryManager.tsx` (panel chrome copied from `TrashPanel`):

```tsx
import { tokens } from "@retrorganizer/ui";
import { useCategories } from "./useCategories";

export interface CategoryManagerProps {
  onClose(): void;
}

export function CategoryManager({ onClose }: CategoryManagerProps) {
  const { categories, loading, error, updateCategory, removeCategory } = useCategories();

  function rename(id: string, current: string) {
    const name = window.prompt("Nouveau nom ?", current);
    if (name !== null && name.trim() !== "" && name.trim() !== current) {
      void updateCategory(id, { name: name.trim() });
    }
  }

  return (
    <div style={{ position: "absolute", top: 36, right: tokens.space.md, width: 360, zIndex: 20,
      background: tokens.color.surface, border: `1px solid ${tokens.color.line}`, font: `13px ${tokens.font.body}`,
      maxHeight: "70vh", overflow: "auto", boxShadow: "0 4px 16px rgba(0,0,0,0.15)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: tokens.space.sm, borderBottom: `1px solid ${tokens.color.line}` }}>
        <strong>Catégories</strong>
        <button type="button" onClick={onClose}>Fermer</button>
      </div>
      {error && <p role="alert" style={{ color: "#a8431f", padding: tokens.space.sm }}>{error}</p>}
      {loading ? (
        <p style={{ padding: tokens.space.md, color: tokens.color.muted }}>Chargement…</p>
      ) : categories.length === 0 ? (
        <p style={{ padding: tokens.space.md, color: tokens.color.muted }}>Aucune catégorie</p>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {categories.map((c) => (
            <li key={c.id} style={{ display: "flex", alignItems: "center", gap: tokens.space.xs,
              borderBottom: `1px solid ${tokens.color.line}`, padding: tokens.space.xs }}>
              <input type="color" aria-label={`Couleur ${c.name}`} value={c.color}
                onChange={(e) => void updateCategory(c.id, { color: e.target.value })}
                style={{ width: 24, height: 24, padding: 0, border: "none", background: "none" }} />
              <span style={{ flex: 1 }}>{c.name}</span>
              <button type="button" onClick={() => rename(c.id, c.name)}>Renommer</button>
              <button type="button" onClick={() => { if (window.confirm(`Supprimer la catégorie « ${c.name} » ?`)) void removeCategory(c.id); }}>
                Supprimer
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @retrorganizer/web test -- categories/CategoryManager`
Expected: PASS (4 tests).

- [ ] **Step 5: Typecheck**

Run: `pnpm --filter @retrorganizer/web typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/categories/CategoryManager.tsx apps/web/src/categories/CategoryManager.test.tsx
git commit -m "feat(web): CategoryManager panel (rename, recolor, delete)"
```

---

### Task 4: Web — mount the manager from the App header

**Files:**
- Modify: `apps/web/src/App.tsx`
- Test: `apps/web/src/App.test.tsx` (verify still green; only adjust if a new assertion is warranted — do NOT weaken existing ones)

**Interfaces:**
- Consumes: `CategoryManager` (Task 3).
- Produces: a header "Catégories" button toggling the panel, mirroring the existing Corbeille/`TrashPanel` toggle.

- [ ] **Step 1: Read App.tsx and App.test.tsx**

Run: `sed -n '1,45p' apps/web/src/App.tsx` and `sed -n '1,60p' apps/web/src/App.test.tsx`
Confirm the Corbeille pattern: `const [trashOpen, setTrashOpen] = useState(false)`, a header `<button>` toggling it, and `{trashOpen && <TrashPanel .../>}`. Note how `App.test` avoids mounting heavy modules (it should not mount `TrashPanel` because `trashOpen` defaults false — the new panel must follow the same default-closed rule to keep the test pristine).

- [ ] **Step 2: Implement the toggle**

In `apps/web/src/App.tsx`:

Add the import next to the `TrashPanel` import:

```tsx
import { CategoryManager } from "./categories/CategoryManager";
```

Add state next to `trashOpen`:

```tsx
  const [categoriesOpen, setCategoriesOpen] = useState(false);
```

Add a header button immediately before the Corbeille button:

```tsx
        <button type="button" onClick={() => setCategoriesOpen((o) => !o)}>Catégories</button>
```

Add the conditional panel next to the TrashPanel mount:

```tsx
      {categoriesOpen && <CategoryManager onClose={() => setCategoriesOpen(false)} />}
```

- [ ] **Step 3: Run the App test (and the full web suite) to verify nothing regressed**

Run: `pnpm --filter @retrorganizer/web test -- App`
Expected: PASS, unchanged. `CategoryManager` must NOT render (panel default-closed), keeping the test pristine. If `App.test` asserts on the exact set of header buttons, add "Catégories" to that assertion — but do not remove or weaken any existing assertion.

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter @retrorganizer/web typecheck`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/App.tsx apps/web/src/App.test.tsx
git commit -m "feat(web): open the CategoryManager from a header button"
```

---

## Final verification (whole branch)

- [ ] Full suite under the emulator (Java on PATH): `pnpm exec firebase emulators:exec --only auth,firestore "pnpm test"` — expect core (+1 categoryCleanup) and web (+ new tests) green.
- [ ] `pnpm --filter @retrorganizer/web build` succeeds.
- [ ] Manual sanity (optional, if a dev stack is up): create two categories, assign one to a contact + a task + an event, open the manager, recolor and rename it, then delete it — confirm the references clear in the lists and the category lands in the Corbeille.
