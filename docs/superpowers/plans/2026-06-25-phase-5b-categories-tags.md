# Retrorganizer — Phase 5b : Catégories & tags — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Livrer l'infrastructure de catégories colorées et de tags, et l'adopter dans les formulaires des modules : modèle `Category` + repo, hook `useCategories`, composants `CategorySelect` (avec création inline) et `TagInput`, branchés dans `ContactForm`, `EventForm` et `TaskForm` (qui portent déjà `categoryId` et `tags`).

**Architecture:** Le modèle pur (`Category`, draft, `categoryById`) vit dans `packages/core`. `apps/web/src/categories/` fournit le hook + les deux composants réutilisables ; les formulaires existants les consomment pour éditer `draft.categoryId` et `draft.tags`. Pas de nouvelle dépendance.

**Tech Stack:** TypeScript strict, zod, Firestore via `createRepository`, React + Vitest + @testing-library/react.

## Global Constraints

- Produit : **Retrorganizer**. TypeScript **strict** (noUncheckedIndexedAccess ON) — dans les TESTS, `const [x] = arr` → `const x = arr[0]!` ; `.mock.calls[0][0]` → `.mock.calls[0]![0] as <Type>` ; ne jamais affaiblir le code de production.
- Aucune app ne parle directement à Firestore — uniquement via `@retrorganizer/core` (`categoriesRepo`).
- Modèle `Category` **aplati** (`z.infer`, pas de `& BaseEntity`, pas de cast) — convention établie.
- Les entités portent déjà `categoryId: string | null` et `tags: string[]` (Contact, Event, Task) — ce plan n'ajoute que l'UI d'édition.
- Création de catégorie **inline** : couleur auto depuis une petite palette (pas de color-picker en 5b). Le gestionnaire (renommer/recolorer/supprimer) et l'affichage de la catégorie/tags dans les listes sont **différés** (suivi).
- Réutiliser : `BaseEntity`, `createRepository`, `tokens` (ui), `useAuth` (web).
- Commits fréquents, un par tâche minimum.

## Interfaces héritées (à consommer)

Depuis `@retrorganizer/core` : `BaseEntity`, `createRepository`. Les drafts existants : `ContactDraft`/`EventDraft`/`TaskDraft` ont `categoryId: string|null` et `tags: string[]`.
Depuis les forms : `ContactForm` (apps/web/src/contacts/ContactForm.tsx), `EventForm` (apps/web/src/calendar/EventForm.tsx), `TaskForm` (apps/web/src/tasks/TaskForm.tsx) — chacun a un updater `set<K>(key, value)`.
Depuis `apps/web` : `useAuth()`. Depuis `@retrorganizer/ui` : `tokens`.

---

### Task 1: Modèle `Category` + repo + helper (core)

**Files:**
- Create: `packages/core/src/domain/category.ts`
- Create: `packages/core/src/repositories/categories.ts`
- Modify: `packages/core/src/index.ts` (exporter category + repo)
- Test: `packages/core/src/domain/category.test.ts`

**Interfaces:**
- Consumes: `createRepository` (Phase 0).
- Produces:
  - `Category` = `BaseEntity & { name: string; color: string }`; `parseCategory(input): Category` (zod; name min 1; color default `"#7a766a"`).
  - `CategoryDraft` = `{ name: string; color: string }`; `emptyCategoryDraft(): CategoryDraft`.
  - `categoryById(categories: Category[], id: string | null): Category | undefined`.
  - `categoriesRepo` = `createRepository<Category>("categories", parseCategory)`.

- [ ] **Step 1: Write the failing test — `packages/core/src/domain/category.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { parseCategory, emptyCategoryDraft, categoryById } from "./category";

const base = { ownerId: "u1", createdAt: 1, updatedAt: 1, deletedAt: null };

describe("parseCategory", () => {
  it("accepts a category and defaults the color", () => {
    const c = parseCategory({ id: "cat1", ...base, name: "Travail" });
    expect(c.name).toBe("Travail");
    expect(c.color).toBe("#7a766a");
  });
  it("keeps a provided color", () => {
    const c = parseCategory({ id: "cat1", ...base, name: "Perso", color: "#ff0000" });
    expect(c.color).toBe("#ff0000");
  });
  it("rejects a category without a name", () => {
    expect(() => parseCategory({ id: "cat1", ...base, name: "" })).toThrow();
  });
});

describe("emptyCategoryDraft", () => {
  it("has an empty name and a default color", () => {
    const d = emptyCategoryDraft();
    expect(d.name).toBe("");
    expect(typeof d.color).toBe("string");
  });
});

describe("categoryById", () => {
  const cats = [parseCategory({ id: "cat1", ...base, name: "Travail" })];
  it("finds a category by id", () => {
    expect(categoryById(cats, "cat1")?.name).toBe("Travail");
  });
  it("returns undefined for null or unknown id", () => {
    expect(categoryById(cats, null)).toBeUndefined();
    expect(categoryById(cats, "nope")).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @retrorganizer/core test -- category.test`
Expected: FAIL — module `./category` not found.

- [ ] **Step 3: Implement `packages/core/src/domain/category.ts`**

```ts
import { z } from "zod";

export const categorySchema = z.object({
  id: z.string(),
  ownerId: z.string().min(1),
  createdAt: z.number(),
  updatedAt: z.number(),
  deletedAt: z.number().nullable(),
  name: z.string().min(1),
  color: z.string().default("#7a766a"),
});

export type Category = z.infer<typeof categorySchema>;

export function parseCategory(input: unknown): Category {
  return categorySchema.parse(input);
}

export interface CategoryDraft {
  name: string;
  color: string;
}

export function emptyCategoryDraft(): CategoryDraft {
  return { name: "", color: "#7a766a" };
}

export function categoryById(categories: Category[], id: string | null): Category | undefined {
  if (id === null) return undefined;
  return categories.find((c) => c.id === id);
}
```

- [ ] **Step 4: Implement `packages/core/src/repositories/categories.ts`**

```ts
import { createRepository } from "./base";
import { parseCategory, type Category } from "../domain/category";

export const categoriesRepo = createRepository<Category>("categories", parseCategory);
```

- [ ] **Step 5: Export from `packages/core/src/index.ts`** — add:

```ts
export * from "./domain/category";
export * from "./repositories/categories";
```

- [ ] **Step 6: Run to verify it passes**

Run: `pnpm --filter @retrorganizer/core test -- category.test`
Expected: PASS — 7 tests. Then `pnpm --filter @retrorganizer/core typecheck` → clean.

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/domain/category.ts packages/core/src/domain/category.test.ts packages/core/src/repositories/categories.ts packages/core/src/index.ts
git commit -m "feat(core): Category model (colored) + repo + categoryById"
```

---

### Task 2: `useCategories` hook (web)

**Files:**
- Create: `apps/web/src/categories/useCategories.ts`
- Test: `apps/web/src/categories/useCategories.test.tsx`

**Interfaces:**
- Consumes: `categoriesRepo`, `Category`, `CategoryDraft` (core); `useAuth` (web).
- Produces:
  - `useCategories(): { categories: Category[]; loading: boolean; error: string | null; createCategory(d: CategoryDraft): Promise<string | null>; updateCategory(id: string, patch: Partial<Category>): Promise<void>; removeCategory(id: string): Promise<void>; reload(): Promise<void> }`
  - `createCategory` returns the new category's **id** (so a caller can auto-select it), or `null` on no-uid/failure. Other behavior follows the established hook pattern (load on mount via `listByOwner`; mutations try/catch set error; reload after; null-uid → empty + error cleared). `categoriesRepo.create(ownerId, data)` returns the created `Category` (the generic repo's `create` returns the entity).

- [ ] **Step 1: Write the failing test — `apps/web/src/categories/useCategories.test.tsx`**

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useCategories } from "./useCategories";

const listByOwner = vi.fn();
const create = vi.fn();
vi.mock("@retrorganizer/core", () => ({
  categoriesRepo: {
    listByOwner: (...a: unknown[]) => listByOwner(...a),
    create: (...a: unknown[]) => create(...a),
    update: vi.fn(),
    softDelete: vi.fn(),
  },
}));
let mockUser: { uid: string } | null = { uid: "u1" };
vi.mock("../auth/AuthProvider", () => ({ useAuth: () => ({ user: mockUser }) }));

beforeEach(() => {
  mockUser = { uid: "u1" };
  listByOwner.mockReset().mockResolvedValue([{ id: "cat1", ownerId: "u1", name: "Travail", color: "#f00", createdAt: 1, updatedAt: 1, deletedAt: null }]);
  create.mockReset().mockResolvedValue({ id: "cat2", ownerId: "u1", name: "Perso", color: "#0f0", createdAt: 1, updatedAt: 1, deletedAt: null });
});

describe("useCategories", () => {
  it("loads categories on mount", async () => {
    const { result } = renderHook(() => useCategories());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.categories.map((c) => c.id)).toEqual(["cat1"]);
  });

  it("createCategory returns the new id and reloads", async () => {
    const { result } = renderHook(() => useCategories());
    await waitFor(() => expect(result.current.loading).toBe(false));
    let newId: string | null = null;
    await act(async () => { newId = await result.current.createCategory({ name: "Perso", color: "#0f0" }); });
    expect(newId).toBe("cat2");
    expect(create).toHaveBeenCalledWith("u1", { name: "Perso", color: "#0f0" });
    expect(listByOwner).toHaveBeenCalledTimes(2);
  });

  it("returns empty/not-loading with no user", async () => {
    mockUser = null;
    const { result } = renderHook(() => useCategories());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.categories).toEqual([]);
    expect(listByOwner).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @retrorganizer/web test -- useCategories`
Expected: FAIL — module `./useCategories` not found.

- [ ] **Step 3: Implement `apps/web/src/categories/useCategories.ts`**

```ts
import { useCallback, useEffect, useState } from "react";
import { categoriesRepo, type Category, type CategoryDraft } from "@retrorganizer/core";
import { useAuth } from "../auth/AuthProvider";

export interface UseCategories {
  categories: Category[];
  loading: boolean;
  error: string | null;
  createCategory(d: CategoryDraft): Promise<string | null>;
  updateCategory(id: string, patch: Partial<Category>): Promise<void>;
  removeCategory(id: string): Promise<void>;
  reload(): Promise<void>;
}

export function useCategories(): UseCategories {
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!uid) { setCategories([]); setError(null); setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      setCategories(await categoriesRepo.listByOwner(uid));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Échec du chargement");
    } finally {
      setLoading(false);
    }
  }, [uid]);

  useEffect(() => { void reload(); }, [reload]);

  const createCategory = useCallback(async (d: CategoryDraft): Promise<string | null> => {
    if (!uid) return null;
    let id: string | null = null;
    try {
      const created = await categoriesRepo.create(uid, d);
      id = created.id;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Échec de l'enregistrement");
      return null;
    }
    await reload();
    return id;
  }, [uid, reload]);

  const updateCategory = useCallback(async (id: string, patch: Partial<Category>) => {
    try { await categoriesRepo.update(id, patch); }
    catch (e) { setError(e instanceof Error ? e.message : "Échec de l'enregistrement"); return; }
    await reload();
  }, [reload]);

  const removeCategory = useCallback(async (id: string) => {
    try { await categoriesRepo.softDelete(id); }
    catch (e) { setError(e instanceof Error ? e.message : "Échec de la suppression"); return; }
    await reload();
  }, [reload]);

  return { categories, loading, error, createCategory, updateCategory, removeCategory, reload };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter @retrorganizer/web test -- useCategories`
Expected: PASS — 3 tests. Then full web suite + `pnpm --filter @retrorganizer/web typecheck` → clean.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/categories/useCategories.ts apps/web/src/categories/useCategories.test.tsx
git commit -m "feat(web): useCategories hook (createCategory returns new id)"
```

---

### Task 3: `CategorySelect` + `TagInput` (web)

**Files:**
- Create: `apps/web/src/categories/CategorySelect.tsx`
- Create: `apps/web/src/categories/TagInput.tsx`
- Test: `apps/web/src/categories/CategorySelect.test.tsx`
- Test: `apps/web/src/categories/TagInput.test.tsx`

**Interfaces:**
- Consumes: `tokens` (ui); `categoryById`, `type Category` (core); `useCategories` (Task 2).
- Produces:
  - `CategorySelect`: `<CategorySelect value={string|null} onChange={(id: string|null) => void} />`. Uses `useCategories`. Renders a color dot (the selected category's color, or transparent), a `<select aria-label="Catégorie">` with an `""`→`Aucune` option plus one option per category, and a `+ Catégorie` button that prompts a name (`window.prompt`), calls `createCategory({ name, color })` with a palette color (`CATEGORY_PALETTE[categories.length % CATEGORY_PALETTE.length]`), and on success calls `onChange(newId)`.
  - `TagInput`: `<TagInput value={string[]} onChange={(tags: string[]) => void} />`. An input (`aria-label="Ajouter un tag"`); pressing Enter adds the trimmed value if non-empty and not already present, clears the input; chips render each tag with a remove button (`aria-label="Supprimer le tag {tag}"`).

- [ ] **Step 1: Write the failing tests**

`apps/web/src/categories/CategorySelect.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CategorySelect } from "./CategorySelect";

const createCategory = vi.fn();
vi.mock("./useCategories", () => ({
  useCategories: () => ({
    categories: [{ id: "cat1", ownerId: "u1", name: "Travail", color: "#ff0000", createdAt: 1, updatedAt: 1, deletedAt: null }],
    loading: false, error: null, createCategory, updateCategory: vi.fn(), removeCategory: vi.fn(), reload: vi.fn(),
  }),
}));

beforeEach(() => { createCategory.mockReset().mockResolvedValue("cat2"); });

describe("CategorySelect", () => {
  it("selecting a category fires onChange with its id", () => {
    const onChange = vi.fn();
    render(<CategorySelect value={null} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("Catégorie"), { target: { value: "cat1" } });
    expect(onChange).toHaveBeenCalledWith("cat1");
  });

  it("choosing 'Aucune' fires onChange with null", () => {
    const onChange = vi.fn();
    render(<CategorySelect value="cat1" onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("Catégorie"), { target: { value: "" } });
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("inline-creates a category and selects it", async () => {
    const onChange = vi.fn();
    vi.spyOn(window, "prompt").mockReturnValue("Perso");
    render(<CategorySelect value={null} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "+ Catégorie" }));
    await vi.waitFor(() => expect(createCategory).toHaveBeenCalled());
    expect(createCategory.mock.calls[0]![0]).toMatchObject({ name: "Perso" });
    await vi.waitFor(() => expect(onChange).toHaveBeenCalledWith("cat2"));
  });
});
```

`apps/web/src/categories/TagInput.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TagInput } from "./TagInput";

describe("TagInput", () => {
  it("adds a tag on Enter", () => {
    const onChange = vi.fn();
    render(<TagInput value={[]} onChange={onChange} />);
    const input = screen.getByLabelText("Ajouter un tag");
    fireEvent.change(input, { target: { value: "urgent" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith(["urgent"]);
  });

  it("does not add a duplicate or empty tag", () => {
    const onChange = vi.fn();
    render(<TagInput value={["urgent"]} onChange={onChange} />);
    const input = screen.getByLabelText("Ajouter un tag");
    fireEvent.change(input, { target: { value: "urgent" } });
    fireEvent.keyDown(input, { key: "Enter" });
    fireEvent.change(input, { target: { value: "  " } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("removes a tag", () => {
    const onChange = vi.fn();
    render(<TagInput value={["urgent", "perso"]} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Supprimer le tag urgent" }));
    expect(onChange).toHaveBeenCalledWith(["perso"]);
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm --filter @retrorganizer/web test -- CategorySelect TagInput`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement `apps/web/src/categories/CategorySelect.tsx`**

```tsx
import { tokens } from "@retrorganizer/ui";
import { categoryById } from "@retrorganizer/core";
import { useCategories } from "./useCategories";

const CATEGORY_PALETTE = ["#2f6f4f", "#a8431f", "#1f4e79", "#b8860b", "#5b3a8c", "#9c2b4e", "#0f6e6e", "#6b6b1f"];

export interface CategorySelectProps {
  value: string | null;
  onChange(id: string | null): void;
}

export function CategorySelect({ value, onChange }: CategorySelectProps) {
  const { categories, createCategory } = useCategories();
  const selected = categoryById(categories, value);

  async function addCategory() {
    const name = window.prompt("Nom de la catégorie ?");
    if (!name || name.trim() === "") return;
    const color = CATEGORY_PALETTE[categories.length % CATEGORY_PALETTE.length]!;
    const id = await createCategory({ name: name.trim(), color });
    if (id) onChange(id);
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: tokens.space.xs }}>
      <span aria-hidden style={{ width: 10, height: 10, borderRadius: "50%",
        background: selected?.color ?? "transparent", border: `1px solid ${tokens.color.line}` }} />
      <select aria-label="Catégorie" value={value ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? null : e.target.value)}>
        <option value="">Aucune</option>
        {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      <button type="button" onClick={addCategory}>+ Catégorie</button>
    </div>
  );
}
```

- [ ] **Step 4: Implement `apps/web/src/categories/TagInput.tsx`**

```tsx
import { useState } from "react";
import { tokens } from "@retrorganizer/ui";

export interface TagInputProps {
  value: string[];
  onChange(tags: string[]): void;
}

export function TagInput({ value, onChange }: TagInputProps) {
  const [text, setText] = useState("");

  function add() {
    const tag = text.trim();
    if (tag === "" || value.includes(tag)) { setText(""); return; }
    onChange([...value, tag]);
    setText("");
  }

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: tokens.space.xs, alignItems: "center" }}>
      {value.map((tag) => (
        <span key={tag} style={{ display: "inline-flex", alignItems: "center", gap: 2,
          background: tokens.color.paper, border: `1px solid ${tokens.color.line}`,
          borderRadius: tokens.radius.sm, padding: "0 4px", font: `12px ${tokens.font.body}` }}>
          {tag}
          <button type="button" aria-label={`Supprimer le tag ${tag}`}
            onClick={() => onChange(value.filter((t) => t !== tag))}
            style={{ border: "none", background: "transparent", cursor: "pointer" }}>×</button>
        </span>
      ))}
      <input aria-label="Ajouter un tag" value={text} placeholder="tag…"
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} />
    </div>
  );
}
```

- [ ] **Step 5: Run to verify they pass**

Run: `pnpm --filter @retrorganizer/web test -- CategorySelect TagInput`
Expected: PASS — 3 + 3 tests. Then `pnpm --filter @retrorganizer/web typecheck` → clean.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/categories/CategorySelect.tsx apps/web/src/categories/TagInput.tsx apps/web/src/categories/CategorySelect.test.tsx apps/web/src/categories/TagInput.test.tsx
git commit -m "feat(web): CategorySelect (inline create) + TagInput components"
```

---

### Task 4: Adopt `CategorySelect` + `TagInput` in the entity forms (web)

**Files:**
- Modify: `apps/web/src/contacts/ContactForm.tsx`
- Modify: `apps/web/src/contacts/ContactForm.test.tsx`
- Modify: `apps/web/src/calendar/EventForm.tsx`
- Modify: `apps/web/src/calendar/EventForm.test.tsx`
- Modify: `apps/web/src/tasks/TaskForm.tsx`
- Modify: `apps/web/src/tasks/TaskForm.test.tsx`

**Interfaces:**
- Consumes: `CategorySelect`, `TagInput` (Task 3).
- Produces: each of the three forms renders a **Catégorie** row (`<CategorySelect value={draft.categoryId} onChange={(id) => set("categoryId", id)} />`) and a **Tags** row (`<TagInput value={draft.tags} onChange={(tags) => set("tags", tags)} />`), placed before the submit/cancel buttons. Because `CategorySelect` uses `useCategories` (which hits repos), each form test mocks `../categories/useCategories`.

- [ ] **Step 1: Wire `ContactForm`** — in `apps/web/src/contacts/ContactForm.tsx`, add imports:

```tsx
import { CategorySelect } from "../categories/CategorySelect";
import { TagInput } from "../categories/TagInput";
```

Insert, just before the submit/cancel `<div>`:

```tsx
<label>Catégorie
  <CategorySelect value={draft.categoryId} onChange={(id) => set("categoryId", id)} />
</label>
<label>Tags
  <TagInput value={draft.tags} onChange={(tags) => set("tags", tags)} />
</label>
```

- [ ] **Step 2: Update `ContactForm.test.tsx`** — add the `useCategories` mock near the existing `vi.mock` calls, and add a tag assertion to the existing submit test. Add:

```tsx
vi.mock("../categories/useCategories", () => ({
  useCategories: () => ({ categories: [], loading: false, error: null, createCategory: vi.fn(), updateCategory: vi.fn(), removeCategory: vi.fn(), reload: vi.fn() }),
}));
```

In the existing "submits a draft..." test, after filling the other fields and before clicking Enregistrer, add a tag:

```tsx
fireEvent.change(screen.getByLabelText("Ajouter un tag"), { target: { value: "vip" } });
fireEvent.keyDown(screen.getByLabelText("Ajouter un tag"), { key: "Enter" });
```

and assert on the submitted draft: `expect(draft.tags).toEqual(["vip"]);`

- [ ] **Step 3: Run ContactForm**

Run: `pnpm --filter @retrorganizer/web test -- ContactForm`
Expected: PASS (existing tests + the tag assertion).

- [ ] **Step 4: Wire `EventForm`** — in `apps/web/src/calendar/EventForm.tsx`, add the same imports and insert the same two rows (Catégorie + Tags using `draft.categoryId`/`draft.tags`) just before the submit/cancel `<div>`.

- [ ] **Step 5: Update `EventForm.test.tsx`** — add the same `vi.mock("../categories/useCategories", ...)` block. The existing EventForm tests should still pass (the new rows are additive). Add a tag assertion to the main submit test:

```tsx
fireEvent.change(screen.getByLabelText("Ajouter un tag"), { target: { value: "réu" } });
fireEvent.keyDown(screen.getByLabelText("Ajouter un tag"), { key: "Enter" });
```

and assert `expect(draft.tags).toEqual(["réu"]);` on the submitted draft.

- [ ] **Step 6: Run EventForm**

Run: `pnpm --filter @retrorganizer/web test -- EventForm`
Expected: PASS.

- [ ] **Step 7: Wire `TaskForm`** — in `apps/web/src/tasks/TaskForm.tsx`, add the same imports and insert the same two rows (Catégorie + Tags) just before the submit/cancel `<div>`.

- [ ] **Step 8: Update `TaskForm.test.tsx`** — add the same `vi.mock("../categories/useCategories", ...)` block. Add a tag assertion to the main submit test:

```tsx
fireEvent.change(screen.getByLabelText("Ajouter un tag"), { target: { value: "courses" } });
fireEvent.keyDown(screen.getByLabelText("Ajouter un tag"), { key: "Enter" });
```

and assert `expect(d.tags).toEqual(["courses"]);` on the submitted draft.

- [ ] **Step 9: Run TaskForm + full verification**

Run: `pnpm --filter @retrorganizer/web test -- TaskForm`
Expected: PASS.
Then full web suite `pnpm --filter @retrorganizer/web test` (all green) and `pnpm --filter @retrorganizer/web typecheck` → clean, and `pnpm build` → succeeds.

- [ ] **Step 10: Commit**

```bash
git add apps/web/src/contacts/ContactForm.tsx apps/web/src/contacts/ContactForm.test.tsx apps/web/src/calendar/EventForm.tsx apps/web/src/calendar/EventForm.test.tsx apps/web/src/tasks/TaskForm.tsx apps/web/src/tasks/TaskForm.test.tsx
git commit -m "feat(web): category + tags fields in Contact/Event/Task forms"
```

---

## Définition de « terminé » pour la Phase 5b

- `pnpm exec firebase emulators:exec --only auth,firestore "pnpm test"` : tous les tests verts, incluant la nouvelle suite core (**category**) et web (**useCategories, CategorySelect, TagInput**) et les formulaires mis à jour (Contact/Event/Task).
- `pnpm --filter @retrorganizer/core typecheck` et `pnpm --filter @retrorganizer/web typecheck` propres ; `pnpm build` produit `apps/web/dist`.
- Dans les formulaires Contacts/Calendrier/Tâches : on peut **assigner une catégorie** (avec création inline colorée) et **gérer des tags** (ajout/suppression).

À l'issue de la Phase 5b, restent du transverse : **5c — Corbeille** (restauration/purge des éléments soft-deleted) et **5d — Rappels** (in-app + FCM/Cloud Function différé) pour compléter le MVP 1. Différés notés : **gestionnaire de catégories** (renommer/recolorer/supprimer + nettoyage des `categoryId` orphelins), affichage catégorie/tags dans les **listes** et indexation des tags dans la recherche globale.
