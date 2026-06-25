# Retrorganizer — Phase 5a : Recherche globale — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Livrer la recherche globale : un index client (MiniSearch) sur tous les modules (contacts, événements, tâches, notes), un hook `useGlobalSearch`, et une barre de recherche dans l'en-tête de l'app qui affiche des résultats classés et navigue vers le module concerné.

**Architecture:** La logique pure (extraction de texte, construction des documents indexables, index MiniSearch, recherche) vit dans `packages/core/src/search` (réutilisable RN). `apps/web/src/search/` charge les 4 collections via les repos, construit l'index une fois (mémoïsé), et expose la recherche au composant `GlobalSearchBar` monté dans l'en-tête.

**Tech Stack:** TypeScript strict, **MiniSearch** (NOUVELLE dépendance core — index plein-texte client), React + Vitest + @testing-library/react.

## Global Constraints

- Produit : **Retrorganizer**. TypeScript **strict** (noUncheckedIndexedAccess ON) — dans les TESTS, `const [x] = arr` → `const x = arr[0]!` ; `.mock.calls[0][0]` → `.mock.calls[0]![0] as <Type>` ; ne jamais affaiblir le code de production.
- Aucune app ne parle directement à Firestore — uniquement via `@retrorganizer/core` (les repos).
- L'index est **côté client**, en mémoire, sur les données du seul utilisateur (cf. spec §12.1 « recherche quasi instantanée sur base locale indexée »).
- Le corps des notes est du **JSON Tiptap** : extraire le texte brut via `tiptapToText` avant indexation.
- `packages/core/src/search` reste **plateforme-agnostique** (MiniSearch est isomorphe ; aucun import web).
- Réutiliser : `Contact`, `Event`, `Task`, `Note` (core) ; `contactsRepo`, `eventsRepo`, `tasksRepo`, `notesRepo` ; `tokens` (ui) ; `useAuth` (web).
- Commits fréquents, un par tâche minimum.

## Interfaces héritées (à consommer)

Depuis `@retrorganizer/core` : `Contact` (displayName, organization?, emails[], phones[], notes?), `Event` (title, location, notes), `Task` (title, description), `Note` (title, body Tiptap-JSON) ; repos `contactsRepo`/`eventsRepo`/`tasksRepo`/`notesRepo` (`listByOwner`).
Depuis `apps/web` : `useAuth()` (→ `{ user: { uid } | null }`).
Depuis `@retrorganizer/ui` : `tokens`.

---

### Task 1: Index de recherche globale (core)

**Files:**
- Modify: `packages/core/package.json` (add `minisearch`)
- Create: `packages/core/src/search/globalSearch.ts`
- Modify: `packages/core/src/index.ts` (exporter search/globalSearch)
- Test: `packages/core/src/search/globalSearch.test.ts`

**Interfaces:**
- Consumes: `Contact`, `Event`, `Task`, `Note` (core), `minisearch` (new dep).
- Produces:
  - `tiptapToText(body: unknown): string` — flatten a Tiptap JSON doc to plain text (concat all `text` nodes with spaces).
  - `SearchType` = `"contact" | "event" | "task" | "note"`.
  - `SearchDoc` = `{ id: string; type: SearchType; entityId: string; title: string; text: string; path: string }` (`id` is `"<type>:<entityId>"`, `path` is the section route e.g. `/address`).
  - `SearchData` = `{ contacts: Contact[]; events: Event[]; tasks: Task[]; notes: Note[] }`.
  - `buildSearchDocs(data: SearchData): SearchDoc[]` — one doc per entity with the searchable `title` + concatenated `text` and the right `path` (contacts→`/address`, events→`/diary`, tasks→`/todo`, notes→`/notepad`).
  - `SearchResult` = `{ id: string; type: SearchType; entityId: string; title: string; path: string }`.
  - `buildSearchIndex(docs: SearchDoc[]): MiniSearch<SearchDoc>` — MiniSearch over fields `["title","text"]`, storing `["type","entityId","title","path"]`, with prefix + light fuzzy + title boost.
  - `runSearch(index: MiniSearch<SearchDoc>, query: string): SearchResult[]` — empty/whitespace query → `[]`; else the ranked matches mapped to `SearchResult`.

- [ ] **Step 1: Add the dependency**

Run: `pnpm --filter @retrorganizer/core add minisearch`
Expected: `minisearch` in `packages/core/package.json` deps; root `pnpm-lock.yaml` updated.

- [ ] **Step 2: Write the failing test — `packages/core/src/search/globalSearch.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { tiptapToText, buildSearchDocs, buildSearchIndex, runSearch, type SearchData } from "./globalSearch";
import { parseContact } from "../domain/contact";
import { parseEvent } from "../domain/event";
import { parseTask } from "../domain/task";
import { parseNote } from "../domain/note";

const base = { ownerId: "u1", createdAt: 1, updatedAt: 1, deletedAt: null };

const data: SearchData = {
  contacts: [parseContact({ id: "c1", ...base, displayName: "Ada Lovelace", organization: "Analytical Engines" })],
  events: [parseEvent({ id: "e1", ...base, title: "Réunion budget", start: 1, end: 2 })],
  tasks: [parseTask({ id: "t1", ...base, title: "Acheter du pain", description: "boulangerie" })],
  notes: [parseNote({ id: "n1", ...base, sectionId: "s1", title: "Idées projet", body: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "lancer le prototype" }] }] } })],
};

describe("tiptapToText", () => {
  it("flattens a Tiptap doc to plain text", () => {
    expect(tiptapToText(data.notes[0]!.body)).toContain("lancer le prototype");
  });
  it("returns empty string for an empty doc", () => {
    expect(tiptapToText({ type: "doc", content: [] })).toBe("");
  });
});

describe("buildSearchDocs", () => {
  it("builds one doc per entity with the right type and path", () => {
    const docs = buildSearchDocs(data);
    expect(docs).toHaveLength(4);
    expect(docs.find((d) => d.type === "contact")?.path).toBe("/address");
    expect(docs.find((d) => d.type === "event")?.path).toBe("/diary");
    expect(docs.find((d) => d.type === "task")?.path).toBe("/todo");
    expect(docs.find((d) => d.type === "note")?.path).toBe("/notepad");
    expect(docs.find((d) => d.type === "note")?.text).toContain("lancer le prototype");
  });
});

describe("runSearch", () => {
  const index = buildSearchIndex(buildSearchDocs(data));
  it("returns [] for an empty query", () => {
    expect(runSearch(index, "  ")).toEqual([]);
  });
  it("finds a contact by name across types", () => {
    const r = runSearch(index, "lovelace");
    expect(r.map((x) => x.entityId)).toContain("c1");
    expect(r.find((x) => x.entityId === "c1")?.type).toBe("contact");
  });
  it("finds a note by body text", () => {
    expect(runSearch(index, "prototype").map((x) => x.entityId)).toContain("n1");
  });
  it("finds a task by description", () => {
    expect(runSearch(index, "boulangerie").map((x) => x.entityId)).toContain("t1");
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `pnpm --filter @retrorganizer/core test -- globalSearch`
Expected: FAIL — module `./globalSearch` not found.

- [ ] **Step 4: Implement `packages/core/src/search/globalSearch.ts`**

```ts
import MiniSearch from "minisearch";
import type { Contact } from "../domain/contact";
import type { Event } from "../domain/event";
import type { Task } from "../domain/task";
import type { Note } from "../domain/note";

export function tiptapToText(body: unknown): string {
  const out: string[] = [];
  function walk(node: unknown): void {
    if (!node || typeof node !== "object") return;
    const n = node as { text?: unknown; content?: unknown };
    if (typeof n.text === "string") out.push(n.text);
    if (Array.isArray(n.content)) n.content.forEach(walk);
  }
  walk(body);
  return out.join(" ");
}

export type SearchType = "contact" | "event" | "task" | "note";

export interface SearchDoc {
  id: string;
  type: SearchType;
  entityId: string;
  title: string;
  text: string;
  path: string;
}

export interface SearchData {
  contacts: Contact[];
  events: Event[];
  tasks: Task[];
  notes: Note[];
}

export interface SearchResult {
  id: string;
  type: SearchType;
  entityId: string;
  title: string;
  path: string;
}

export function buildSearchDocs(data: SearchData): SearchDoc[] {
  const docs: SearchDoc[] = [];
  for (const c of data.contacts) {
    docs.push({
      id: `contact:${c.id}`, type: "contact", entityId: c.id, title: c.displayName, path: "/address",
      text: [c.organization ?? "", ...c.emails.map((e) => e.value), ...c.phones.map((p) => p.value), c.notes ?? ""].join(" "),
    });
  }
  for (const e of data.events) {
    docs.push({ id: `event:${e.id}`, type: "event", entityId: e.id, title: e.title, path: "/diary", text: `${e.location} ${e.notes}` });
  }
  for (const t of data.tasks) {
    docs.push({ id: `task:${t.id}`, type: "task", entityId: t.id, title: t.title, path: "/todo", text: t.description });
  }
  for (const n of data.notes) {
    docs.push({ id: `note:${n.id}`, type: "note", entityId: n.id, title: n.title || "(sans titre)", path: "/notepad", text: tiptapToText(n.body) });
  }
  return docs;
}

export function buildSearchIndex(docs: SearchDoc[]): MiniSearch<SearchDoc> {
  const index = new MiniSearch<SearchDoc>({
    fields: ["title", "text"],
    storeFields: ["type", "entityId", "title", "path"],
    searchOptions: { prefix: true, fuzzy: 0.2, boost: { title: 2 } },
  });
  index.addAll(docs);
  return index;
}

export function runSearch(index: MiniSearch<SearchDoc>, query: string): SearchResult[] {
  if (query.trim() === "") return [];
  return index.search(query).map((r) => ({
    id: String(r.id),
    type: r["type"] as SearchType,
    entityId: r["entityId"] as string,
    title: r["title"] as string,
    path: r["path"] as string,
  }));
}
```

- [ ] **Step 5: Export from `packages/core/src/index.ts`** — add:

```ts
export * from "./search/globalSearch";
```

- [ ] **Step 6: Run to verify it passes**

Run: `pnpm --filter @retrorganizer/core test -- globalSearch`
Expected: PASS — 8 tests. Then `pnpm --filter @retrorganizer/core typecheck` → clean.

- [ ] **Step 7: Commit** (from the repo root so the lockfile stages)

```bash
git add packages/core/package.json packages/core/src/search/globalSearch.ts packages/core/src/search/globalSearch.test.ts packages/core/src/index.ts pnpm-lock.yaml
git commit -m "feat(core): global search index (MiniSearch) over all modules"
```

---

### Task 2: `useGlobalSearch` hook (web)

**Files:**
- Create: `apps/web/src/search/useGlobalSearch.ts`
- Test: `apps/web/src/search/useGlobalSearch.test.tsx`

**Interfaces:**
- Consumes: `contactsRepo`, `eventsRepo`, `tasksRepo`, `notesRepo`, `buildSearchDocs`, `buildSearchIndex`, `runSearch`, `type SearchResult` (core); `useAuth` (web).
- Produces:
  - `useGlobalSearch(): { query: string; setQuery(q: string): void; results: SearchResult[]; loading: boolean }`
  - On mount (and uid change), loads the 4 collections via `Promise.all` of `listByOwner(uid)`, builds the docs + index (kept in a ref/state). `results` = `runSearch(index, query)` recomputed when `query` or the index changes (via `useMemo`). null-uid → empty index, `loading` false.

- [ ] **Step 1: Write the failing test — `apps/web/src/search/useGlobalSearch.test.tsx`**

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useGlobalSearch } from "./useGlobalSearch";

const lists = {
  contacts: vi.fn(), events: vi.fn(), tasks: vi.fn(), notes: vi.fn(),
};
vi.mock("@retrorganizer/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@retrorganizer/core")>();
  return {
    ...actual,
    contactsRepo: { listByOwner: (...a: unknown[]) => lists.contacts(...a) },
    eventsRepo: { listByOwner: (...a: unknown[]) => lists.events(...a) },
    tasksRepo: { listByOwner: (...a: unknown[]) => lists.tasks(...a) },
    notesRepo: { listByOwner: (...a: unknown[]) => lists.notes(...a) },
  };
});
vi.mock("../auth/AuthProvider", () => ({ useAuth: () => ({ user: { uid: "u1" } }) }));

const base = { ownerId: "u1", createdAt: 1, updatedAt: 1, deletedAt: null };

beforeEach(() => {
  lists.contacts.mockReset().mockResolvedValue([{ id: "c1", ...base, displayName: "Ada Lovelace", organization: "", emails: [], phones: [], addresses: [], webLinks: [], importantDates: [], customFields: [], categoryId: null, tags: [], firstName: "", lastName: "" }]);
  lists.events.mockReset().mockResolvedValue([]);
  lists.tasks.mockReset().mockResolvedValue([]);
  lists.notes.mockReset().mockResolvedValue([]);
});

describe("useGlobalSearch", () => {
  it("loads all collections and searches the in-memory index", async () => {
    const { result } = renderHook(() => useGlobalSearch());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(lists.contacts).toHaveBeenCalledWith("u1");
    act(() => result.current.setQuery("lovelace"));
    await waitFor(() => expect(result.current.results.map((r) => r.entityId)).toContain("c1"));
  });

  it("returns no results for an empty query", async () => {
    const { result } = renderHook(() => useGlobalSearch());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.results).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @retrorganizer/web test -- useGlobalSearch`
Expected: FAIL — module `./useGlobalSearch` not found.

- [ ] **Step 3: Implement `apps/web/src/search/useGlobalSearch.ts`**

```ts
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  contactsRepo, eventsRepo, tasksRepo, notesRepo,
  buildSearchDocs, buildSearchIndex, runSearch,
  type SearchData, type SearchResult,
} from "@retrorganizer/core";
import { useAuth } from "../auth/AuthProvider";

const EMPTY: SearchData = { contacts: [], events: [], tasks: [], notes: [] };

export interface UseGlobalSearch {
  query: string;
  setQuery(q: string): void;
  results: SearchResult[];
  loading: boolean;
}

export function useGlobalSearch(): UseGlobalSearch {
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  const [data, setData] = useState<SearchData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  const reload = useCallback(async () => {
    if (!uid) { setData(EMPTY); setLoading(false); return; }
    setLoading(true);
    try {
      const [contacts, events, tasks, notes] = await Promise.all([
        contactsRepo.listByOwner(uid), eventsRepo.listByOwner(uid),
        tasksRepo.listByOwner(uid), notesRepo.listByOwner(uid),
      ]);
      setData({ contacts, events, tasks, notes });
    } catch {
      setData(EMPTY);
    } finally {
      setLoading(false);
    }
  }, [uid]);

  useEffect(() => { void reload(); }, [reload]);

  const index = useMemo(() => buildSearchIndex(buildSearchDocs(data)), [data]);
  const results = useMemo(() => runSearch(index, query), [index, query]);

  return { query, setQuery, results, loading };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter @retrorganizer/web test -- useGlobalSearch`
Expected: PASS — 2 tests. Then full web suite + `pnpm --filter @retrorganizer/web typecheck` → clean.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/search/useGlobalSearch.ts apps/web/src/search/useGlobalSearch.test.tsx
git commit -m "feat(web): useGlobalSearch hook (loads all modules + in-memory index)"
```

---

### Task 3: `GlobalSearchBar` + header wiring (web)

**Files:**
- Create: `apps/web/src/search/GlobalSearchBar.tsx`
- Modify: `apps/web/src/App.tsx` (add the search bar to the header)
- Modify: `apps/web/src/App.test.tsx` (stub `GlobalSearchBar`)
- Test: `apps/web/src/search/GlobalSearchBar.test.tsx`

**Interfaces:**
- Consumes: `tokens` (ui); `useGlobalSearch` (Task 2); `useNavigate` (react-router-dom); `type SearchType` (core).
- Produces:
  - `GlobalSearchBar`: a header search `<input aria-label="Recherche globale">` bound to `useGlobalSearch`. When there are results, renders a dropdown list of clickable result rows (each shows a type label + title); clicking a row calls `navigate(result.path)`, clears the query, and blurs. Shows nothing when the query is empty.
  - `App.tsx`: the header renders `<GlobalSearchBar />` between the wordmark and the logout button.
  - `App.test.tsx`: stub `GlobalSearchBar` (it calls `useGlobalSearch` which loads repos → would add async/act noise to the App tests, which only check tabs/wordmark).

- [ ] **Step 1: Write the failing test — `apps/web/src/search/GlobalSearchBar.test.tsx`**

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { GlobalSearchBar } from "./GlobalSearchBar";

const navigate = vi.fn();
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => navigate };
});

let mockResults: { id: string; type: string; entityId: string; title: string; path: string }[] = [];
const setQuery = vi.fn();
vi.mock("./useGlobalSearch", () => ({
  useGlobalSearch: () => ({ query: mockResults.length ? "ada" : "", setQuery, results: mockResults, loading: false }),
}));

beforeEach(() => { navigate.mockReset(); setQuery.mockReset(); mockResults = []; });

describe("GlobalSearchBar", () => {
  it("typing calls setQuery", () => {
    render(<MemoryRouter><GlobalSearchBar /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText("Recherche globale"), { target: { value: "ada" } });
    expect(setQuery).toHaveBeenCalledWith("ada");
  });

  it("shows results and navigates on click", () => {
    mockResults = [{ id: "contact:c1", type: "contact", entityId: "c1", title: "Ada Lovelace", path: "/address" }];
    render(<MemoryRouter><GlobalSearchBar /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: /Ada Lovelace/ }));
    expect(navigate).toHaveBeenCalledWith("/address");
    expect(setQuery).toHaveBeenCalledWith("");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @retrorganizer/web test -- GlobalSearchBar`
Expected: FAIL — module `./GlobalSearchBar` not found.

- [ ] **Step 3: Implement `apps/web/src/search/GlobalSearchBar.tsx`**

```tsx
import { useNavigate } from "react-router-dom";
import { tokens } from "@retrorganizer/ui";
import type { SearchType } from "@retrorganizer/core";
import { useGlobalSearch } from "./useGlobalSearch";

const TYPE_LABEL: Record<SearchType, string> = {
  contact: "Contact", event: "Événement", task: "Tâche", note: "Note",
};

export function GlobalSearchBar() {
  const { query, setQuery, results } = useGlobalSearch();
  const navigate = useNavigate();

  function pick(path: string) {
    navigate(path);
    setQuery("");
  }

  return (
    <div style={{ position: "relative", flex: 1, maxWidth: 360, margin: `0 ${tokens.space.md}px` }}>
      <input
        aria-label="Recherche globale"
        placeholder="Rechercher partout…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        style={{ width: "100%", font: `13px ${tokens.font.body}` }}
      />
      {query.trim() !== "" && results.length > 0 && (
        <ul style={{ position: "absolute", left: 0, right: 0, top: "100%", zIndex: 10, listStyle: "none",
          margin: 0, padding: 0, background: tokens.color.surface, border: `1px solid ${tokens.color.line}`,
          maxHeight: 280, overflow: "auto" }}>
          {results.slice(0, 20).map((r) => (
            <li key={r.id}>
              <button type="button" onClick={() => pick(r.path)}
                style={{ display: "flex", gap: tokens.space.sm, width: "100%", textAlign: "left", border: "none",
                  borderBottom: `1px solid ${tokens.color.line}`, background: "transparent", cursor: "pointer",
                  padding: tokens.space.xs, color: tokens.color.ink, font: `12px ${tokens.font.body}` }}>
                <span style={{ color: tokens.color.muted, minWidth: 72 }}>{TYPE_LABEL[r.type]}</span>
                <span>{r.title}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Wire `GlobalSearchBar` into the header in `apps/web/src/App.tsx`**

Add the import:

```tsx
import { GlobalSearchBar } from "./search/GlobalSearchBar";
```

In the `<header>` (which currently holds the `Retrorganizer` wordmark and the logout button), insert `<GlobalSearchBar />` between them. The header's existing structure is:

```tsx
<header style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
  padding: `${tokens.space.xs}px ${tokens.space.md}px`, borderBottom: `1px solid ${tokens.color.line}`,
  font: `13px ${tokens.font.body}` }}>
  <strong style={{ color: tokens.color.ink }}>Retrorganizer</strong>
  <button onClick={() => signOut()}>Déconnexion</button>
</header>
```

Change it to place the search bar in the middle:

```tsx
<header style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
  padding: `${tokens.space.xs}px ${tokens.space.md}px`, borderBottom: `1px solid ${tokens.color.line}`,
  font: `13px ${tokens.font.body}` }}>
  <strong style={{ color: tokens.color.ink }}>Retrorganizer</strong>
  <GlobalSearchBar />
  <button onClick={() => signOut()}>Déconnexion</button>
</header>
```

- [ ] **Step 5: Stub `GlobalSearchBar` in `apps/web/src/App.test.tsx`**

The App tests render the header, which now mounts `GlobalSearchBar` → `useGlobalSearch` → repo loads (async). Stub it to keep the App tests focused and stderr pristine. Add near the other `vi.mock` calls:

```tsx
vi.mock("./search/GlobalSearchBar", () => ({
  GlobalSearchBar: () => <div data-testid="global-search" />,
}));
```

- [ ] **Step 6: Run to verify it passes**

Run: `pnpm --filter @retrorganizer/web test -- GlobalSearchBar`
Expected: PASS — 2 tests.
Then full web suite `pnpm --filter @retrorganizer/web test` (App.test still green + pristine) and `pnpm --filter @retrorganizer/web typecheck` → clean.

- [ ] **Step 7: Build verification**

Run: `pnpm build`
Expected: succeeds; `apps/web/dist` produced.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/search/GlobalSearchBar.tsx apps/web/src/search/GlobalSearchBar.test.tsx apps/web/src/App.tsx apps/web/src/App.test.tsx
git commit -m "feat(web): global search bar in the app header"
```

---

## Définition de « terminé » pour la Phase 5a

- `pnpm exec firebase emulators:exec --only auth,firestore "pnpm test"` : tous les tests verts, incluant la nouvelle suite core (**globalSearch**) et web (**useGlobalSearch, GlobalSearchBar**).
- `pnpm --filter @retrorganizer/core typecheck` et `pnpm --filter @retrorganizer/web typecheck` propres ; `pnpm build` produit `apps/web/dist`.
- L'en-tête de l'app affiche une barre de **recherche globale** : taper une requête liste des résultats classés tous modules confondus (contacts, événements, tâches, notes) ; cliquer navigue vers l'onglet du module.

À l'issue de la Phase 5a, restent du transverse : **5b — Catégories/couleurs/tags**, **5c — Corbeille** (restauration/purge), **5d — Rappels** (in-app + FCM/Cloud Function différé). Améliorations notées : deep-link vers l'entité précise (au-delà de l'onglet), et debounce de la recherche si le volume grandit.
