# Retrorganizer — Phase 4 : Notes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Livrer le module Notes : carnets (`NoteSection`), notes à corps riche (Tiptap, stocké en JSON), hook `useNotes`, éditeur `NoteEditor`, et `NotesModule` (sidebar carnets + liste de notes + éditeur) — branché sur l'onglet Notepad.

**Architecture:** Les modèles purs (Note, NoteSection, drafts) vivent dans `packages/core`. `apps/web/src/notes/` consomme `notesRepo`/`noteSectionsRepo` via `useNotes` et rend l'UI. L'éditeur riche est un wrapper Tiptap (`@tiptap/react` + StarterKit) dont le corps est sérialisé en JSON (`editor.getJSON()`), stocké tel quel dans Firestore (objet imbriqué plain).

**Tech Stack:** TypeScript strict, zod, Firestore via `createRepository`, React + Vitest + @testing-library/react, **Tiptap** (`@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/pm` — NOUVELLES dépendances).

## Global Constraints

- Produit : **Retrorganizer**. TypeScript **strict** (noUncheckedIndexedAccess ON) — dans les TESTS, `const [x] = arr` → `const x = arr[0]!` ; `.mock.calls[0][0]` → `.mock.calls[0]![0] as <Type>` ; ne jamais affaiblir le code de production.
- Aucune app ne parle directement à Firestore — uniquement via `@retrorganizer/core` (`notesRepo`/`noteSectionsRepo`).
- Soft-delete uniquement (`deletedAt`) ; `listByOwner` exclut déjà les supprimés.
- Le **corps de note** est du **JSON Tiptap** (`{ type: "doc", content: [...] }`), stocké tel quel (objet plain compatible Firestore). Modèle `Note` aplati (`z.infer`, pas de `& BaseEntity`, pas de cast) — convention établie.
- Couleur d'accent du module Notepad : `moduleAccent.notepad` (`@retrorganizer/ui`).
- Tiptap en test (jsdom) : `useEditor({ ..., immediatelyRender: false })` pour éviter les erreurs SSR/hydration. Le test de `NoteEditor` vérifie le rendu de la toolbar (boutons) ; le test de `NotesModule` **mocke** `./NoteEditor` pour rester stable et hors-Tiptap.
- Réutiliser : `BaseEntity`, `createRepository`, `tokens`/`moduleAccent`.
- Commits fréquents, un par tâche minimum.

## Interfaces héritées (à consommer)

Depuis `@retrorganizer/core` : `BaseEntity`, `createRepository<T>(name, parse)`.
Depuis `apps/web` : `useAuth()` (→ `{ user: { uid } | null }`).
Depuis `@retrorganizer/ui` : `tokens`, `moduleAccent`.

---

### Task 1: Modèles `Note` + `NoteSection` + repos (core)

**Files:**
- Create: `packages/core/src/domain/note.ts`
- Create: `packages/core/src/repositories/notes.ts`
- Create: `packages/core/src/repositories/noteSections.ts`
- Modify: `packages/core/src/index.ts` (exporter note + repos)
- Test: `packages/core/src/domain/note.test.ts`

**Interfaces:**
- Consumes: `BaseEntity`, `createRepository` (Phase 0).
- Produces:
  - `emptyDoc(): { type: "doc"; content: [] }` — corps Tiptap vide (fonction, renvoie un nouvel objet).
  - `NoteSection` = `BaseEntity & { name: string; order: number }`; `parseNoteSection(input): NoteSection`.
  - `Note` = `BaseEntity & { sectionId: string; title: string; body: unknown; linkedEntities: { type: string; id: string }[]; tags: string[] }`; `parseNote(input): Note` (zod ; `body` défaut `emptyDoc()`).
  - `NoteDraft` = `{ sectionId, title, body, linkedEntities, tags }`; `emptyNoteDraft(sectionId: string): NoteDraft`; `draftFromNote(n: Note): NoteDraft`.
  - `NoteSectionDraft` = `{ name, order }`; `emptyNoteSectionDraft(): NoteSectionDraft`.
  - `notesRepo` = `createRepository<Note>("notes", parseNote)`; `noteSectionsRepo` = `createRepository<NoteSection>("noteSections", parseNoteSection)`.

- [ ] **Step 1: Write the failing test — `packages/core/src/domain/note.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { parseNote, parseNoteSection, emptyNoteDraft, draftFromNote, emptyDoc } from "./note";

describe("parseNoteSection", () => {
  it("accepts a section and defaults order", () => {
    const s = parseNoteSection({ id: "s1", ownerId: "u1", createdAt: 1, updatedAt: 1, deletedAt: null, name: "Travail" });
    expect(s.name).toBe("Travail");
    expect(s.order).toBe(0);
  });
  it("rejects a section without a name", () => {
    expect(() => parseNoteSection({ id: "s1", ownerId: "u1", createdAt: 1, updatedAt: 1, deletedAt: null, name: "" })).toThrow();
  });
});

describe("parseNote", () => {
  it("accepts a note and defaults body to an empty doc", () => {
    const n = parseNote({ id: "n1", ownerId: "u1", createdAt: 1, updatedAt: 1, deletedAt: null, sectionId: "s1" });
    expect(n.sectionId).toBe("s1");
    expect(n.title).toBe("");
    expect(n.body).toEqual({ type: "doc", content: [] });
    expect(n.linkedEntities).toEqual([]);
  });
  it("keeps a provided rich body", () => {
    const body = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Bonjour" }] }] };
    const n = parseNote({ id: "n1", ownerId: "u1", createdAt: 1, updatedAt: 1, deletedAt: null, sectionId: "s1", body });
    expect(n.body).toEqual(body);
  });
});

describe("note drafts", () => {
  it("emptyNoteDraft carries the section and a fresh empty doc", () => {
    const d = emptyNoteDraft("s1");
    expect(d.sectionId).toBe("s1");
    expect(d.body).toEqual({ type: "doc", content: [] });
    expect(emptyDoc()).not.toBe(emptyDoc()); // fresh object each call
  });
  it("draftFromNote deep-copies linkedEntities", () => {
    const n = parseNote({ id: "n1", ownerId: "u1", createdAt: 1, updatedAt: 1, deletedAt: null, sectionId: "s1", linkedEntities: [{ type: "contact", id: "c1" }] });
    const d = draftFromNote(n);
    d.linkedEntities.push({ type: "event", id: "e1" });
    expect(n.linkedEntities).toEqual([{ type: "contact", id: "c1" }]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @retrorganizer/core test -- note.test`
Expected: FAIL — module `./note` not found.

- [ ] **Step 3: Implement `packages/core/src/domain/note.ts`**

```ts
import { z } from "zod";

export function emptyDoc(): { type: "doc"; content: [] } {
  return { type: "doc", content: [] };
}

export const noteSectionSchema = z.object({
  id: z.string(),
  ownerId: z.string().min(1),
  createdAt: z.number(),
  updatedAt: z.number(),
  deletedAt: z.number().nullable(),
  name: z.string().min(1),
  order: z.number().default(0),
});
export type NoteSection = z.infer<typeof noteSectionSchema>;
export function parseNoteSection(input: unknown): NoteSection {
  return noteSectionSchema.parse(input);
}

const linkedEntity = z.object({ type: z.string(), id: z.string() });

export const noteSchema = z.object({
  id: z.string(),
  ownerId: z.string().min(1),
  createdAt: z.number(),
  updatedAt: z.number(),
  deletedAt: z.number().nullable(),
  sectionId: z.string(),
  title: z.string().default(""),
  body: z.any().default(() => emptyDoc()),
  linkedEntities: z.array(linkedEntity).default([]),
  tags: z.array(z.string()).default([]),
});
export type Note = z.infer<typeof noteSchema>;
export function parseNote(input: unknown): Note {
  return noteSchema.parse(input);
}

export interface NoteDraft {
  sectionId: string;
  title: string;
  body: unknown;
  linkedEntities: { type: string; id: string }[];
  tags: string[];
}

export function emptyNoteDraft(sectionId: string): NoteDraft {
  return { sectionId, title: "", body: emptyDoc(), linkedEntities: [], tags: [] };
}

export function draftFromNote(n: Note): NoteDraft {
  return {
    sectionId: n.sectionId,
    title: n.title,
    body: n.body,
    linkedEntities: n.linkedEntities.map((l) => ({ ...l })),
    tags: [...n.tags],
  };
}

export interface NoteSectionDraft {
  name: string;
  order: number;
}
export function emptyNoteSectionDraft(): NoteSectionDraft {
  return { name: "", order: 0 };
}
```

- [ ] **Step 4: Implement the repositories**

`packages/core/src/repositories/notes.ts`:

```ts
import { createRepository } from "./base";
import { parseNote, type Note } from "../domain/note";

export const notesRepo = createRepository<Note>("notes", parseNote);
```

`packages/core/src/repositories/noteSections.ts`:

```ts
import { createRepository } from "./base";
import { parseNoteSection, type NoteSection } from "../domain/note";

export const noteSectionsRepo = createRepository<NoteSection>("noteSections", parseNoteSection);
```

- [ ] **Step 5: Export from `packages/core/src/index.ts`** — add:

```ts
export * from "./domain/note";
export * from "./repositories/notes";
export * from "./repositories/noteSections";
```

- [ ] **Step 6: Run to verify it passes**

Run: `pnpm --filter @retrorganizer/core test -- note.test`
Expected: PASS — 6 tests. Then `pnpm --filter @retrorganizer/core typecheck` → clean.

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/domain/note.ts packages/core/src/domain/note.test.ts packages/core/src/repositories/notes.ts packages/core/src/repositories/noteSections.ts packages/core/src/index.ts
git commit -m "feat(core): Note + NoteSection models (Tiptap-JSON body), repos"
```

---

### Task 2: `useNotes` hook (web)

**Files:**
- Create: `apps/web/src/notes/useNotes.ts`
- Test: `apps/web/src/notes/useNotes.test.tsx`

**Interfaces:**
- Consumes: `notesRepo`, `noteSectionsRepo`, `Note`, `NoteSection`, `NoteDraft`, `NoteSectionDraft` (core); `useAuth` (web).
- Produces:
  - `useNotes(): { sections: NoteSection[]; notes: Note[]; loading: boolean; error: string | null; createSection(d: NoteSectionDraft): Promise<void>; removeSection(id: string): Promise<void>; createNote(d: NoteDraft): Promise<void>; updateNote(id: string, patch: Partial<Note>): Promise<void>; removeNote(id: string): Promise<void>; reload(): Promise<void> }`
  - `reload` loads BOTH `noteSectionsRepo.listByOwner(uid)` and `notesRepo.listByOwner(uid)` (in parallel via `Promise.all`). Mutations wrapped in try/catch that set `error`, then `reload()` OUTSIDE the try/catch (the established pattern). null-uid → both empty, loading false, error cleared.

- [ ] **Step 1: Write the failing test — `apps/web/src/notes/useNotes.test.tsx`**

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useNotes } from "./useNotes";

const sectionsList = vi.fn();
const notesList = vi.fn();
const createNote = vi.fn();
vi.mock("@retrorganizer/core", () => ({
  noteSectionsRepo: { listByOwner: (...a: unknown[]) => sectionsList(...a), create: vi.fn(), softDelete: vi.fn() },
  notesRepo: { listByOwner: (...a: unknown[]) => notesList(...a), create: (...a: unknown[]) => createNote(...a), update: vi.fn(), softDelete: vi.fn() },
}));
let mockUser: { uid: string } | null = { uid: "u1" };
vi.mock("../auth/AuthProvider", () => ({ useAuth: () => ({ user: mockUser }) }));

beforeEach(() => {
  mockUser = { uid: "u1" };
  sectionsList.mockReset().mockResolvedValue([{ id: "s1", ownerId: "u1", name: "Travail", order: 0, createdAt: 1, updatedAt: 1, deletedAt: null }]);
  notesList.mockReset().mockResolvedValue([{ id: "n1", ownerId: "u1", sectionId: "s1", title: "Note A", body: { type: "doc", content: [] }, linkedEntities: [], tags: [], createdAt: 1, updatedAt: 1, deletedAt: null }]);
  createNote.mockReset().mockResolvedValue(undefined);
});

describe("useNotes", () => {
  it("loads sections and notes on mount", async () => {
    const { result } = renderHook(() => useNotes());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.sections.map((s) => s.id)).toEqual(["s1"]);
    expect(result.current.notes.map((n) => n.id)).toEqual(["n1"]);
  });

  it("createNote calls repo then reloads", async () => {
    const { result } = renderHook(() => useNotes());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.createNote({ sectionId: "s1", title: "B", body: { type: "doc", content: [] }, linkedEntities: [], tags: [] }); });
    expect(createNote).toHaveBeenCalledWith("u1", expect.objectContaining({ sectionId: "s1", title: "B" }));
    expect(notesList).toHaveBeenCalledTimes(2);
  });

  it("returns empty/not-loading with no user", async () => {
    mockUser = null;
    const { result } = renderHook(() => useNotes());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.sections).toEqual([]);
    expect(result.current.notes).toEqual([]);
    expect(sectionsList).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @retrorganizer/web test -- useNotes`
Expected: FAIL — module `./useNotes` not found.

- [ ] **Step 3: Implement `apps/web/src/notes/useNotes.ts`**

```ts
import { useCallback, useEffect, useState } from "react";
import {
  notesRepo, noteSectionsRepo,
  type Note, type NoteSection, type NoteDraft, type NoteSectionDraft,
} from "@retrorganizer/core";
import { useAuth } from "../auth/AuthProvider";

export interface UseNotes {
  sections: NoteSection[];
  notes: Note[];
  loading: boolean;
  error: string | null;
  createSection(d: NoteSectionDraft): Promise<void>;
  removeSection(id: string): Promise<void>;
  createNote(d: NoteDraft): Promise<void>;
  updateNote(id: string, patch: Partial<Note>): Promise<void>;
  removeNote(id: string): Promise<void>;
  reload(): Promise<void>;
}

export function useNotes(): UseNotes {
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  const [sections, setSections] = useState<NoteSection[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!uid) { setSections([]); setNotes([]); setError(null); setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const [s, n] = await Promise.all([noteSectionsRepo.listByOwner(uid), notesRepo.listByOwner(uid)]);
      setSections(s);
      setNotes(n);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Échec du chargement");
    } finally {
      setLoading(false);
    }
  }, [uid]);

  useEffect(() => { void reload(); }, [reload]);

  const createSection = useCallback(async (d: NoteSectionDraft) => {
    if (!uid) return;
    try { await noteSectionsRepo.create(uid, d); }
    catch (e) { setError(e instanceof Error ? e.message : "Échec de l'enregistrement"); return; }
    await reload();
  }, [uid, reload]);

  const removeSection = useCallback(async (id: string) => {
    try { await noteSectionsRepo.softDelete(id); }
    catch (e) { setError(e instanceof Error ? e.message : "Échec de la suppression"); return; }
    await reload();
  }, [reload]);

  const createNote = useCallback(async (d: NoteDraft) => {
    if (!uid) return;
    try { await notesRepo.create(uid, d); }
    catch (e) { setError(e instanceof Error ? e.message : "Échec de l'enregistrement"); return; }
    await reload();
  }, [uid, reload]);

  const updateNote = useCallback(async (id: string, patch: Partial<Note>) => {
    try { await notesRepo.update(id, patch); }
    catch (e) { setError(e instanceof Error ? e.message : "Échec de l'enregistrement"); return; }
    await reload();
  }, [reload]);

  const removeNote = useCallback(async (id: string) => {
    try { await notesRepo.softDelete(id); }
    catch (e) { setError(e instanceof Error ? e.message : "Échec de la suppression"); return; }
    await reload();
  }, [reload]);

  return { sections, notes, loading, error, createSection, removeSection, createNote, updateNote, removeNote, reload };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter @retrorganizer/web test -- useNotes`
Expected: PASS — 3 tests. Then full web suite + `pnpm --filter @retrorganizer/web typecheck` → clean.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/notes/useNotes.ts apps/web/src/notes/useNotes.test.tsx
git commit -m "feat(web): useNotes hook (sections + notes)"
```

---

### Task 3: `NoteEditor` Tiptap (web)

**Files:**
- Modify: `apps/web/package.json` (add @tiptap deps)
- Create: `apps/web/src/notes/NoteEditor.tsx`
- Test: `apps/web/src/notes/NoteEditor.test.tsx`

**Interfaces:**
- Consumes: `tokens` (ui); `@tiptap/react`, `@tiptap/starter-kit`.
- Produces:
  - `NoteEditor`: `<NoteEditor value onChange />` where `value: unknown` is a Tiptap JSON doc and `onChange(json: unknown)` fires on edits. Renders a toolbar with buttons (aria-labels: "Gras", "Italique", "Liste à puces", "Liste numérotée", "Titre") that toggle marks/nodes via the editor, and an `<EditorContent>` editable region. Uses `immediatelyRender: false`.

- [ ] **Step 1: Add the dependencies**

Run: `pnpm --filter @retrorganizer/web add @tiptap/react @tiptap/starter-kit @tiptap/pm`
Expected: the three packages appear in `apps/web/package.json` dependencies; root `pnpm-lock.yaml` updated.

- [ ] **Step 2: Write the failing test — `apps/web/src/notes/NoteEditor.test.tsx`**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { NoteEditor } from "./NoteEditor";

const DOC = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Bonjour" }] }] };

describe("NoteEditor", () => {
  it("renders the formatting toolbar", () => {
    render(<NoteEditor value={DOC} onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Gras" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Italique" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Liste à puces" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Liste numérotée" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Titre" })).toBeInTheDocument();
  });

  it("mounts an editable region with the initial content", async () => {
    const { container } = render(<NoteEditor value={DOC} onChange={vi.fn()} />);
    await waitFor(() => expect(container.querySelector('[contenteditable="true"]')).toBeTruthy());
    expect(container.textContent).toContain("Bonjour");
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `pnpm --filter @retrorganizer/web test -- NoteEditor`
Expected: FAIL — module `./NoteEditor` not found.

- [ ] **Step 4: Implement `apps/web/src/notes/NoteEditor.tsx`**

```tsx
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { tokens } from "@retrorganizer/ui";

export interface NoteEditorProps {
  value: unknown;
  onChange(json: unknown): void;
}

export function NoteEditor({ value, onChange }: NoteEditorProps) {
  const editor = useEditor({
    extensions: [StarterKit],
    content: (value as object) ?? { type: "doc", content: [] },
    immediatelyRender: false,
    onUpdate: ({ editor }) => onChange(editor.getJSON()),
  });

  function btn(label: string, active: boolean, action: () => void) {
    return (
      <button type="button" aria-label={label} onMouseDown={(e) => e.preventDefault()} onClick={action}
        style={{ fontWeight: active ? "bold" : "normal", marginRight: tokens.space.xs }}>
        {label}
      </button>
    );
  }

  return (
    <div style={{ border: `1px solid ${tokens.color.line}`, background: tokens.color.surface }}>
      <div style={{ display: "flex", flexWrap: "wrap", padding: tokens.space.xs, borderBottom: `1px solid ${tokens.color.line}`, font: `12px ${tokens.font.body}` }}>
        {btn("Gras", !!editor?.isActive("bold"), () => editor?.chain().focus().toggleBold().run())}
        {btn("Italique", !!editor?.isActive("italic"), () => editor?.chain().focus().toggleItalic().run())}
        {btn("Liste à puces", !!editor?.isActive("bulletList"), () => editor?.chain().focus().toggleBulletList().run())}
        {btn("Liste numérotée", !!editor?.isActive("orderedList"), () => editor?.chain().focus().toggleOrderedList().run())}
        {btn("Titre", !!editor?.isActive("heading", { level: 2 }), () => editor?.chain().focus().toggleHeading({ level: 2 }).run())}
      </div>
      <div style={{ padding: tokens.space.sm }}>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `pnpm --filter @retrorganizer/web test -- NoteEditor`
Expected: PASS — 2 tests. Then full web suite + `pnpm --filter @retrorganizer/web typecheck` → clean.

> Note exécutant : si le second test (rendu de "Bonjour") s'avère instable en jsdom avec `immediatelyRender: false`, garde le `waitFor` sur le `[contenteditable="true"]` — Tiptap monte l'éditeur dans un effet. Ne PAS changer la signature ni la toolbar. Le `onMouseDown` preventDefault évite que le bouton vole le focus à l'éditeur (comportement standard d'une toolbar Tiptap).

- [ ] **Step 6: Commit**

```bash
git add apps/web/package.json apps/web/src/notes/NoteEditor.tsx apps/web/src/notes/NoteEditor.test.tsx pnpm-lock.yaml
git commit -m "feat(web): NoteEditor (Tiptap rich text with formatting toolbar)"
```

> Note: run the commit from the repo root so `pnpm-lock.yaml` (root) is staged correctly.

---

### Task 4: `NotesModule` + route Notepad (web)

**Files:**
- Create: `apps/web/src/notes/NotesModule.tsx`
- Modify: `apps/web/src/App.tsx` (route `notepad` → `NotesModule`)
- Test: `apps/web/src/notes/NotesModule.test.tsx`

**Interfaces:**
- Consumes: `tokens`/`moduleAccent` (ui); `useNotes` (Task 2); `emptyNoteDraft`, `draftFromNote`, `emptyNoteSectionDraft`, `type Note`, `type NoteDraft` (core); `NoteEditor` (Task 3).
- Produces:
  - `NotesModule`: `<NotesModule />`. Holds `selectedSectionId: string | null`, `selectedNoteId: string | null`, and an in-progress note draft. Left sidebar: list of `sections` (click selects; `+ Carnet` prompts a name and `createSection`). Middle: notes in the selected section (`notes.filter(n => n.sectionId === selectedSectionId)`), `+ Note` creates an empty note in that section. Right: when a note is selected, a title input + `<NoteEditor key={selectedNoteId} value onChange />` + `Enregistrer` (calls `updateNote(id, { title, body })`) + `Supprimer` (`removeNote`). The `NotesModule` test MOCKS `./NoteEditor` (avoids Tiptap in jsdom). Wires `App.tsx` route `notepad` → `<NotesModule />`.

- [ ] **Step 1: Write the failing test — `apps/web/src/notes/NotesModule.test.tsx`**

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { NotesModule } from "./NotesModule";

const createNote = vi.fn();
const updateNote = vi.fn();
let state: { sections: unknown[]; notes: unknown[] };
vi.mock("./useNotes", () => ({
  useNotes: () => ({
    sections: state.sections, notes: state.notes, loading: false, error: null,
    createSection: vi.fn(), removeSection: vi.fn(),
    createNote: (...a: unknown[]) => createNote(...a),
    updateNote: (...a: unknown[]) => updateNote(...a),
    removeNote: vi.fn(), reload: vi.fn(),
  }),
}));
vi.mock("./NoteEditor", () => ({
  NoteEditor: ({ value }: { value: unknown }) => <div data-testid="note-editor">{JSON.stringify(value)}</div>,
}));

const note = (id: string, sectionId: string, title: string) => ({
  id, ownerId: "u1", sectionId, title, body: { type: "doc", content: [] }, linkedEntities: [], tags: [], createdAt: 1, updatedAt: 1, deletedAt: null,
});

beforeEach(() => {
  createNote.mockReset().mockResolvedValue(undefined);
  updateNote.mockReset().mockResolvedValue(undefined);
  state = {
    sections: [{ id: "s1", ownerId: "u1", name: "Travail", order: 0, createdAt: 1, updatedAt: 1, deletedAt: null }],
    notes: [note("n1", "s1", "Note A")],
  };
});

describe("NotesModule", () => {
  it("lists sections and the notes of the selected section", async () => {
    render(<NotesModule />);
    await waitFor(() => expect(screen.getByText("Travail")).toBeInTheDocument());
    // first section auto-selected → its note shows
    expect(screen.getByRole("button", { name: /Note A/ })).toBeInTheDocument();
  });

  it("opens a note in the editor and saves edits", async () => {
    render(<NotesModule />);
    await waitFor(() => expect(screen.getByRole("button", { name: /Note A/ })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /Note A/ }));
    expect(screen.getByTestId("note-editor")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Titre de la note"), { target: { value: "Note A modifiée" } });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    await waitFor(() => expect(updateNote).toHaveBeenCalledTimes(1));
    expect(updateNote.mock.calls[0]![0]).toBe("n1");
    expect((updateNote.mock.calls[0]![1] as { title: string }).title).toBe("Note A modifiée");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @retrorganizer/web test -- NotesModule`
Expected: FAIL — module `./NotesModule` not found.

- [ ] **Step 3: Implement `apps/web/src/notes/NotesModule.tsx`**

```tsx
import { useEffect, useState } from "react";
import { tokens, moduleAccent } from "@retrorganizer/ui";
import { emptyNoteDraft, draftFromNote, type Note, type NoteDraft } from "@retrorganizer/core";
import { useNotes } from "./useNotes";
import { NoteEditor } from "./NoteEditor";

export function NotesModule() {
  const { sections, notes, loading, error, createSection, createNote, updateNote, removeNote } = useNotes();
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [draft, setDraft] = useState<NoteDraft | null>(null);

  // auto-select the first section once loaded
  useEffect(() => {
    if (selectedSectionId === null && sections.length > 0) setSelectedSectionId(sections[0]!.id);
  }, [sections, selectedSectionId]);

  const sectionNotes = notes.filter((n) => n.sectionId === selectedSectionId);

  function openNote(n: Note) {
    setSelectedNoteId(n.id);
    setDraft(draftFromNote(n));
  }
  async function newNote() {
    if (!selectedSectionId) return;
    await createNote(emptyNoteDraft(selectedSectionId));
  }
  async function addSection() {
    const name = window.prompt("Nom du carnet ?");
    if (name && name.trim() !== "") await createSection({ name: name.trim(), order: sections.length });
  }
  async function save() {
    if (!selectedNoteId || !draft) return;
    await updateNote(selectedNoteId, { title: draft.title, body: draft.body });
  }
  async function del() {
    if (!selectedNoteId) return;
    await removeNote(selectedNoteId);
    setSelectedNoteId(null);
    setDraft(null);
  }

  if (loading) return <div style={{ padding: tokens.space.lg }}>Chargement…</div>;

  return (
    <div style={{ display: "flex", height: "100%", font: `13px ${tokens.font.body}` }}>
      <nav style={{ width: 140, borderRight: `1px solid ${tokens.color.line}`, padding: tokens.space.xs }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: tokens.space.xs }}>
          <strong>Carnets</strong>
          <button type="button" onClick={addSection} aria-label="Ajouter un carnet">+ Carnet</button>
        </div>
        {sections.map((s) => (
          <button key={s.id} type="button" onClick={() => { setSelectedSectionId(s.id); setSelectedNoteId(null); setDraft(null); }}
            style={{ display: "block", width: "100%", textAlign: "left", border: "none",
              borderLeft: `3px solid ${selectedSectionId === s.id ? moduleAccent.notepad : "transparent"}`,
              background: "transparent", cursor: "pointer", padding: tokens.space.xs, color: tokens.color.ink }}>
            {s.name}
          </button>
        ))}
      </nav>

      <div style={{ width: 180, borderRight: `1px solid ${tokens.color.line}`, padding: tokens.space.xs }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: tokens.space.xs }}>
          <strong>Notes</strong>
          {selectedSectionId && <button type="button" onClick={newNote}>+ Note</button>}
        </div>
        {sectionNotes.map((n) => (
          <button key={n.id} type="button" onClick={() => openNote(n)}
            style={{ display: "block", width: "100%", textAlign: "left", border: "none",
              borderBottom: `1px solid ${tokens.color.line}`, background: selectedNoteId === n.id ? tokens.color.surface : "transparent",
              cursor: "pointer", padding: tokens.space.xs, color: tokens.color.ink }}>
            {n.title || "(sans titre)"}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, padding: tokens.space.sm }}>
        {error && <p role="alert" style={{ color: "#a8431f" }}>{error}</p>}
        {draft && selectedNoteId ? (
          <div style={{ display: "grid", gap: tokens.space.sm }}>
            <input aria-label="Titre de la note" value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              style={{ font: `16px ${tokens.font.body}` }} placeholder="Titre" />
            <NoteEditor key={selectedNoteId} value={draft.body} onChange={(body) => setDraft((d) => (d ? { ...d, body } : d))} />
            <div style={{ display: "flex", gap: tokens.space.sm }}>
              <button type="button" onClick={save}>Enregistrer</button>
              <button type="button" onClick={del}>Supprimer</button>
            </div>
          </div>
        ) : (
          <p style={{ color: tokens.color.muted }}>Sélectionnez ou créez une note.</p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Wire the route in `apps/web/src/App.tsx`**

Add the import:

```tsx
import { NotesModule } from "./notes/NotesModule";
```

Then add a `notepad` branch to the route element (keep diary/todo/address branches). Replace:

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

with:

```tsx
element={
  s.id === "diary"
    ? <CalendarModule />
    : s.id === "todo"
      ? <TasksModule />
      : s.id === "address"
        ? <ContactsModule />
        : s.id === "notepad"
          ? <NotesModule />
          : s.mvp
            ? <SectionPlaceholder label={s.label} />
            : <ComingSoon label={s.label} />
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `pnpm --filter @retrorganizer/web test -- NotesModule`
Expected: PASS — 2 tests (lists sections + notes; open + save).
Then full web suite `pnpm --filter @retrorganizer/web test` (App.test still green) and `pnpm --filter @retrorganizer/web typecheck` → clean.

- [ ] **Step 6: Build verification**

Run: `pnpm build`
Expected: succeeds; `apps/web/dist` produced.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/notes/NotesModule.tsx apps/web/src/notes/NotesModule.test.tsx apps/web/src/App.tsx
git commit -m "feat(web): NotesModule (notebooks + note list + Tiptap editor) wired to Notepad tab"
```

---

## Définition de « terminé » pour la Phase 4

- `pnpm exec firebase emulators:exec --only auth,firestore "pnpm test"` : tous les tests verts, incluant la nouvelle suite core (**note**) et web (**useNotes, NoteEditor, NotesModule**).
- `pnpm --filter @retrorganizer/core typecheck` et `pnpm --filter @retrorganizer/web typecheck` propres ; `pnpm build` produit `apps/web/dist`.
- L'onglet **Notepad** affiche : carnets (sidebar) avec ajout, liste de notes par carnet avec ajout, et un éditeur riche (gras/italique/listes/titre) pour éditer titre + corps, avec enregistrement et suppression.

À l'issue de la Phase 4, reste au MVP 1 la **Phase 5 — Transverse** (recherche globale sur tous les modules, rappels/notifications, catégories/couleurs/tags, corbeille). Les **liens internes** de notes (`linkedEntities`) sont stockés mais leur UI de liaison sera branchée avec la recherche globale en Phase 5. Rappel : le **fix DST des récurrences** reste tracké.
