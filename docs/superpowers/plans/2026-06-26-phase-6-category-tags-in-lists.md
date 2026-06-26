# Surface Category Color + Tags in List Views — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make assigned categories (color dot + name) and tags visible in the contact, task, and calendar-agenda list views, so the category/tag assignment built in Phase 5b is no longer a silent no-op.

**Architecture:** Add one small presentational component, `CategoryTagBadges`, in the categories module. It takes an already-resolved `Category | undefined` plus a `tags: string[]` and renders a color dot + name and one chip per tag (renders nothing when both are empty). Each list's parent module already owns its data hooks; we add `useCategories()` there, pass the loaded `categories` array down to the list component, and the list resolves each row's category with the existing `categoryById(categories, entity.categoryId)` helper. No data-model or repository changes.

**Tech Stack:** React 18 + TypeScript (strict), `@retrorganizer/ui` design tokens, Vitest + @testing-library/react (jsdom).

## Global Constraints

- TypeScript strict with `noUncheckedIndexedAccess`. Domain types are `z.infer<typeof schema>` — NO `& BaseEntity`, NO `as` casts in app code (except the established testing-library `[0]!` / strict-index patterns).
- Stay in scope: this is a display-only change. Do NOT alter the data model, repositories, forms, or any existing visual design beyond adding the badges row. Match the surrounding retro styling (muted 11px metadata, `tokens.color.line` borders, `tokens.space.*` spacing) already used in these lists.
- Reuse existing primitives: `categoryById` from `@retrorganizer/core`, `tokens` from `@retrorganizer/ui`, `Category` type from `@retrorganizer/core`. Do not introduce a new color palette or re-load categories inside leaf components.
- Notes are explicitly out of scope (no tag-assignment UI, no `categoryId` on the Note model).
- Tests must stay green under the existing harness; update existing list tests that gain a new required prop rather than adding prop defaults.

---

### Task 1: CategoryTagBadges presentational component

**Files:**
- Create: `apps/web/src/categories/CategoryTagBadges.tsx`
- Test: `apps/web/src/categories/CategoryTagBadges.test.tsx`

**Interfaces:**
- Consumes: `Category` type and `tokens` (existing).
- Produces: `CategoryTagBadges({ category, tags }: { category: Category | undefined; tags: string[] })` — a React component returning `null` when `!category && tags.length === 0`, otherwise an inline-flex `<span>` with an optional category dot+name and one chip per tag. Later tasks import this from `"../categories/CategoryTagBadges"`.

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CategoryTagBadges } from "./CategoryTagBadges";
import type { Category } from "@retrorganizer/core";

const cat: Category = {
  id: "c1", ownerId: "u1", createdAt: 1, updatedAt: 1, deletedAt: null,
  name: "Travail", color: "#2f6f4f",
};

describe("CategoryTagBadges", () => {
  it("renders the category name and each tag", () => {
    render(<CategoryTagBadges category={cat} tags={["urgent", "client"]} />);
    expect(screen.getByText("Travail")).toBeInTheDocument();
    expect(screen.getByText("urgent")).toBeInTheDocument();
    expect(screen.getByText("client")).toBeInTheDocument();
  });

  it("renders nothing when there is no category and no tags", () => {
    const { container } = render(<CategoryTagBadges category={undefined} tags={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders tags when category is undefined", () => {
    render(<CategoryTagBadges category={undefined} tags={["perso"]} />);
    expect(screen.getByText("perso")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @retrorganizer/web test -- CategoryTagBadges`
Expected: FAIL — `Failed to resolve import "./CategoryTagBadges"` (file does not exist yet).

- [ ] **Step 3: Write minimal implementation**

```tsx
import { tokens } from "@retrorganizer/ui";
import type { Category } from "@retrorganizer/core";

export interface CategoryTagBadgesProps {
  category: Category | undefined;
  tags: string[];
}

export function CategoryTagBadges({ category, tags }: CategoryTagBadgesProps) {
  if (!category && tags.length === 0) return null;
  return (
    <span style={{ display: "inline-flex", flexWrap: "wrap", alignItems: "center", gap: tokens.space.xs }}>
      {category && (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, color: tokens.color.muted }}>
          <span aria-hidden style={{ width: 8, height: 8, borderRadius: "50%",
            background: category.color, border: `1px solid ${tokens.color.line}` }} />
          {category.name}
        </span>
      )}
      {tags.map((t) => (
        <span key={t} style={{ fontSize: 11, color: tokens.color.muted,
          border: `1px solid ${tokens.color.line}`, borderRadius: 3, padding: "0 4px" }}>
          {t}
        </span>
      ))}
    </span>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @retrorganizer/web test -- CategoryTagBadges`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/categories/CategoryTagBadges.tsx apps/web/src/categories/CategoryTagBadges.test.tsx
git commit -m "feat(web): add CategoryTagBadges presentational component"
```

---

### Task 2: Show badges in the contact list

**Files:**
- Modify: `apps/web/src/contacts/ContactList.tsx`
- Modify: `apps/web/src/contacts/ContactsModule.tsx`
- Test: `apps/web/src/contacts/ContactList.test.tsx` (update existing renders for the new required prop; add a badge assertion)

**Interfaces:**
- Consumes: `CategoryTagBadges` (Task 1); `categoryById`, `Category` from `@retrorganizer/core`; `useCategories` from `../categories/useCategories`.
- Produces: `ContactListProps` gains a required `categories: Category[]` field.

- [ ] **Step 1: Update the test (it will fail to compile/pass)**

In `apps/web/src/contacts/ContactList.test.tsx`, add `Category` to the import and a category fixture, pass `categories` to both existing `render` calls, and add a new test. Replace the file body with:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ContactList } from "./ContactList";
import type { Contact, Category } from "@retrorganizer/core";

function mk(id: string, name: string, org = "", categoryId: string | null = null, tags: string[] = []): Contact {
  return { id, ownerId: "u1", createdAt: 1, updatedAt: 1, deletedAt: null, firstName: "", lastName: "", displayName: name, organization: org, phones: [], emails: [], addresses: [], webLinks: [], importantDates: [], customFields: [], categoryId, tags };
}

const categories: Category[] = [
  { id: "c1", ownerId: "u1", createdAt: 1, updatedAt: 1, deletedAt: null, name: "Travail", color: "#2f6f4f" },
];

describe("ContactList", () => {
  const contacts = [mk("1", "Ada Lovelace", "Engines"), mk("2", "Grace Hopper", "Navy")];

  it("renders one entry per contact and fires onSelect", () => {
    const onSelect = vi.fn();
    render(<ContactList contacts={contacts} categories={categories} onSelect={onSelect} onNew={() => {}}
      query="" onQueryChange={() => {}} sortKey="name" onSortKeyChange={() => {}} />);
    expect(screen.getByRole("button", { name: /Ada Lovelace/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Grace Hopper/ }));
    expect(onSelect).toHaveBeenCalledWith(contacts[1]!);
  });

  it("typing in search calls onQueryChange", () => {
    const onQueryChange = vi.fn();
    render(<ContactList contacts={contacts} categories={categories} onSelect={() => {}} onNew={() => {}}
      query="" onQueryChange={onQueryChange} sortKey="name" onSortKeyChange={() => {}} />);
    fireEvent.change(screen.getByLabelText("Rechercher"), { target: { value: "ada" } });
    expect(onQueryChange).toHaveBeenCalledWith("ada");
  });

  it("shows the category name and tags for a contact", () => {
    const tagged = [mk("3", "Alan Turing", "", "c1", ["math"])];
    render(<ContactList contacts={tagged} categories={categories} onSelect={() => {}} onNew={() => {}}
      query="" onQueryChange={() => {}} sortKey="name" onSortKeyChange={() => {}} />);
    expect(screen.getByText("Travail")).toBeInTheDocument();
    expect(screen.getByText("math")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @retrorganizer/web test -- contacts/ContactList`
Expected: FAIL — type error on the `categories` prop (not yet in `ContactListProps`) and/or "Travail"/"math" not found.

- [ ] **Step 3: Implement — add the prop and render the badges**

In `apps/web/src/contacts/ContactList.tsx`:

Replace the import block at the top:

```tsx
import { tokens } from "@retrorganizer/ui";
import { categoryById, type Contact, type Category } from "@retrorganizer/core";
import { CategoryTagBadges } from "../categories/CategoryTagBadges";
```

Add `categories` to the props interface (after `contacts`):

```tsx
export interface ContactListProps {
  contacts: Contact[];
  categories: Category[];
  onSelect(c: Contact): void;
  onNew(): void;
  query: string;
  onQueryChange(q: string): void;
  sortKey: SortKey;
  onSortKeyChange(k: SortKey): void;
}
```

Destructure `categories` in the signature:

```tsx
export function ContactList({ contacts, categories, onSelect, onNew, query, onQueryChange, sortKey, onSortKeyChange }: ContactListProps) {
```

Replace the `<li>` body (the single `<button>`) with a button that stacks the name line and the badges:

```tsx
          <li key={c.id}>
            <button type="button" onClick={() => onSelect(c)}
              style={{ display: "block", width: "100%", textAlign: "left", border: "none",
                borderBottom: `1px solid ${tokens.color.line}`, background: "transparent",
                padding: tokens.space.xs, cursor: "pointer", color: tokens.color.ink }}>
              <span style={{ display: "block" }}>{c.displayName}{c.organization ? ` — ${c.organization}` : ""}</span>
              <CategoryTagBadges category={categoryById(categories, c.categoryId)} tags={c.tags} />
            </button>
          </li>
```

- [ ] **Step 4: Wire the prop in ContactsModule**

In `apps/web/src/contacts/ContactsModule.tsx`:

Add the hook import after the `useContacts` import:

```tsx
import { useCategories } from "../categories/useCategories";
```

Inside the component, after the `useContacts()` line:

```tsx
  const { categories } = useCategories();
```

Pass it to `<ContactList>` (add the prop next to `contacts={visible}`):

```tsx
          <ContactList
            contacts={visible}
            categories={categories}
            onSelect={(c) => { setSelected(c); setMode("edit"); }}
            onNew={() => { setSelected(null); setMode("edit"); }}
            query={query} onQueryChange={setQuery}
            sortKey={sortKey} onSortKeyChange={setSortKey}
          />
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @retrorganizer/web test -- contacts/ContactList contacts/ContactsModule`
Expected: PASS. If `ContactsModule.test.tsx` renders the module without an auth context and now breaks because `useCategories` needs `useAuth`, confirm it is already wrapped (the module already uses `useContacts`, which also calls `useAuth`) — no change should be needed.

- [ ] **Step 6: Typecheck**

Run: `pnpm --filter @retrorganizer/web typecheck`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/contacts/ContactList.tsx apps/web/src/contacts/ContactsModule.tsx apps/web/src/contacts/ContactList.test.tsx
git commit -m "feat(web): show category + tags in contact list"
```

---

### Task 3: Show badges in the task list

**Files:**
- Modify: `apps/web/src/tasks/TaskList.tsx`
- Modify: `apps/web/src/tasks/TasksModule.tsx`
- Test: `apps/web/src/tasks/TaskList.test.tsx` (update existing renders for the new required prop; add a badge assertion)

**Interfaces:**
- Consumes: `CategoryTagBadges` (Task 1); `categoryById`, `Category` from `@retrorganizer/core`; `useCategories` from `../categories/useCategories`.
- Produces: `TaskListProps` gains a required `categories: Category[]` field.

- [ ] **Step 1: Read the existing test to learn its `mk`/fixture shape**

Run: `sed -n '1,40p' apps/web/src/tasks/TaskList.test.tsx`
Note the existing task factory and every `render(<TaskList .../>)` call site — each needs `categories={...}` added.

- [ ] **Step 2: Update the test (add the prop to every render; add a badge assertion)**

Add `Category` to the `@retrorganizer/core` import, define a `categories` fixture:

```tsx
const categories: Category[] = [
  { id: "c1", ownerId: "u1", createdAt: 1, updatedAt: 1, deletedAt: null, name: "Travail", color: "#2f6f4f" },
];
```

Add `categories={categories}` to every existing `<TaskList ... />` render call. Then add one new test (adjust the task factory call to match the file's existing helper — set `categoryId: "c1"` and `tags: ["urgent"]` on the task):

```tsx
  it("shows the category name and tags for a task", () => {
    render(<TaskList tasks={[mkTaskWithCategory()]} categories={categories}
      onSelect={() => {}} onNew={() => {}} onToggleComplete={() => {}}
      statusFilter="all" onStatusFilterChange={() => {}}
      search="" onSearchChange={() => {}} sortKey="priority" onSortKeyChange={() => {}} />);
    expect(screen.getByText("Travail")).toBeInTheDocument();
    expect(screen.getByText("urgent")).toBeInTheDocument();
  });
```

Where `mkTaskWithCategory()` reuses the file's existing task-builder helper with `categoryId: "c1", tags: ["urgent"]`. If the file builds tasks inline, build the task inline the same way the other tests do, setting those two fields. Match the existing test's prop spelling exactly for the other `<TaskList>` props.

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter @retrorganizer/web test -- tasks/TaskList`
Expected: FAIL — type error on `categories` prop and/or "Travail"/"urgent" not found.

- [ ] **Step 4: Implement — add the prop and render the badges**

In `apps/web/src/tasks/TaskList.tsx`:

Replace the import block:

```tsx
import { tokens } from "@retrorganizer/ui";
import { categoryById, type Task, type TaskStatus, type Category } from "@retrorganizer/core";
import { CategoryTagBadges } from "../categories/CategoryTagBadges";
```

Add `categories` to `TaskListProps` (after `tasks`):

```tsx
  tasks: Task[];
  categories: Category[];
```

Destructure it in the body (it uses `props.` destructuring):

```tsx
  const { tasks, categories, onSelect, onNew, onToggleComplete, statusFilter, onStatusFilterChange, search, onSearchChange, sortKey, onSortKeyChange } = props;
```

In the row, the title `<button>` currently renders `{t.title}` and is followed by priority/due/subtask spans. Replace the title button's inner content so the badges sit under the title, keeping it on its own line within the flex row:

```tsx
              <button type="button" onClick={() => onSelect(t)}
                style={{ flex: 1, textAlign: "left", border: "none", background: "transparent", cursor: "pointer",
                  color: tokens.color.ink, textDecoration: t.status === "done" ? "line-through" : "none" }}>
                <span style={{ display: "block" }}>{t.title}</span>
                <CategoryTagBadges category={categoryById(categories, t.categoryId)} tags={t.tags} />
              </button>
```

Leave the priority/due/subtask spans unchanged.

- [ ] **Step 5: Wire the prop in TasksModule**

In `apps/web/src/tasks/TasksModule.tsx`:

Add after the `useTasks` import:

```tsx
import { useCategories } from "../categories/useCategories";
```

After the `useTasks()` destructure line inside the component:

```tsx
  const { categories } = useCategories();
```

Add `categories={categories}` to the `<TaskList ...>` element (next to `tasks={visible}`).

- [ ] **Step 6: Run tests + typecheck**

Run: `pnpm --filter @retrorganizer/web test -- tasks/TaskList tasks/TasksModule`
Expected: PASS.
Run: `pnpm --filter @retrorganizer/web typecheck`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/tasks/TaskList.tsx apps/web/src/tasks/TasksModule.tsx apps/web/src/tasks/TaskList.test.tsx
git commit -m "feat(web): show category + tags in task list"
```

---

### Task 4: Show badges in the calendar agenda view

**Files:**
- Modify: `apps/web/src/calendar/AgendaView.tsx`
- Modify: `apps/web/src/calendar/CalendarModule.tsx`
- Test: `apps/web/src/calendar/AgendaView.test.tsx` (update existing renders for the new required prop; add a badge assertion)

**Interfaces:**
- Consumes: `CategoryTagBadges` (Task 1); `categoryById`, `Category` from `@retrorganizer/core`; `useCategories` from `../categories/useCategories`. Existing `Occurrence` type already exposes `o.event.categoryId` and `o.event.tags`.
- Produces: `AgendaViewProps` gains a required `categories: Category[]` field.

- [ ] **Step 1: Read the existing test to learn its occurrence fixture shape**

Run: `sed -n '1,60p' apps/web/src/calendar/AgendaView.test.tsx`
Note how it builds `Occurrence[]` (the embedded `event` object shape) and every `render(<AgendaView .../>)` call site.

- [ ] **Step 2: Update the test (add the prop to every render; add a badge assertion)**

Add `Category` to the import and a fixture:

```tsx
const categories: Category[] = [
  { id: "c1", ownerId: "u1", createdAt: 1, updatedAt: 1, deletedAt: null, name: "Travail", color: "#2f6f4f" },
];
```

Add `categories={categories}` to every existing `<AgendaView ... />` render. Add one new test that builds an occurrence whose `event.categoryId === "c1"` and `event.tags === ["réunion"]` (reuse the file's occurrence builder, setting those two fields on the embedded event), then:

```tsx
    expect(screen.getByText("Travail")).toBeInTheDocument();
    expect(screen.getByText("réunion")).toBeInTheDocument();
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter @retrorganizer/web test -- calendar/AgendaView`
Expected: FAIL — type error on `categories` prop and/or "Travail"/"réunion" not found.

- [ ] **Step 4: Implement — add the prop and render the badges**

In `apps/web/src/calendar/AgendaView.tsx`:

Replace the import block:

```tsx
import { tokens } from "@retrorganizer/ui";
import { sameDay, categoryById, type Occurrence, type Category } from "@retrorganizer/core";
import { CategoryTagBadges } from "../categories/CategoryTagBadges";
```

Add `categories` to `AgendaViewProps`:

```tsx
export interface AgendaViewProps {
  occurrences: Occurrence[];
  categories: Category[];
  onSelectOccurrence(occ: Occurrence): void;
}
```

Destructure it:

```tsx
export function AgendaView({ occurrences, categories, onSelectOccurrence }: AgendaViewProps) {
```

In the occurrence `<button>`, the title is rendered as `<span>{o.event.title}</span>`. Wrap the title + badges in a column so the badges sit beneath the title without disturbing the time column:

```tsx
              <span style={{ color: tokens.color.muted, minWidth: 48 }}>{o.event.allDay ? "Jour" : timeLabel(o.start)}</span>
              <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span>{o.event.title}</span>
                <CategoryTagBadges category={categoryById(categories, o.event.categoryId)} tags={o.event.tags} />
              </span>
```

- [ ] **Step 5: Wire the prop in CalendarModule**

In `apps/web/src/calendar/CalendarModule.tsx`:

Add after the `useEvents` import:

```tsx
import { useCategories } from "../categories/useCategories";
```

After the `useEvents()` destructure inside the component:

```tsx
  const { categories } = useCategories();
```

Pass `categories={categories}` to the `<AgendaView ...>` element (it currently reads `occurrences={occurrences} onSelectOccurrence={openOccurrence}`).

- [ ] **Step 6: Run tests + typecheck**

Run: `pnpm --filter @retrorganizer/web test -- calendar/AgendaView calendar/CalendarModule`
Expected: PASS.
Run: `pnpm --filter @retrorganizer/web typecheck`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/calendar/AgendaView.tsx apps/web/src/calendar/CalendarModule.tsx apps/web/src/calendar/AgendaView.test.tsx
git commit -m "feat(web): show category + tags in calendar agenda"
```

---

## Final verification (whole branch)

- [ ] Run the full suite under the emulator (Java on PATH): `pnpm exec firebase emulators:exec --only auth,firestore "pnpm test"` — expect core 91 + web (existing 82 + the new tests) green.
- [ ] `pnpm --filter @retrorganizer/web build` (or `pnpm build`) succeeds.
