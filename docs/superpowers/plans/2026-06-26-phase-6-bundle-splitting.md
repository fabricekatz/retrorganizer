# Bundle Code-Splitting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop shipping every module (Tiptap editor, calendar/rrule, all four route modules) in the single initial chunk. Lazy-load the route modules so the login screen and shell load a much smaller bundle, and group large vendors into cacheable named chunks.

**Architecture:** The four route modules (`ContactsModule`, `CalendarModule`, `TasksModule`, `NotesModule`) are currently statically imported in `App.tsx`, so they all land in the entry chunk (~1.45 MB). Convert them to `React.lazy` dynamic imports behind a single `<Suspense>` boundary around `<Routes>` — Rollup then emits a separate chunk per module (Tiptap rides with `NotesModule`, rrule/views with `CalendarModule`), loaded only when that tab is opened. A `manualChunks` config then groups shared heavy vendors (firebase, tiptap/prosemirror) into named vendor chunks so they're cached independently.

**Tech Stack:** React 18 (`lazy`/`Suspense`), Vite 5 / Rollup, Vitest + @testing-library/react.

## Global Constraints

- TypeScript strict with `noUncheckedIndexedAccess`. No `as` casts in production. There is no ESLint; `tsc --noEmit` + the test suite + the production build are the gates.
- Behavior-preserving: the app must render and route exactly as before. The ONLY user-visible change is a brief Suspense fallback while a module chunk loads.
- `React.lazy` needs a default export; the modules are NAMED exports, so adapt with `.then((m) => ({ default: m.X }))`. Do NOT change the modules' exports.
- Keep the existing `App.test` assertions; the modules are mocked there, so adapt the tests to flush the lazy load (await the mocked module) — do not weaken assertions, and keep test stderr pristine (no unhandled act warnings).
- Do not touch domain/core code, repositories, or any module's internals.

---

### Task 1: Lazy-load the four route modules

**Files:**
- Modify: `apps/web/src/App.tsx`
- Test: `apps/web/src/App.test.tsx`

**Interfaces:**
- Produces: `App` renders the route modules via `React.lazy` inside a `<Suspense fallback={…}>`. No prop changes.

- [ ] **Step 1: Update App.test to flush the lazy module**

In `apps/web/src/App.test.tsx`, the three tests render at `/diary` (which mounts the mocked `CalendarModule`). With lazy loading the module resolves on a microtask, so each test must await it to avoid an act warning. Make each `it(...)` callback `async` and add, as its FINAL line, a flush of the lazy module:

```tsx
    await screen.findByTestId("calendar-module");
```

(Leave every existing assertion — tabs count, wordmark, Corbeille button — exactly as is, above that line. The `CalendarModule` mock at the top already renders `<div data-testid="calendar-module" />`.)

- [ ] **Step 2: Run the test to verify it FAILS (red)**

Run: `pnpm --filter @retrorganizer/web test -- App`
Expected: FAIL — `findByTestId("calendar-module")` times out, because `App` still imports `CalendarModule` statically and the mock's div is rendered synchronously… actually it will PASS at this point (static import renders the mock immediately). This step's purpose is to confirm the flush line is harmless before the refactor. If it PASSES here, that is fine — proceed; the meaningful check is Step 4 (still green after lazy conversion).

- [ ] **Step 3: Convert the imports to React.lazy in App.tsx**

In `apps/web/src/App.tsx`:

Change the React import to include `lazy` and `Suspense`:

```tsx
import { useState, lazy, Suspense } from "react";
```

Replace the four static module imports:

```tsx
import { ContactsModule } from "./contacts/ContactsModule";
import { CalendarModule } from "./calendar/CalendarModule";
import { TasksModule } from "./tasks/TasksModule";
import { NotesModule } from "./notes/NotesModule";
```

with lazy dynamic imports (named-export → default adaptation):

```tsx
const ContactsModule = lazy(() => import("./contacts/ContactsModule").then((m) => ({ default: m.ContactsModule })));
const CalendarModule = lazy(() => import("./calendar/CalendarModule").then((m) => ({ default: m.CalendarModule })));
const TasksModule = lazy(() => import("./tasks/TasksModule").then((m) => ({ default: m.TasksModule })));
const NotesModule = lazy(() => import("./notes/NotesModule").then((m) => ({ default: m.NotesModule })));
```

Wrap the `<Routes>…</Routes>` block in a `<Suspense>` with a fallback. The `<main>` currently contains `<Routes>`; change it to:

```tsx
        <main style={{ flex: 1, overflow: "auto", background: tokens.color.surface,
          margin: tokens.space.md, border: `1px solid ${tokens.color.line}`, borderRadius: tokens.radius.md }}>
          <Suspense fallback={<div style={{ padding: tokens.space.lg }}>Chargement…</div>}>
            <Routes>
              {/* …unchanged route children… */}
            </Routes>
          </Suspense>
        </main>
```

Keep every `<Route>` child exactly as it is — only wrap with `<Suspense>`.

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @retrorganizer/web test -- App`
Expected: PASS, with clean stderr (no act warnings — the `findByTestId` flush handles the async resolution).

- [ ] **Step 5: Typecheck**

Run: `pnpm --filter @retrorganizer/web typecheck`
Expected: no errors.

- [ ] **Step 6: Build and verify the split**

Run: `pnpm --filter @retrorganizer/web build`
Then inspect the emitted chunks:

Run: `ls -la apps/web/dist/assets/*.js`
Expected: MORE than one `.js` file now — a separate chunk per lazy module (Vite names them after the module, e.g. `NotesModule-<hash>.js`, `CalendarModule-<hash>.js`, `ContactsModule-<hash>.js`, `TasksModule-<hash>.js`), plus the entry `index-<hash>.js`. The entry chunk must be visibly smaller than the pre-split ~1.45 MB (the Tiptap-bearing `NotesModule` chunk and the calendar chunk are now separate). Record the entry chunk size and the per-module chunk sizes in the commit message.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/App.tsx apps/web/src/App.test.tsx
git commit -m "perf(web): lazy-load route modules to split the entry bundle"
```

---

### Task 2: Group heavy vendors into named chunks

**Files:**
- Modify: `apps/web/vite.config.ts`

**Interfaces:**
- Produces: explicit `manualChunks` so firebase and the Tiptap/ProseMirror stack land in dedicated, cacheable vendor chunks; the >500 kB warning is addressed.

- [ ] **Step 1: Add a build config with manualChunks**

In `apps/web/vite.config.ts`, add a `build` section to the `defineConfig` object (alongside the existing `plugins` and `test` keys). Keep `plugins` and `test` unchanged.

```ts
  build: {
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes("node_modules")) {
            if (id.includes("@tiptap") || id.includes("prosemirror")) return "vendor-editor";
            if (id.includes("/firebase") || id.includes("@firebase")) return "vendor-firebase";
          }
          return undefined;
        },
      },
    },
  },
```

(`manualChunks` as a function lets Rollup keep route-level lazy chunks while still pulling these shared vendors into stable, separately-cacheable chunks. Returning `undefined` leaves Rollup's default chunking for everything else.)

- [ ] **Step 2: Build and verify the vendor chunks**

Run: `pnpm --filter @retrorganizer/web build`
Then:

Run: `ls -la apps/web/dist/assets/*.js`
Expected: a `vendor-firebase-<hash>.js` and a `vendor-editor-<hash>.js` chunk are present. The build output should NOT print the "Some chunks are larger than 500 kB" warning (the limit is now 900 and the big libs are isolated); if any single chunk still exceeds 900 kB, note it in the commit message rather than suppressing it further.

- [ ] **Step 3: Confirm tests still pass (config change shouldn't affect them, but verify)**

Run: `pnpm --filter @retrorganizer/web test`
Expected: PASS (the `test` block in vite.config is untouched; vitest ignores `build`).

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter @retrorganizer/web typecheck`
Expected: no errors (the `manualChunks` param is typed `string`).

- [ ] **Step 5: Commit**

```bash
git add apps/web/vite.config.ts
git commit -m "perf(web): split firebase and editor vendors into named chunks"
```

---

## Final verification (whole branch)

- [ ] Full suite under the emulator (Java on PATH): `pnpm exec firebase emulators:exec --only auth,firestore "pnpm test"` — expect everything green (core unchanged, web green incl. the async App tests).
- [ ] `pnpm --filter @retrorganizer/web build` succeeds; the entry `index` chunk is materially smaller than the original ~1.45 MB and the editor (Tiptap) code lives in its own chunk loaded only when the Notepad tab opens. Record the final chunk sizes in the PR description.
