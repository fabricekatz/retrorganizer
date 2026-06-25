# Retrorganizer — Phase 5c : Corbeille — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Livrer la corbeille : étendre le repository générique avec `restore`, `hardDelete`, `listDeletedByOwner`, puis un hook `useTrash` (corbeille unifiée des 5 collections) et un `TrashPanel` accessible depuis un bouton « Corbeille » dans l'en-tête — pour restaurer ou supprimer définitivement les éléments soft-deleted.

**Architecture:** Les 3 nouvelles opérations vivent dans le repository générique de `packages/core` (donc disponibles pour tous les repos). `apps/web/src/trash/` agrège les éléments soft-deleted des 5 repos via `useTrash`, et `TrashPanel` (ouvert depuis l'en-tête) liste/restaure/purge. Pas de nouvelle dépendance.

**Tech Stack:** TypeScript strict, Firestore via le repo générique, React + Vitest + @testing-library/react.

## Global Constraints

- Produit : **Retrorganizer**. TypeScript **strict** (noUncheckedIndexedAccess ON) — dans les TESTS, `const [x] = arr` → `const x = arr[0]!` ; `.mock.calls[0][0]` → `.mock.calls[0]![0] as <Type>` ; ne jamais affaiblir le code de production.
- Aucune app ne parle directement à Firestore — uniquement via `@retrorganizer/core` (les repos).
- `listDeletedByOwner` filtre `deletedAt !== null` **côté client** (requête `where ownerId == uid` seule — index mono-champ, pas d'index composite à ajouter).
- `restore` remet `deletedAt: null` (+ `updatedAt`) ; `hardDelete` est une suppression **définitive** (`deleteDoc`). La purge passe par une **confirmation** (`window.confirm`).
- Les Security Rules existantes couvrent ces opérations : `update` (restore) exige `isOwner() && isCreatingOwn()` (l'`ownerId` reste inchangé) ; `delete` (hardDelete) exige `isOwner()`.
- Réutiliser : `getFirebase`, `tokens`/`moduleAccent` (ui), les 5 repos (`contactsRepo`/`eventsRepo`/`tasksRepo`/`notesRepo`/`categoriesRepo`).
- Commits fréquents, un par tâche minimum.

## Interfaces héritées (à consommer/étendre)

Depuis `@retrorganizer/core` `src/repositories/base.ts` : `Repository<T>` actuel = `{ create, get, update, softDelete, listByOwner }`. Le générique utilise des closures `col()` / `ref(id)` sur `getFirebase().db`.
Repos : `contactsRepo` (Contact.displayName), `eventsRepo` (Event.title), `tasksRepo` (Task.title), `notesRepo` (Note.title), `categoriesRepo` (Category.name).
Depuis `@retrorganizer/ui` : `tokens`, `moduleAccent`. Depuis `apps/web` : `useAuth()`.

---

### Task 1: Étendre le repository générique (core)

**Files:**
- Modify: `packages/core/src/repositories/base.ts`
- Test: `packages/core/src/repositories/trash.test.ts`

**Interfaces:**
- Consumes: `getFirebase`, firestore (`deleteDoc` is NEW import).
- Produces (added to `Repository<T>` and the `createRepository` implementation):
  - `restore(id: string): Promise<void>` — `updateDoc(ref(id), { deletedAt: null, updatedAt: Date.now() })`.
  - `hardDelete(id: string): Promise<void>` — `deleteDoc(ref(id))` (permanent).
  - `listDeletedByOwner(ownerId: string): Promise<T[]>` — `query(col(), where("ownerId","==",ownerId))`, parse each doc, filter `e.deletedAt !== null` (client-side).

- [ ] **Step 1: Read `packages/core/src/repositories/base.ts`** to see the exact current shape (the `Repository<T>` interface, the `createRepository` return object, and the existing firestore imports — you will ADD `deleteDoc` to the import from `firebase/firestore`).

- [ ] **Step 2: Write the failing test — `packages/core/src/repositories/trash.test.ts`**

Model the emulator + auth setup on the EXISTING `packages/core/src/repositories/contacts.test.ts` (same `initFirebase(..., true)`, the same `signInAnonymously` auth so writes pass the ownerId rules, and the same `afterEach` Firestore clear). Use the authenticated uid as `ownerId`. The test body:

```ts
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { initFirebase, getFirebase } from "../firebase/app";
import { contactsRepo } from "./contacts";
import { signInAnonymously } from "firebase/auth";

let uid: string;

beforeAll(async () => {
  initFirebase({ apiKey: "x", authDomain: "x", projectId: "retrorganizer-dev", appId: "x" }, true);
  const cred = await signInAnonymously(getFirebase().auth);
  uid = cred.user.uid;
});

// Owner-scoped cleanup (the anon uid is unique to THIS test file), so it never
// wipes other emulator test files' data — uses hardDelete (the method under test).
afterEach(async () => {
  const active = await contactsRepo.listByOwner(uid);
  const deleted = await contactsRepo.listDeletedByOwner(uid);
  await Promise.all([...active, ...deleted].map((c) => contactsRepo.hardDelete(c.id)));
});

describe("repository trash operations", () => {
  it("listDeletedByOwner returns only soft-deleted docs; listByOwner excludes them", async () => {
    const a = await contactsRepo.create(uid, { displayName: "Garde" });
    const b = await contactsRepo.create(uid, { displayName: "Jeter" });
    await contactsRepo.softDelete(b.id);

    const active = await contactsRepo.listByOwner(uid);
    expect(active.map((c) => c.id)).toEqual([a.id]);

    const deleted = await contactsRepo.listDeletedByOwner(uid);
    expect(deleted.map((c) => c.id)).toEqual([b.id]);
  });

  it("restore brings a soft-deleted doc back into listByOwner", async () => {
    const c = await contactsRepo.create(uid, { displayName: "Restaurer" });
    await contactsRepo.softDelete(c.id);
    await contactsRepo.restore(c.id);

    expect((await contactsRepo.get(c.id))?.displayName).toBe("Restaurer");
    expect(await contactsRepo.listDeletedByOwner(uid)).toEqual([]);
    expect((await contactsRepo.listByOwner(uid)).map((x) => x.id)).toContain(c.id);
  });

  it("hardDelete permanently removes a doc", async () => {
    const c = await contactsRepo.create(uid, { displayName: "Purger" });
    await contactsRepo.softDelete(c.id);
    await contactsRepo.hardDelete(c.id);

    expect(await contactsRepo.get(c.id)).toBeNull();
    expect(await contactsRepo.listDeletedByOwner(uid)).toEqual([]);
  });
});
```

> Note exécutant : `contactsRepo.create(uid, ...)` écrit avec `ownerId = uid` (l'uid anonyme authentifié), donc les règles passent. Réutilise le setup auth/émulateur de `contacts.test.ts` (mêmes `initFirebase(..., true)` + `signInAnonymously`). N'utilise PAS le clear projet-entier : le nettoyage `afterEach` ci-dessus est **scopé à l'uid** (anonyme, unique par fichier de test), pour ne pas interférer avec les autres suites émulateur exécutées en parallèle.

- [ ] **Step 3: Run to verify it fails (under the emulator)**

Run: `pnpm exec firebase emulators:exec --only firestore,auth "pnpm --filter @retrorganizer/core test -- trash.test"`
Expected: FAIL — `listDeletedByOwner`/`restore`/`hardDelete` are not functions on the repo.

- [ ] **Step 4: Add `deleteDoc` to the firestore import in `base.ts`**

The existing import is like `import { collection, doc, getDoc, getDocs, setDoc, updateDoc, query, where } from "firebase/firestore";` — add `deleteDoc`:

```ts
import { collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, query, where } from "firebase/firestore";
```

- [ ] **Step 5: Add the three methods to the `Repository<T>` interface** (after `listByOwner`):

```ts
  restore(id: string): Promise<void>;
  hardDelete(id: string): Promise<void>;
  listDeletedByOwner(ownerId: string): Promise<T[]>;
```

- [ ] **Step 6: Add the three implementations to the object returned by `createRepository`** (after `listByOwner`):

```ts
    async restore(id) {
      await updateDoc(ref(id), { deletedAt: null, updatedAt: Date.now() });
    },
    async hardDelete(id) {
      await deleteDoc(ref(id));
    },
    async listDeletedByOwner(ownerId) {
      const q = query(col(), where("ownerId", "==", ownerId));
      const snap = await getDocs(q);
      return snap.docs.map((d) => parse(d.data())).filter((e) => e.deletedAt !== null);
    },
```

- [ ] **Step 7: Run to verify it passes (under the emulator)**

Run: `pnpm exec firebase emulators:exec --only firestore,auth "pnpm --filter @retrorganizer/core test -- trash.test"`
Expected: PASS — 3 tests. Then confirm the existing repo tests still pass: `pnpm exec firebase emulators:exec --only firestore,auth "pnpm --filter @retrorganizer/core test"` and `pnpm --filter @retrorganizer/core typecheck` → clean.

- [ ] **Step 8: Commit**

```bash
git add packages/core/src/repositories/base.ts packages/core/src/repositories/trash.test.ts
git commit -m "feat(core): repository restore / hardDelete / listDeletedByOwner"
```

---

### Task 2: `useTrash` hook (web)

**Files:**
- Create: `apps/web/src/trash/useTrash.ts`
- Test: `apps/web/src/trash/useTrash.test.tsx`

**Interfaces:**
- Consumes: `contactsRepo`, `eventsRepo`, `tasksRepo`, `notesRepo`, `categoriesRepo` (core, each now has `listDeletedByOwner`/`restore`/`hardDelete`); `useAuth` (web).
- Produces:
  - `TrashType` = `"contact" | "event" | "task" | "note" | "category"`.
  - `TrashItem` = `{ type: TrashType; id: string; title: string }`.
  - `useTrash(): { items: TrashItem[]; loading: boolean; error: string | null; restore(item: TrashItem): Promise<void>; purge(item: TrashItem): Promise<void>; reload(): Promise<void> }`
  - On mount/uid change, loads the 5 collections' `listDeletedByOwner(uid)` via `Promise.all`, maps to `TrashItem[]` (titles: contact→displayName, event→title, task→title, note→title|"(sans titre)", category→name). `restore`/`purge` dispatch to the right repo's `restore`/`hardDelete` then `reload`. null-uid → empty, loading false, error cleared.

- [ ] **Step 1: Write the failing test — `apps/web/src/trash/useTrash.test.tsx`**

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useTrash } from "./useTrash";

const mk = () => ({ listDeletedByOwner: vi.fn().mockResolvedValue([]), restore: vi.fn().mockResolvedValue(undefined), hardDelete: vi.fn().mockResolvedValue(undefined) });
const repos = { contacts: mk(), events: mk(), tasks: mk(), notes: mk(), categories: mk() };
vi.mock("@retrorganizer/core", () => ({
  contactsRepo: repos.contacts, eventsRepo: repos.events, tasksRepo: repos.tasks, notesRepo: repos.notes, categoriesRepo: repos.categories,
}));
let mockUser: { uid: string } | null = { uid: "u1" };
vi.mock("../auth/AuthProvider", () => ({ useAuth: () => ({ user: mockUser }) }));

const base = { ownerId: "u1", createdAt: 1, updatedAt: 1, deletedAt: 9 };

beforeEach(() => {
  mockUser = { uid: "u1" };
  Object.values(repos).forEach((r) => { r.listDeletedByOwner.mockReset().mockResolvedValue([]); r.restore.mockReset().mockResolvedValue(undefined); r.hardDelete.mockReset().mockResolvedValue(undefined); });
  repos.contacts.listDeletedByOwner.mockResolvedValue([{ id: "c1", ...base, displayName: "Ada", firstName: "", lastName: "", organization: "", emails: [], phones: [], addresses: [], webLinks: [], importantDates: [], customFields: [], categoryId: null, tags: [] }]);
  repos.tasks.listDeletedByOwner.mockResolvedValue([{ id: "t1", ...base, title: "Vieille tâche", description: "", priority: "normal", dueDate: null, status: "todo", completedAt: null, subtasks: [], recurrence: null, contactIds: [], eventId: null, categoryId: null, tags: [] }]);
});

describe("useTrash", () => {
  it("aggregates deleted items across collections", async () => {
    const { result } = renderHook(() => useTrash());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.items).toEqual(expect.arrayContaining([
      { type: "contact", id: "c1", title: "Ada" },
      { type: "task", id: "t1", title: "Vieille tâche" },
    ]));
  });

  it("restore dispatches to the right repo then reloads", async () => {
    const { result } = renderHook(() => useTrash());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.restore({ type: "contact", id: "c1", title: "Ada" }); });
    expect(repos.contacts.restore).toHaveBeenCalledWith("c1");
    expect(repos.contacts.listDeletedByOwner).toHaveBeenCalledTimes(2);
  });

  it("purge dispatches hardDelete to the right repo", async () => {
    const { result } = renderHook(() => useTrash());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.purge({ type: "task", id: "t1", title: "Vieille tâche" }); });
    expect(repos.tasks.hardDelete).toHaveBeenCalledWith("t1");
  });

  it("returns empty/not-loading with no user", async () => {
    mockUser = null;
    const { result } = renderHook(() => useTrash());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.items).toEqual([]);
    expect(repos.contacts.listDeletedByOwner).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @retrorganizer/web test -- useTrash`
Expected: FAIL — module `./useTrash` not found.

- [ ] **Step 3: Implement `apps/web/src/trash/useTrash.ts`**

```ts
import { useCallback, useEffect, useState } from "react";
import { contactsRepo, eventsRepo, tasksRepo, notesRepo, categoriesRepo } from "@retrorganizer/core";
import { useAuth } from "../auth/AuthProvider";

export type TrashType = "contact" | "event" | "task" | "note" | "category";

export interface TrashItem {
  type: TrashType;
  id: string;
  title: string;
}

const REPOS = {
  contact: contactsRepo, event: eventsRepo, task: tasksRepo, note: notesRepo, category: categoriesRepo,
} as const;

export interface UseTrash {
  items: TrashItem[];
  loading: boolean;
  error: string | null;
  restore(item: TrashItem): Promise<void>;
  purge(item: TrashItem): Promise<void>;
  reload(): Promise<void>;
}

export function useTrash(): UseTrash {
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  const [items, setItems] = useState<TrashItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!uid) { setItems([]); setError(null); setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const [contacts, events, tasks, notes, categories] = await Promise.all([
        contactsRepo.listDeletedByOwner(uid), eventsRepo.listDeletedByOwner(uid),
        tasksRepo.listDeletedByOwner(uid), notesRepo.listDeletedByOwner(uid),
        categoriesRepo.listDeletedByOwner(uid),
      ]);
      setItems([
        ...contacts.map((c) => ({ type: "contact" as const, id: c.id, title: c.displayName })),
        ...events.map((e) => ({ type: "event" as const, id: e.id, title: e.title })),
        ...tasks.map((t) => ({ type: "task" as const, id: t.id, title: t.title })),
        ...notes.map((n) => ({ type: "note" as const, id: n.id, title: n.title || "(sans titre)" })),
        ...categories.map((c) => ({ type: "category" as const, id: c.id, title: c.name })),
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Échec du chargement");
    } finally {
      setLoading(false);
    }
  }, [uid]);

  useEffect(() => { void reload(); }, [reload]);

  const restore = useCallback(async (item: TrashItem) => {
    try { await REPOS[item.type].restore(item.id); }
    catch (e) { setError(e instanceof Error ? e.message : "Échec de la restauration"); return; }
    await reload();
  }, [reload]);

  const purge = useCallback(async (item: TrashItem) => {
    try { await REPOS[item.type].hardDelete(item.id); }
    catch (e) { setError(e instanceof Error ? e.message : "Échec de la suppression"); return; }
    await reload();
  }, [reload]);

  return { items, loading, error, restore, purge, reload };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter @retrorganizer/web test -- useTrash`
Expected: PASS — 4 tests. Then full web suite + `pnpm --filter @retrorganizer/web typecheck` → clean.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/trash/useTrash.ts apps/web/src/trash/useTrash.test.tsx
git commit -m "feat(web): useTrash hook (unified trash across all repos)"
```

---

### Task 3: `TrashPanel` (web)

**Files:**
- Create: `apps/web/src/trash/TrashPanel.tsx`
- Test: `apps/web/src/trash/TrashPanel.test.tsx`

**Interfaces:**
- Consumes: `tokens` (ui); `useTrash`, `type TrashType` (Task 2).
- Produces:
  - `TrashPanel`: `<TrashPanel onClose={() => void} />`. Uses `useTrash`. Renders a panel titled "Corbeille" with a `Fermer` button (calls `onClose`), and one row per item showing a type label + title with a `Restaurer` button (`restore(item)`) and a `Supprimer définitivement` button (confirms via `window.confirm` then `purge(item)`). Empty list → "Corbeille vide".

- [ ] **Step 1: Write the failing test — `apps/web/src/trash/TrashPanel.test.tsx`**

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TrashPanel } from "./TrashPanel";

const restore = vi.fn();
const purge = vi.fn();
let items: { type: string; id: string; title: string }[] = [];
vi.mock("./useTrash", () => ({
  useTrash: () => ({ items, loading: false, error: null, restore, purge, reload: vi.fn() }),
}));

beforeEach(() => { restore.mockReset(); purge.mockReset(); items = []; });

describe("TrashPanel", () => {
  it("shows the empty message when trash is empty", () => {
    render(<TrashPanel onClose={() => {}} />);
    expect(screen.getByText("Corbeille vide")).toBeInTheDocument();
  });

  it("restores an item", () => {
    items = [{ type: "contact", id: "c1", title: "Ada" }];
    render(<TrashPanel onClose={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Restaurer" }));
    expect(restore).toHaveBeenCalledWith(items[0]);
  });

  it("purges an item after confirmation", () => {
    items = [{ type: "task", id: "t1", title: "Vieille tâche" }];
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<TrashPanel onClose={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Supprimer définitivement" }));
    expect(purge).toHaveBeenCalledWith(items[0]);
  });

  it("does not purge when confirmation is cancelled", () => {
    items = [{ type: "task", id: "t1", title: "Vieille tâche" }];
    vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<TrashPanel onClose={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Supprimer définitivement" }));
    expect(purge).not.toHaveBeenCalled();
  });

  it("calls onClose from the Fermer button", () => {
    const onClose = vi.fn();
    render(<TrashPanel onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "Fermer" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @retrorganizer/web test -- TrashPanel`
Expected: FAIL — module `./TrashPanel` not found.

- [ ] **Step 3: Implement `apps/web/src/trash/TrashPanel.tsx`**

```tsx
import { tokens } from "@retrorganizer/ui";
import { useTrash, type TrashType } from "./useTrash";

const TYPE_LABEL: Record<TrashType, string> = {
  contact: "Contact", event: "Événement", task: "Tâche", note: "Note", category: "Catégorie",
};

export interface TrashPanelProps {
  onClose(): void;
}

export function TrashPanel({ onClose }: TrashPanelProps) {
  const { items, loading, error, restore, purge } = useTrash();

  return (
    <div style={{ position: "absolute", top: 36, right: tokens.space.md, width: 360, zIndex: 20,
      background: tokens.color.surface, border: `1px solid ${tokens.color.line}`, font: `13px ${tokens.font.body}`,
      maxHeight: "70vh", overflow: "auto", boxShadow: "0 4px 16px rgba(0,0,0,0.15)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: tokens.space.sm, borderBottom: `1px solid ${tokens.color.line}` }}>
        <strong>Corbeille</strong>
        <button type="button" onClick={onClose}>Fermer</button>
      </div>
      {error && <p role="alert" style={{ color: "#a8431f", padding: tokens.space.sm }}>{error}</p>}
      {loading ? (
        <p style={{ padding: tokens.space.md, color: tokens.color.muted }}>Chargement…</p>
      ) : items.length === 0 ? (
        <p style={{ padding: tokens.space.md, color: tokens.color.muted }}>Corbeille vide</p>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {items.map((item) => (
            <li key={`${item.type}:${item.id}`} style={{ display: "flex", alignItems: "center", gap: tokens.space.xs,
              borderBottom: `1px solid ${tokens.color.line}`, padding: tokens.space.xs }}>
              <span style={{ color: tokens.color.muted, minWidth: 72, fontSize: 11 }}>{TYPE_LABEL[item.type]}</span>
              <span style={{ flex: 1 }}>{item.title}</span>
              <button type="button" onClick={() => restore(item)}>Restaurer</button>
              <button type="button" onClick={() => { if (window.confirm("Supprimer définitivement ?")) purge(item); }}>
                Supprimer définitivement
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter @retrorganizer/web test -- TrashPanel`
Expected: PASS — 5 tests. Then `pnpm --filter @retrorganizer/web typecheck` → clean.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/trash/TrashPanel.tsx apps/web/src/trash/TrashPanel.test.tsx
git commit -m "feat(web): TrashPanel (restore + permanent delete)"
```

---

### Task 4: Bouton « Corbeille » dans l'en-tête (web)

**Files:**
- Modify: `apps/web/src/App.tsx`
- Test: `apps/web/src/App.test.tsx`

**Interfaces:**
- Consumes: `TrashPanel` (Task 3).
- Produces: the `App` header gains a `Corbeille` button (after the search bar, before logout); a `useState` `trashOpen`; when open, `<TrashPanel onClose={() => setTrashOpen(false)} />` is rendered (positioned overlay). The App test asserts the button exists and stays pristine (TrashPanel mounts only when open → its `useTrash` repo loads don't run in the App test, which never opens it; no stub needed).

- [ ] **Step 1: Update the App test — `apps/web/src/App.test.tsx`** (add one assertion to the existing "renders the 8 section tabs" or a new test):

```tsx
it("shows the trash button in the header", () => {
  render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={["/diary"]}><App /></MemoryRouter>);
  expect(screen.getByRole("button", { name: "Corbeille" })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @retrorganizer/web test -- App.test`
Expected: FAIL — no "Corbeille" button yet.

- [ ] **Step 3: Wire the button + panel in `apps/web/src/App.tsx`**

Add the import:

```tsx
import { TrashPanel } from "./trash/TrashPanel";
```

Add a `useState` near the top of the `App` component (alongside the existing hooks, after the auth/router hooks):

```tsx
const [trashOpen, setTrashOpen] = useState(false);
```

(If `useState` is not already imported in App.tsx, add it: `import { useState } from "react";`.)

In the `<header>` (which holds wordmark, `<GlobalSearchBar />`, and the logout button), add a `Corbeille` button before the logout button:

```tsx
<button type="button" onClick={() => setTrashOpen((o) => !o)}>Corbeille</button>
<button onClick={() => signOut()}>Déconnexion</button>
```

Immediately after the `<header>` closing tag, render the panel when open:

```tsx
{trashOpen && <TrashPanel onClose={() => setTrashOpen(false)} />}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter @retrorganizer/web test -- App.test`
Expected: PASS (the existing App tests + the new trash-button assertion).
Then full web suite `pnpm --filter @retrorganizer/web test` and `pnpm --filter @retrorganizer/web typecheck` → clean, and `pnpm build` → succeeds.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/App.tsx apps/web/src/App.test.tsx
git commit -m "feat(web): trash button + panel in the app header"
```

---

## Définition de « terminé » pour la Phase 5c

- `pnpm exec firebase emulators:exec --only auth,firestore "pnpm test"` : tous les tests verts, incluant la nouvelle suite core (**trash** — restore/hardDelete/listDeletedByOwner sur émulateur) et web (**useTrash, TrashPanel**), et le test du bouton dans **App**.
- `pnpm --filter @retrorganizer/core typecheck` et `pnpm --filter @retrorganizer/web typecheck` propres ; `pnpm build` produit `apps/web/dist`.
- Le bouton **Corbeille** de l'en-tête ouvre un panneau listant les éléments supprimés (contacts, événements, tâches, notes, catégories) avec **Restaurer** et **Supprimer définitivement** (confirmé).

À l'issue de la Phase 5c, reste du transverse : **5d — Rappels** (déclenchement in-app via l'API Notifications quand l'app est ouverte ; push serveur FCM + Cloud Function différé) — dernière brique du **MVP 1**. Différé noté : afficher un compteur d'éléments dans la corbeille, purge globale (« vider la corbeille »).
