# Search Deep-Link to Entity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clicking a global-search result opens the matched entity, not just its module — the contact/task/note/event the user searched for is opened for editing/viewing on arrival.

**Architecture:** `GlobalSearchBar` navigates to the module path with a `?focus=<entityId>` query param (the `entityId` is already on every `SearchResult`). A new shared hook `useFocusParam(entities, loading, onFocus)` reads that param, and once the module's data has loaded, calls `onFocus(entity)` for the matching id and strips the param (so it doesn't re-fire on reload or back-navigation). Each of the four modules (Contacts, Tasks, Notes, Calendar) calls the hook with its own "open this entity" callback.

**Tech Stack:** React 18 + TypeScript (strict), react-router-dom v6 (`useSearchParams`), Vitest + @testing-library/react (jsdom), `MemoryRouter` for tests.

## Global Constraints

- TypeScript strict with `noUncheckedIndexedAccess`. No `as` casts in production code. There is no ESLint in this repo — `tsc --noEmit` (typecheck) and the test suite are the only gates.
- Display/navigation only: do NOT change the search index, the domain models, repositories, or any module's existing behavior beyond opening the focused entity.
- The four modules currently render standalone in their unit tests with NO Router. Adding `useSearchParams` requires those tests to wrap renders in `MemoryRouter`. Use the established flag form everywhere: `<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>...`. When testing the focus behavior, pass `initialEntries={["<path>?focus=<id>"]}`.
- `useFocusParam` MUST be called unconditionally at the top of each module, BEFORE any early `return` (Rules of Hooks). The hook guards on `loading` internally, so calling it before a `if (loading) return …` is correct.
- Reuse existing open mechanisms verbatim (e.g. `setSelected`+`setMode("edit")`, `setEditing({ draft, id })`); do not invent new ones.

---

### Task 1: GlobalSearchBar — navigate with `?focus`

**Files:**
- Modify: `apps/web/src/search/GlobalSearchBar.tsx`
- Test: `apps/web/src/search/GlobalSearchBar.test.tsx`

**Interfaces:**
- Consumes: `SearchResult` already has `entityId: string` and `path: string`.
- Produces: clicking a result navigates to `` `${path}?focus=${entityId}` ``.

- [ ] **Step 1: Update the existing navigation test**

In `apps/web/src/search/GlobalSearchBar.test.tsx`, the "shows results and navigates on click" test currently asserts `expect(navigate).toHaveBeenCalledWith("/address")`. Change that line to:

```tsx
    expect(navigate).toHaveBeenCalledWith("/address?focus=c1");
```

(The mock result already has `entityId: "c1"` and `path: "/address"`.)

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @retrorganizer/web test -- search/GlobalSearchBar`
Expected: FAIL — navigate called with `"/address"`, expected `"/address?focus=c1"`.

- [ ] **Step 3: Implement**

In `apps/web/src/search/GlobalSearchBar.tsx`, the result button currently calls `onClick={() => pick(r.path)}` and `pick(path: string)` navigates to `path`. Change the click handler to pass the whole result and build the focus URL. Replace the `pick` function:

```tsx
  function pick(r: { path: string; entityId: string }) {
    navigate(`${r.path}?focus=${r.entityId}`);
    setQuery("");
  }
```

And change the button's onClick:

```tsx
              <button type="button" onClick={() => pick(r)}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @retrorganizer/web test -- search/GlobalSearchBar`
Expected: PASS (2 tests).

- [ ] **Step 5: Typecheck + commit**

Run: `pnpm --filter @retrorganizer/web typecheck` (expect clean).

```bash
git add apps/web/src/search/GlobalSearchBar.tsx apps/web/src/search/GlobalSearchBar.test.tsx
git commit -m "feat(web): search results deep-link with ?focus param"
```

---

### Task 2: `useFocusParam` shared hook

**Files:**
- Create: `apps/web/src/search/useFocusParam.ts`
- Test: `apps/web/src/search/useFocusParam.test.tsx`

**Interfaces:**
- Consumes: `useSearchParams` from `react-router-dom`.
- Produces: `useFocusParam<T extends { id: string }>(entities: T[], loading: boolean, onFocus: (entity: T) => void): void`. Tasks 3–6 import it from `../search/useFocusParam`.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/search/useFocusParam.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, useSearchParams } from "react-router-dom";
import { useFocusParam } from "./useFocusParam";

type Item = { id: string; name: string };

function Harness({ entities, loading, onFocus }: { entities: Item[]; loading: boolean; onFocus: (i: Item) => void }) {
  useFocusParam(entities, loading, onFocus);
  const [params] = useSearchParams();
  return <div data-testid="focus">{params.get("focus") ?? "none"}</div>;
}

function renderAt(path: string, props: { entities: Item[]; loading: boolean; onFocus: (i: Item) => void }) {
  return render(
    <MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Harness {...props} />
    </MemoryRouter>,
  );
}

describe("useFocusParam", () => {
  it("calls onFocus with the matching entity and clears the param", () => {
    const onFocus = vi.fn();
    renderAt("/x?focus=a", { entities: [{ id: "a", name: "Alpha" }], loading: false, onFocus });
    expect(onFocus).toHaveBeenCalledWith({ id: "a", name: "Alpha" });
    expect(screen.getByTestId("focus").textContent).toBe("none");
  });

  it("does nothing while loading", () => {
    const onFocus = vi.fn();
    renderAt("/x?focus=a", { entities: [], loading: true, onFocus });
    expect(onFocus).not.toHaveBeenCalled();
    expect(screen.getByTestId("focus").textContent).toBe("a");
  });

  it("clears the param without calling onFocus when the id matches nothing", () => {
    const onFocus = vi.fn();
    renderAt("/x?focus=ghost", { entities: [{ id: "a", name: "Alpha" }], loading: false, onFocus });
    expect(onFocus).not.toHaveBeenCalled();
    expect(screen.getByTestId("focus").textContent).toBe("none");
  });

  it("does nothing when there is no focus param", () => {
    const onFocus = vi.fn();
    renderAt("/x", { entities: [{ id: "a", name: "Alpha" }], loading: false, onFocus });
    expect(onFocus).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @retrorganizer/web test -- search/useFocusParam`
Expected: FAIL — cannot resolve `./useFocusParam`.

- [ ] **Step 3: Implement**

Create `apps/web/src/search/useFocusParam.ts`:

```ts
import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";

// When the URL carries ?focus=<id> and the module's data has loaded, call
// onFocus(entity) for the matching id, then strip the param so it does not
// re-fire on reload or back-navigation. An id that matches nothing (once
// loaded) just clears the param.
export function useFocusParam<T extends { id: string }>(
  entities: T[],
  loading: boolean,
  onFocus: (entity: T) => void,
): void {
  const [params, setParams] = useSearchParams();
  const focus = params.get("focus");
  useEffect(() => {
    if (focus === null || loading) return;
    const entity = entities.find((e) => e.id === focus);
    if (entity) onFocus(entity);
    const next = new URLSearchParams(params);
    next.delete("focus");
    setParams(next, { replace: true });
  }, [focus, loading, entities]); // params/setParams/onFocus intentionally excluded — focus drives re-runs
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @retrorganizer/web test -- search/useFocusParam`
Expected: PASS (4 tests).

- [ ] **Step 5: Typecheck + commit**

Run: `pnpm --filter @retrorganizer/web typecheck` (expect clean).

```bash
git add apps/web/src/search/useFocusParam.ts apps/web/src/search/useFocusParam.test.tsx
git commit -m "feat(web): useFocusParam hook to open a focused entity from ?focus"
```

---

### Task 3: Contacts deep-link

**Files:**
- Modify: `apps/web/src/contacts/ContactsModule.tsx`
- Test: `apps/web/src/contacts/ContactsModule.test.tsx`

**Interfaces:**
- Consumes: `useFocusParam` (Task 2). `ContactsModule` has `contacts`, `loading`, and `setSelected`/`setMode` already.

- [ ] **Step 1: Wrap existing test in MemoryRouter and add a focus test**

In `apps/web/src/contacts/ContactsModule.test.tsx`:

Add the import:

```tsx
import { MemoryRouter } from "react-router-dom";
```

Wrap the existing `render(<ContactsModule />)` call in the "creates a contact" test:

```tsx
    render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><ContactsModule /></MemoryRouter>);
```

Add a new test that arrives with `?focus`:

```tsx
  it("opens the focused contact from the ?focus param", async () => {
    listByOwner.mockResolvedValue([
      { id: "c9", ownerId: "u1", createdAt: 1, updatedAt: 1, deletedAt: null, firstName: "Grace", lastName: "Hopper",
        displayName: "Grace Hopper", organization: "", phones: [], emails: [], addresses: [], webLinks: [],
        importantDates: [], customFields: [], categoryId: null, tags: [] },
    ]);
    render(
      <MemoryRouter initialEntries={["/address?focus=c9"]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ContactsModule />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByDisplayValue("Grace")).toBeInTheDocument());
  });
```

(The edit form renders the contact's first name in an input — `getByDisplayValue("Grace")` proves the form opened. If the field label differs, assert on the "Enregistrer" submit button instead: `await waitFor(() => expect(screen.getByRole("button", { name: "Enregistrer" })).toBeInTheDocument())`.)

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @retrorganizer/web test -- contacts/ContactsModule`
Expected: FAIL — without the hook, the module stays on the list; the form (and "Grace") never appears. (The first test must already pass with the MemoryRouter wrapper.)

- [ ] **Step 3: Implement**

In `apps/web/src/contacts/ContactsModule.tsx`:

Add the import:

```tsx
import { useFocusParam } from "../search/useFocusParam";
```

Add the hook call AFTER the existing `useMemo` for `visible` and BEFORE the `if (loading) return …` line:

```tsx
  useFocusParam(contacts, loading, (c) => { setSelected(c); setMode("edit"); });
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @retrorganizer/web test -- contacts/ContactsModule`
Expected: PASS (both tests).

- [ ] **Step 5: Typecheck + commit**

Run: `pnpm --filter @retrorganizer/web typecheck` (expect clean).

```bash
git add apps/web/src/contacts/ContactsModule.tsx apps/web/src/contacts/ContactsModule.test.tsx
git commit -m "feat(web): open focused contact from search deep-link"
```

---

### Task 4: Tasks deep-link

**Files:**
- Modify: `apps/web/src/tasks/TasksModule.tsx`
- Test: `apps/web/src/tasks/TasksModule.test.tsx`

**Interfaces:**
- Consumes: `useFocusParam` (Task 2). `TasksModule` has `tasks`, `loading`, `draftFromTask`, and `setEditing`.

- [ ] **Step 1: Read the test, wrap existing renders, add a focus test**

Run: `sed -n '1,60p' apps/web/src/tasks/TasksModule.test.tsx` to learn how it mocks `tasksRepo.listByOwner` and how it builds a task. Add `import { MemoryRouter } from "react-router-dom";` and wrap every existing `render(<TasksModule />)` in `<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>…</MemoryRouter>`.

Add a focus test: make `listByOwner` resolve `[task]` where the task has `id: "t9"` and `title: "Write spec"` (build it with the same fields the file's other tasks use — use `parseTask` if the file does, else the inline object it uses), render at `initialEntries={["/todo?focus=t9"]}`, and assert the editor opened — e.g. `await waitFor(() => expect(screen.getByDisplayValue("Write spec")).toBeInTheDocument())` (TaskForm shows the title in an input). If the title field isn't a `displayValue`, assert the "Enregistrer"/submit button or the "Supprimer" button (the edit branch renders a Supprimer button because `editing.id` is set).

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @retrorganizer/web test -- tasks/TasksModule`
Expected: FAIL — editor does not open without the hook.

- [ ] **Step 3: Implement**

In `apps/web/src/tasks/TasksModule.tsx`:

Add the import:

```tsx
import { useFocusParam } from "../search/useFocusParam";
```

Add the hook call AFTER the `visible` `useMemo` and BEFORE the `if (loading) return …` line:

```tsx
  useFocusParam(tasks, loading, (t) => setEditing({ draft: draftFromTask(t), id: t.id }));
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @retrorganizer/web test -- tasks/TasksModule`
Expected: PASS.

- [ ] **Step 5: Typecheck + commit**

Run: `pnpm --filter @retrorganizer/web typecheck` (expect clean).

```bash
git add apps/web/src/tasks/TasksModule.tsx apps/web/src/tasks/TasksModule.test.tsx
git commit -m "feat(web): open focused task from search deep-link"
```

---

### Task 5: Notes deep-link

**Files:**
- Modify: `apps/web/src/notes/NotesModule.tsx`
- Test: `apps/web/src/notes/NotesModule.test.tsx`

**Interfaces:**
- Consumes: `useFocusParam` (Task 2). `NotesModule` has `notes`, `loading`, `draftFromNote`, and the setters `setSelectedSectionId`, `setSelectedNoteId`, `setDraft`.

- [ ] **Step 1: Read the test, wrap existing renders, add a focus test**

Run: `sed -n '1,70p' apps/web/src/notes/NotesModule.test.tsx` to learn how it mocks `notesRepo`/`noteSectionsRepo` `listByOwner` and how it builds a note. Add `import { MemoryRouter } from "react-router-dom";` and wrap every existing `render(<NotesModule />)` in the `MemoryRouter` with the future flags.

Add a focus test: make the notes load include a note with `id: "n9"`, `sectionId: <an existing section id>`, `title: "Roadmap"`. Render at `initialEntries={["/notepad?focus=n9"]}` and assert the editor opened — `await waitFor(() => expect(screen.getByDisplayValue("Roadmap")).toBeInTheDocument())` (the title input shows the note title). Ensure a section exists in the mocked sections so `selectedSectionId` is valid.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @retrorganizer/web test -- notes/NotesModule`
Expected: FAIL — the note editor does not open without the hook.

- [ ] **Step 3: Implement**

In `apps/web/src/notes/NotesModule.tsx`:

Add the import:

```tsx
import { useFocusParam } from "../search/useFocusParam";
```

Add the hook call AFTER the existing `useEffect`/`sectionNotes` derivation and BEFORE the `if (loading) return …` line. It mirrors `openNote` but also selects the note's section so the middle column highlights it:

```tsx
  useFocusParam(notes, loading, (n) => {
    setSelectedSectionId(n.sectionId);
    setSelectedNoteId(n.id);
    setDraft(draftFromNote(n));
  });
```

Ensure `draftFromNote` is imported (the module already imports `emptyNoteDraft, draftFromNote` — confirm `draftFromNote` is in the import; it is used by `openNote`).

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @retrorganizer/web test -- notes/NotesModule`
Expected: PASS.

- [ ] **Step 5: Typecheck + commit**

Run: `pnpm --filter @retrorganizer/web typecheck` (expect clean).

```bash
git add apps/web/src/notes/NotesModule.tsx apps/web/src/notes/NotesModule.test.tsx
git commit -m "feat(web): open focused note from search deep-link"
```

---

### Task 6: Calendar deep-link

**Files:**
- Modify: `apps/web/src/calendar/CalendarModule.tsx`
- Test: `apps/web/src/calendar/CalendarModule.test.tsx`

**Interfaces:**
- Consumes: `useFocusParam` (Task 2). `CalendarModule` has `events`, `loading`, `draftFromEvent`, and `setEditing`.

- [ ] **Step 1: Read the test, wrap existing renders, add a focus test**

Run: `sed -n '1,70p' apps/web/src/calendar/CalendarModule.test.tsx` to learn how it mocks `eventsRepo.listByOwner` and builds an event. Add `import { MemoryRouter } from "react-router-dom";` and wrap every existing `render(<CalendarModule … />)` in the `MemoryRouter` with the future flags.

Add a focus test: make `listByOwner` resolve `[event]` where the event has `id: "e9"`, `title: "Launch"`, valid `start`/`end` (end ≥ start), and the other required fields the file's existing events use. Render at `initialEntries={["/diary?focus=e9"]}` and assert the editor opened — `await waitFor(() => expect(screen.getByDisplayValue("Launch")).toBeInTheDocument())` (EventForm shows the title in an input). If the title field isn't a `displayValue`, assert the "Supprimer" button (rendered because `editing.id` is set).

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @retrorganizer/web test -- calendar/CalendarModule`
Expected: FAIL — the event editor does not open without the hook.

- [ ] **Step 3: Implement**

In `apps/web/src/calendar/CalendarModule.tsx`:

Add the import:

```tsx
import { useFocusParam } from "../search/useFocusParam";
```

Add the hook call AFTER the `occurrences` `useMemo` and BEFORE the `if (editing) return …` / `if (loading)` returns (it must run on every render):

```tsx
  useFocusParam(events, loading, (ev) => setEditing({ draft: draftFromEvent(ev), id: ev.id }));
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @retrorganizer/web test -- calendar/CalendarModule`
Expected: PASS.

- [ ] **Step 5: Typecheck + commit**

Run: `pnpm --filter @retrorganizer/web typecheck` (expect clean).

```bash
git add apps/web/src/calendar/CalendarModule.tsx apps/web/src/calendar/CalendarModule.test.tsx
git commit -m "feat(web): open focused event from search deep-link"
```

---

## Final verification (whole branch)

- [ ] Full suite under the emulator (Java on PATH): `pnpm exec firebase emulators:exec --only auth,firestore "pnpm test"` — expect core unchanged, web green with the new tests.
- [ ] `pnpm --filter @retrorganizer/web build` succeeds.
- [ ] Sanity check that `App.test` still passes (the modules now call `useSearchParams`, but App renders them inside its Router, so no change is expected): `pnpm --filter @retrorganizer/web test -- App`.
