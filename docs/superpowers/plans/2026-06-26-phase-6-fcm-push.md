# FCM Server Push (Out-of-App Reminders) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver reminders even when the app is closed. The browser registers an FCM device token; a scheduled Cloud Function computes which event/task reminders are due and pushes them via FCM; a service worker shows them in the background.

**Architecture:** Two halves.
- **Client (web):** a `fcmTokens` collection (owner-scoped, doc id = the token) + a repo; a `usePushNotifications` hook that requests permission, gets the FCM token (with the registered service worker + VAPID key), stores it, and handles foreground messages; a static `firebase-messaging-sw.js` service worker for background notifications.
- **Server (functions):** a new `functions/` workspace package, bundled with esbuild. A scheduled (every 5 min) Cloud Function reuses `packages/core`'s **firebase-free** reminder logic (`computeDueReminders`/`computeDueTaskReminders`, imported by relative path so esbuild bundles only zod+rrule, never the client firebase SDK), reads each token-owner's events/tasks + a per-user `lastCheck`, sends FCM via the Admin SDK over a half-open window, prunes invalid tokens, and advances `lastCheck`.

**Coexistence with in-app reminders (kept as-is):** the existing in-app interval still fires toasts when the app is open. To avoid double-notifying, the client `onMessage` foreground handler does NOT show a notification (the in-app toast already covers the foreground); the service worker shows notifications only in the background. Overlap is therefore minimal and documented.

**Tech Stack:** Firebase Cloud Functions v2 (`onSchedule`, Node 20), firebase-admin, `firebase/messaging` (web), esbuild (function bundle), Vitest. Reuses `@retrorganizer/core` pure logic.

## Global Constraints

- TypeScript strict with `noUncheckedIndexedAccess`. No `as` casts in production (test fixtures may cast). No ESLint; `tsc --noEmit` + tests + build are the gates.
- The Cloud Function MUST NOT import the `@retrorganizer/core` barrel or any firebase-client code. It imports pure modules by relative path: `../../packages/core/src/reminders/dueReminders`, `../../packages/core/src/domain/event`, `../../packages/core/src/domain/task`. `functions/package.json` lists ONLY `firebase-admin` + `firebase-functions` as runtime deps (no `workspace:*`), so the cloud install never sees an unresolvable workspace link.
- Reuse existing core logic; do NOT reimplement reminder selection. `computeDueReminders(events, from, to)` / `computeDueTaskReminders(tasks, from, to)` return `ReminderHit[]` over the half-open window `(from, to]`.
- Owner isolation: `fcmTokens` docs carry `ownerId`; the existing `firestore.rules` `/{collection}/{docId}` owner rule already governs them (verify with a test). The Admin SDK in the function bypasses rules.
- Emulator tests run under Java on PATH; emulator-touching test files clear the emulator in `beforeEach` (see `emulatorTestSupport.clearFirestoreEmulator`).
- What is NOT locally verifiable (build the code; the user verifies post-deploy on a Blaze project): actual `getToken`, service-worker registration, `admin.messaging().send` delivery, and the scheduled trigger firing. Everything else (token repo + rules, the pure sweep selection, the orchestration with mocked admin) IS unit-tested.

---

### Task 1: `fcmTokens` domain + repo (core)

**Files:**
- Create: `packages/core/src/domain/fcmToken.ts`
- Create: `packages/core/src/repositories/fcmTokens.ts`
- Modify: `packages/core/src/index.ts` (export both)
- Test: `packages/core/src/repositories/fcmTokens.test.ts` (emulator)

**Interfaces:**
- Produces: `FcmToken` (`z.infer`), `parseFcmToken`. `fcmTokensRepo` with `registerToken(ownerId, token): Promise<void>` (idempotent upsert, doc id = token) and `removeToken(token): Promise<void>`. Task 7 reads this collection via the Admin SDK; Task 2 writes via `registerToken`.

- [ ] **Step 1: Write the failing test** (mirror `categoryCleanup.test.ts`'s emulator harness, with the `beforeEach(() => clearFirestoreEmulator(PROJECT_ID))` clean-slate pattern):

```ts
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { signInAnonymously } from "firebase/auth";
import { initFirebase, getFirebase } from "../firebase/app";
import { getDoc, doc } from "firebase/firestore";
import { fcmTokensRepo } from "./fcmTokens";
import { clearFirestoreEmulator } from "../firebase/emulatorTestSupport";

const PROJECT_ID = "retrorganizer-dev";
let ownerId: string;

beforeAll(async () => {
  initFirebase({ apiKey: "x", authDomain: "x", projectId: PROJECT_ID, appId: "x" }, true);
  const cred = await signInAnonymously(getFirebase().auth);
  ownerId = cred.user.uid;
});
beforeEach(() => clearFirestoreEmulator(PROJECT_ID));

describe("fcmTokensRepo", () => {
  it("registers a token idempotently under the token id with ownerId", async () => {
    await fcmTokensRepo.registerToken(ownerId, "tok-abc");
    await fcmTokensRepo.registerToken(ownerId, "tok-abc"); // again — no duplicate
    const snap = await getDoc(doc(getFirebase().db, "fcmTokens", "tok-abc"));
    expect(snap.exists()).toBe(true);
    expect(snap.data()?.ownerId).toBe(ownerId);
  });

  it("removeToken deletes the token doc", async () => {
    await fcmTokensRepo.registerToken(ownerId, "tok-del");
    await fcmTokensRepo.removeToken("tok-del");
    const snap = await getDoc(doc(getFirebase().db, "fcmTokens", "tok-del"));
    expect(snap.exists()).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm exec firebase emulators:exec --only auth,firestore "pnpm --filter @retrorganizer/core test -- fcmTokens"` (Java on PATH: `export PATH="/opt/homebrew/opt/openjdk/bin:$PATH"`).
Expected: FAIL — `./fcmTokens` unresolved.

- [ ] **Step 3: Implement the domain** — `packages/core/src/domain/fcmToken.ts`:

```ts
import { z } from "zod";

export const fcmTokenSchema = z.object({
  id: z.string(),          // the FCM registration token (also the doc id)
  ownerId: z.string().min(1),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export type FcmToken = z.infer<typeof fcmTokenSchema>;

export function parseFcmToken(input: unknown): FcmToken {
  return fcmTokenSchema.parse(input);
}
```

- [ ] **Step 4: Implement the repo** — `packages/core/src/repositories/fcmTokens.ts` (does not use the generic `createRepository` because the doc id is the token and there is no soft-delete):

```ts
import { doc, setDoc, deleteDoc } from "firebase/firestore";
import { getFirebase } from "../firebase/app";

export const fcmTokensRepo = {
  async registerToken(ownerId: string, token: string): Promise<void> {
    const now = Date.now();
    await setDoc(
      doc(getFirebase().db, "fcmTokens", token),
      { id: token, ownerId, createdAt: now, updatedAt: now },
      { merge: true },
    );
  },
  async removeToken(token: string): Promise<void> {
    await deleteDoc(doc(getFirebase().db, "fcmTokens", token));
  },
};
```

- [ ] **Step 5: Export from the barrel** — add to `packages/core/src/index.ts`:

```ts
export * from "./domain/fcmToken";
export * from "./repositories/fcmTokens";
```

- [ ] **Step 6: Run the test (pass) + typecheck**

Run: `pnpm exec firebase emulators:exec --only auth,firestore "pnpm --filter @retrorganizer/core test -- fcmTokens"` → PASS.
Run: `pnpm --filter @retrorganizer/core typecheck` → clean.

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/domain/fcmToken.ts packages/core/src/repositories/fcmTokens.ts packages/core/src/index.ts packages/core/src/repositories/fcmTokens.test.ts
git commit -m "feat(core): fcmTokens collection + repo for device push tokens"
```

---

### Task 2: rules coverage test for `fcmTokens` (core)

**Files:**
- Modify: `packages/core/src/firebase/rules.test.ts`

**Interfaces:** confirms the existing owner-scoped `/{collection}/{docId}` rules govern `fcmTokens` correctly (no rules change expected — this is a guard test).

- [ ] **Step 1: Add tests** to `packages/core/src/firebase/rules.test.ts` (it uses `@firebase/rules-unit-testing`; mirror the existing contact tests):

```ts
  it("lets a user create their own fcmToken", async () => {
    const db = env.authenticatedContext("u1").firestore();
    await assertSucceeds(setDoc(doc(db, "fcmTokens/tok1"), { id: "tok1", ownerId: "u1", createdAt: 1, updatedAt: 1 }));
  });

  it("forbids creating an fcmToken owned by someone else", async () => {
    const db = env.authenticatedContext("u1").firestore();
    await assertFails(setDoc(doc(db, "fcmTokens/tok2"), { id: "tok2", ownerId: "u2", createdAt: 1, updatedAt: 1 }));
  });
```

- [ ] **Step 2: Run** (emulator)

Run: `pnpm exec firebase emulators:exec --only auth,firestore "pnpm --filter @retrorganizer/core test -- rules"`
Expected: PASS (existing + 2 new). If the create-own case fails, the rules need a fix — STOP and report (it should pass with the current generic owner rule).

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/firebase/rules.test.ts
git commit -m "test(core): rules cover owner isolation for fcmTokens"
```

---

### Task 3: Service worker for background messages (web)

**Files:**
- Create: `apps/web/public/firebase-messaging-sw.js`
- Modify: `apps/web/.env.example` (add the new vars)

**Interfaces:** the background notification handler. A static file served at the site root (Vite copies `public/` verbatim). It cannot read Vite env vars, so the Firebase config is inlined (these values are public web config); the runbook explains keeping it in sync with the prod project.

- [ ] **Step 1: Create `apps/web/public/firebase-messaging-sw.js`** (uses the compat SDK, which is the supported way to init Firebase in a service worker):

```js
/* Firebase Cloud Messaging background handler.
   Public web config — replace the placeholders with your prod project's values
   (Project settings → General → Web app). Keep messagingSenderId in sync. */
importScripts("https://www.gstatic.com/firebasejs/12.15.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/12.15.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "REPLACE_API_KEY",
  authDomain: "REPLACE_AUTH_DOMAIN",
  projectId: "REPLACE_PROJECT_ID",
  appId: "REPLACE_APP_ID",
  messagingSenderId: "REPLACE_MESSAGING_SENDER_ID",
});

firebase.messaging().onBackgroundMessage((payload) => {
  const title = payload.notification?.title ?? "Rappel";
  const body = payload.notification?.body ?? "";
  self.registration.showNotification(title, { body, icon: "/favicon.ico" });
});
```

- [ ] **Step 2: Add the new env vars to `apps/web/.env.example`** (after `VITE_FIREBASE_APP_ID`):

```
# Cloud Messaging (FCM) — needed for out-of-app push reminders.
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_VAPID_KEY=your-web-push-vapid-key   # Firebase console → Cloud Messaging → Web Push certificates
```

- [ ] **Step 3: Verify the file is emitted by the build**

Run: `pnpm --filter @retrorganizer/web build` then `test -f apps/web/dist/firebase-messaging-sw.js && echo OK`
Expected: `OK` (Vite copies `public/` into `dist/`).

- [ ] **Step 4: Commit**

```bash
git add apps/web/public/firebase-messaging-sw.js apps/web/.env.example
git commit -m "feat(web): FCM background service worker + messaging env vars"
```

---

### Task 4: Push registration hook + wire-in (web)

**Files:**
- Modify: `apps/web/src/firebaseConfig.ts` (add messagingSenderId)
- Create: `apps/web/src/notifications/usePushNotifications.ts`
- Create: `apps/web/src/notifications/PushOptIn.tsx`
- Modify: `apps/web/src/App.tsx` (mount `PushOptIn` in the header area)
- Test: `apps/web/src/notifications/usePushNotifications.test.tsx`

**Interfaces:**
- Consumes: `fcmTokensRepo` (Task 1), `firebase/messaging` (`getMessaging`, `getToken`, `onMessage`, `isSupported`), `useAuth`.
- Produces: `usePushNotifications()` → `{ status: "unsupported" | "default" | "granted" | "denied", enable(): Promise<void> }`. `PushOptIn` renders a small "Activer les notifications" button when `status === "default"`.

- [ ] **Step 1: Add messagingSenderId to `firebaseConfig.ts`** — extend the config object passed to `initFirebase` with `messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? "demo"`. (Update the `FirebaseConfig` type in `packages/core/src/firebase/app.ts` to add an optional `messagingSenderId?: string`.)

- [ ] **Step 2: Write the failing test** for the hook's storable behavior. Mock `firebase/messaging`, `../calendar/useEvents`-style `useAuth`, and `@retrorganizer/core` (`fcmTokensRepo`). The hook is hard to fully test (browser APIs); cover the core flow: when `enable()` is called and permission resolves `granted`, it gets a token and calls `fcmTokensRepo.registerToken(uid, token)`.

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { usePushNotifications } from "./usePushNotifications";

const registerToken = vi.fn();
vi.mock("@retrorganizer/core", () => ({ fcmTokensRepo: { registerToken: (...a: unknown[]) => registerToken(...a), removeToken: vi.fn() } }));
vi.mock("../auth/AuthProvider", () => ({ useAuth: () => ({ user: { uid: "u1" } }) }));
const getToken = vi.fn();
const onMessage = vi.fn();
vi.mock("firebase/messaging", () => ({
  isSupported: () => Promise.resolve(true),
  getMessaging: () => ({}),
  getToken: (...a: unknown[]) => getToken(...a),
  onMessage: (...a: unknown[]) => onMessage(...a),
}));
vi.mock("../firebaseConfig", () => ({ bootstrapFirebase: () => ({ app: {} }) }));

beforeEach(() => {
  registerToken.mockReset().mockResolvedValue(undefined);
  getToken.mockReset().mockResolvedValue("tok-xyz");
  vi.stubGlobal("Notification", { permission: "default", requestPermission: vi.fn().mockResolvedValue("granted") });
  vi.stubGlobal("navigator", { serviceWorker: { register: vi.fn().mockResolvedValue({}) } });
});

describe("usePushNotifications", () => {
  it("enable() stores the token after permission is granted", async () => {
    const { result } = renderHook(() => usePushNotifications());
    await waitFor(() => expect(result.current.status).toBe("default"));
    await act(async () => { await result.current.enable(); });
    expect(getToken).toHaveBeenCalled();
    expect(registerToken).toHaveBeenCalledWith("u1", "tok-xyz");
  });
});
```

- [ ] **Step 2b: Run to verify it fails** — `pnpm --filter @retrorganizer/web test -- usePushNotifications` (cannot resolve module).

- [ ] **Step 3: Implement `usePushNotifications.ts`:**

```tsx
import { useCallback, useEffect, useState } from "react";
import { isSupported, getMessaging, getToken, onMessage } from "firebase/messaging";
import { fcmTokensRepo } from "@retrorganizer/core";
import { bootstrapFirebase } from "../firebaseConfig";
import { useAuth } from "../auth/AuthProvider";

type Status = "unsupported" | "default" | "granted" | "denied";

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined;

export interface UsePushNotifications {
  status: Status;
  enable(): Promise<void>;
}

export function usePushNotifications(): UsePushNotifications {
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  const [status, setStatus] = useState<Status>("unsupported");

  useEffect(() => {
    let active = true;
    void (async () => {
      const ok = (await isSupported().catch(() => false)) && typeof Notification !== "undefined";
      if (!active) return;
      setStatus(ok ? (Notification.permission as Status) : "unsupported");
    })();
    return () => { active = false; };
  }, []);

  const enable = useCallback(async () => {
    if (!uid || typeof Notification === "undefined") return;
    const permission = await Notification.requestPermission();
    setStatus(permission as Status);
    if (permission !== "granted") return;
    const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
    const { app } = bootstrapFirebase();
    const messaging = getMessaging(app);
    const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: registration });
    if (token) await fcmTokensRepo.registerToken(uid, token);
    // Foreground messages: the in-app reminder toast already covers this, so suppress here to avoid double-notifying.
    onMessage(messaging, () => {});
  }, [uid]);

  return { status, enable };
}
```

> NOTE for the implementer: `bootstrapFirebase()` currently returns the cached `{ app, auth, db }` from `initFirebase`. Confirm it returns `app`; if its shape differs, adapt the destructure. Do not change `bootstrapFirebase`'s production behavior.

- [ ] **Step 4: Implement `PushOptIn.tsx`:**

```tsx
import { tokens } from "@retrorganizer/ui";
import { usePushNotifications } from "./usePushNotifications";

export function PushOptIn() {
  const { status, enable } = usePushNotifications();
  if (status !== "default") return null;
  return (
    <button type="button" onClick={() => void enable()}
      title="Recevoir les rappels même quand l'app est fermée"
      style={{ font: `12px ${tokens.font.body}` }}>
      Activer les notifications
    </button>
  );
}
```

- [ ] **Step 5: Mount in `App.tsx`** — import `PushOptIn` and render it in the header, just before the `Catégories` button. Add `vi.mock("./notifications/PushOptIn", () => ({ PushOptIn: () => null }))` to `App.test.tsx` to keep that test free of messaging globals (mirrors how it mocks `ReminderHost`).

- [ ] **Step 6: Run tests + typecheck**

Run: `pnpm --filter @retrorganizer/web test -- usePushNotifications App`
Run: `pnpm --filter @retrorganizer/web typecheck`
Expected: PASS / clean.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/firebaseConfig.ts apps/web/src/notifications apps/web/src/App.tsx apps/web/src/App.test.tsx packages/core/src/firebase/app.ts
git commit -m "feat(web): FCM token registration + opt-in button"
```

---

### Task 5: Functions workspace scaffold (esbuild-bundled)

**Files:**
- Modify: `pnpm-workspace.yaml` (add `- "functions"`)
- Create: `functions/package.json`, `functions/tsconfig.json`, `functions/build.mjs` (esbuild), `functions/.gitignore`
- Modify: `firebase.json` (add `functions` block)
- Create: `functions/src/index.ts` (placeholder export, replaced in Task 7)

**Interfaces:** establishes a buildable/typecheckable functions package whose runtime deps are only `firebase-admin` + `firebase-functions`.

- [ ] **Step 1: `pnpm-workspace.yaml`** — add `- "functions"` to the `packages:` list.

- [ ] **Step 2: `functions/package.json`:**

```json
{
  "name": "@retrorganizer/functions",
  "version": "0.0.0",
  "main": "lib/index.js",
  "engines": { "node": "20" },
  "scripts": {
    "build": "node build.mjs",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "lint": "echo 'lint: functions ok'"
  },
  "dependencies": {
    "firebase-admin": "^13.0.0",
    "firebase-functions": "^6.1.0"
  },
  "devDependencies": {
    "esbuild": "^0.24.0",
    "typescript": "^5.5.0",
    "vitest": "^2.0.0"
  }
}
```

(No `type: module` — the bundle is CJS. No `@retrorganizer/core` dependency — core's pure modules are bundled via relative import.)

- [ ] **Step 3: `functions/tsconfig.json`** (extends the repo base; allows reaching into core's src for typecheck):

```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": { "noEmit": true, "module": "ESNext", "moduleResolution": "Bundler", "types": ["node"] },
  "include": ["src", "../packages/core/src"]
}
```

(If `tsc` complains about core's test files, narrow `include` to `["src"]` and rely on esbuild for cross-package resolution — report which you used.)

- [ ] **Step 4: `functions/build.mjs`** (esbuild bundle; externalize the runtime-provided SDKs):

```js
import { build } from "esbuild";

await build({
  entryPoints: ["src/index.ts"],
  bundle: true,
  platform: "node",
  target: "node20",
  format: "cjs",
  outfile: "lib/index.js",
  external: ["firebase-admin", "firebase-admin/*", "firebase-functions", "firebase-functions/*"],
});
```

- [ ] **Step 5: `functions/.gitignore`** → `lib/` and `node_modules/`.

- [ ] **Step 6: `firebase.json`** — add a top-level `functions` block (keep all existing blocks):

```json
  "functions": {
    "source": "functions",
    "runtime": "nodejs20",
    "predeploy": ["pnpm --filter @retrorganizer/functions build"]
  },
```

- [ ] **Step 7: `functions/src/index.ts`** placeholder:

```ts
export const placeholder = true;
```

- [ ] **Step 8: Install + verify build/typecheck**

Run: `pnpm install` (picks up the new workspace package).
Run: `pnpm --filter @retrorganizer/functions build` → emits `functions/lib/index.js`.
Run: `pnpm --filter @retrorganizer/functions typecheck` → clean.

- [ ] **Step 9: Commit**

```bash
git add pnpm-workspace.yaml functions firebase.json pnpm-lock.yaml
git commit -m "chore(functions): esbuild-bundled Cloud Functions workspace scaffold"
```

---

### Task 6: Reminder sweep selection (functions, pure, unit-tested)

**Files:**
- Create: `functions/src/sweep.ts`
- Test: `functions/src/sweep.test.ts`

**Interfaces:**
- Consumes (relative import): `computeDueReminders`, `computeDueTaskReminders` from `../../packages/core/src/reminders/dueReminders`; `Event` from `../../packages/core/src/domain/event`; `Task` from `../../packages/core/src/domain/task`.
- Produces: `dueNotifications(events: Event[], tasks: Task[], fromMs: number, toMs: number): { title: string; body: string }[]` — merges event + task hits over `(fromMs, toMs]` and maps each to a notification payload. Task 7 calls this per owner.

- [ ] **Step 1: Write the test** `functions/src/sweep.test.ts` (pure, no emulator):

```ts
import { describe, it, expect } from "vitest";
import { dueNotifications } from "./sweep";
import { parseEvent } from "../../packages/core/src/domain/event";
import { parseTask } from "../../packages/core/src/domain/task";

const T = Date.UTC(2026, 0, 5, 9, 0, 0);
const MIN = 60000;

describe("dueNotifications", () => {
  it("emits a payload for an event reminder due in the window", () => {
    const e = parseEvent({ id: "e1", ownerId: "u1", createdAt: 1, updatedAt: 1, deletedAt: null, title: "Réunion", start: T, end: T + 3600000, reminderOffsets: [10] });
    const out = dueNotifications([e], [], T - 10 * MIN - 1, T - 10 * MIN);
    expect(out).toHaveLength(1);
    expect(out[0]!.title).toBe("Réunion");
  });

  it("emits a payload for a task reminder and skips done/no-due tasks", () => {
    const t = parseTask({ id: "t1", ownerId: "u1", createdAt: 1, updatedAt: 1, deletedAt: null, title: "Rapport", dueDate: T, reminderOffsets: [60] });
    const done = parseTask({ id: "t2", ownerId: "u1", createdAt: 1, updatedAt: 1, deletedAt: null, title: "X", dueDate: T, reminderOffsets: [60], status: "done" });
    const out = dueNotifications([], [t, done], T - 60 * MIN - 1, T - 60 * MIN);
    expect(out.map((n) => n.title)).toEqual(["Rapport"]);
  });

  it("returns nothing when no reminders fall in the window", () => {
    expect(dueNotifications([], [], T - 1, T)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify it fails** — `pnpm --filter @retrorganizer/functions test -- sweep`.

- [ ] **Step 3: Implement `functions/src/sweep.ts`:**

```ts
import { computeDueReminders, computeDueTaskReminders } from "../../packages/core/src/reminders/dueReminders";
import type { Event } from "../../packages/core/src/domain/event";
import type { Task } from "../../packages/core/src/domain/task";

export interface NotificationPayload {
  title: string;
  body: string;
}

export function dueNotifications(events: Event[], tasks: Task[], fromMs: number, toMs: number): NotificationPayload[] {
  const hits = [
    ...computeDueReminders(events, fromMs, toMs),
    ...computeDueTaskReminders(tasks, fromMs, toMs),
  ];
  return hits.map((h) => ({
    title: h.title,
    body: h.type === "task" ? "Rappel de tâche" : "Rappel d'événement",
  }));
}
```

- [ ] **Step 4: Run (pass) + typecheck + build**

Run: `pnpm --filter @retrorganizer/functions test -- sweep` → PASS.
Run: `pnpm --filter @retrorganizer/functions typecheck` → clean.
Run: `pnpm --filter @retrorganizer/functions build` → bundles (confirms the relative core import + zod/rrule bundle with no firebase-client code; grep `functions/lib/index.js` for `firebase/firestore` → should be absent).

- [ ] **Step 5: Commit**

```bash
git add functions/src/sweep.ts functions/src/sweep.test.ts
git commit -m "feat(functions): pure dueNotifications selection (reuses core)"
```

---

### Task 7: Scheduled push function (functions)

**Files:**
- Modify: `functions/src/index.ts` (the scheduled function + orchestration)
- Create: `functions/src/orchestrate.ts` (testable orchestration core)
- Test: `functions/src/orchestrate.test.ts`

**Interfaces:**
- Consumes: `dueNotifications` (Task 6), `parseEvent`/`parseTask` (core, relative), firebase-admin (`firestore`, `messaging`).
- Produces: `sendReminders` scheduled function (`onSchedule("every 5 minutes", ...)`) and a pure `planSends(owners)` helper that, given per-owner `{ ownerId, tokens, events, tasks, lastCheck }` and `now`, returns `{ ownerId, tokens, payloads }[]` (testable without admin).

- [ ] **Step 1: Write the orchestration test** `functions/src/orchestrate.test.ts` (pure; mock nothing — `planSends` takes plain data):

```ts
import { describe, it, expect } from "vitest";
import { planSends } from "./orchestrate";
import { parseEvent } from "../../packages/core/src/domain/event";

const T = Date.UTC(2026, 0, 5, 9, 0, 0);
const MIN = 60000;

describe("planSends", () => {
  it("produces sends only for owners with due reminders and tokens", () => {
    const e = parseEvent({ id: "e1", ownerId: "u1", createdAt: 1, updatedAt: 1, deletedAt: null, title: "Réu", start: T, end: T + 3600000, reminderOffsets: [10] });
    const owners = [
      { ownerId: "u1", tokens: ["tA", "tB"], events: [e], tasks: [], lastCheck: T - 10 * MIN - 1 },
      { ownerId: "u2", tokens: ["tC"], events: [], tasks: [], lastCheck: T - 10 * MIN - 1 },
    ];
    const sends = planSends(owners, T - 10 * MIN);
    expect(sends).toHaveLength(1);
    expect(sends[0]!.ownerId).toBe("u1");
    expect(sends[0]!.tokens).toEqual(["tA", "tB"]);
    expect(sends[0]!.payloads[0]!.title).toBe("Réu");
  });
});
```

- [ ] **Step 2: Run to verify it fails.**

- [ ] **Step 3: Implement `functions/src/orchestrate.ts`:**

```ts
import { dueNotifications, type NotificationPayload } from "./sweep";
import type { Event } from "../../packages/core/src/domain/event";
import type { Task } from "../../packages/core/src/domain/task";

export interface OwnerWork {
  ownerId: string;
  tokens: string[];
  events: Event[];
  tasks: Task[];
  lastCheck: number;
}
export interface OwnerSend {
  ownerId: string;
  tokens: string[];
  payloads: NotificationPayload[];
}

export function planSends(owners: OwnerWork[], nowMs: number): OwnerSend[] {
  const sends: OwnerSend[] = [];
  for (const o of owners) {
    if (o.tokens.length === 0) continue;
    const payloads = dueNotifications(o.events, o.tasks, o.lastCheck, nowMs);
    if (payloads.length > 0) sends.push({ ownerId: o.ownerId, tokens: o.tokens, payloads });
  }
  return sends;
}
```

- [ ] **Step 4: Implement the scheduled function in `functions/src/index.ts`** (the IO wrapper around `planSends`; not unit-tested — verified post-deploy):

```ts
import { onSchedule } from "firebase-functions/v2/scheduler";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { parseEvent } from "../../packages/core/src/domain/event";
import { parseTask } from "../../packages/core/src/domain/task";
import { planSends, type OwnerWork } from "./orchestrate";

initializeApp();
const HALF_OPEN_DEFAULT_LOOKBACK = 6 * 60 * 60000; // first run / missing state: look back 6h

export const sendReminders = onSchedule("every 5 minutes", async () => {
  const db = getFirestore();
  const now = Date.now();

  // Owners that have at least one registered device.
  const tokensSnap = await db.collection("fcmTokens").get();
  const tokensByOwner = new Map<string, string[]>();
  for (const d of tokensSnap.docs) {
    const ownerId = d.get("ownerId") as string | undefined;
    if (!ownerId) continue;
    const arr = tokensByOwner.get(ownerId) ?? [];
    arr.push(d.id);
    tokensByOwner.set(ownerId, arr);
  }

  const work: OwnerWork[] = [];
  for (const [ownerId, tokens] of tokensByOwner) {
    const stateRef = db.doc(`reminderState/${ownerId}`);
    const stateSnap = await stateRef.get();
    const lastCheck = (stateSnap.get("lastCheck") as number | undefined) ?? now - HALF_OPEN_DEFAULT_LOOKBACK;
    const [evSnap, tkSnap] = await Promise.all([
      db.collection("events").where("ownerId", "==", ownerId).where("deletedAt", "==", null).get(),
      db.collection("tasks").where("ownerId", "==", ownerId).where("deletedAt", "==", null).get(),
    ]);
    work.push({
      ownerId, tokens,
      events: evSnap.docs.map((d) => parseEvent(d.data())),
      tasks: tkSnap.docs.map((d) => parseTask(d.data())),
      lastCheck,
    });
  }

  const messaging = getMessaging();
  for (const send of planSends(work, now)) {
    for (const p of send.payloads) {
      const res = await messaging.sendEachForMulticast({ tokens: send.tokens, notification: p });
      // Prune tokens that FCM reports as unregistered.
      res.responses.forEach((r, i) => {
        if (!r.success && r.error?.code === "messaging/registration-token-not-registered") {
          void db.collection("fcmTokens").doc(send.tokens[i]!).delete();
        }
      });
    }
    await db.doc(`reminderState/${send.ownerId}`).set({ lastCheck: now }, { merge: true });
  }
});
```

> Advance `lastCheck` only for owners we processed a send for. (Owners with tokens but no due reminders keep their prior `lastCheck`, so a reminder that becomes due between runs is not skipped — the window stays half-open and continuous. If you prefer to advance every token-owner's `lastCheck` each run, note the tradeoff in the report; the test only pins `planSends`.)

- [ ] **Step 5: Run the orchestration test (pass) + typecheck + build**

Run: `pnpm --filter @retrorganizer/functions test` → PASS (sweep + orchestrate).
Run: `pnpm --filter @retrorganizer/functions typecheck` → clean.
Run: `pnpm --filter @retrorganizer/functions build` → bundles `lib/index.js`; grep it for `firebase/firestore` (client SDK) → ABSENT; for `onSchedule` → present.

- [ ] **Step 6: Commit**

```bash
git add functions/src/index.ts functions/src/orchestrate.ts functions/src/orchestrate.test.ts
git commit -m "feat(functions): scheduled FCM reminder push (every 5 min)"
```

---

### Task 8: Deployment docs (FCM section)

**Files:**
- Modify: `docs/deployment.md`

- [ ] **Step 1: Add an "Out-of-app push (FCM)" section** covering, in prose:
  - **Blaze plan required** — Cloud Functions + Cloud Scheduler need pay-as-you-go billing enabled.
  - **Enable Cloud Messaging** and generate a **Web Push certificate (VAPID key)** → set `VITE_FIREBASE_VAPID_KEY` + `VITE_FIREBASE_MESSAGING_SENDER_ID` in the web build env (and as CI variables).
  - **Edit `apps/web/public/firebase-messaging-sw.js`** placeholders to the prod web config (these are public values; the SW can't read Vite env).
  - **Deploy functions**: `firebase deploy --only functions` (and add `functions` to the CI deploy's `--only` list once Blaze is on). First deploy creates the Cloud Scheduler job.
  - **How it works / coexistence**: scheduled every 5 min; in-app reminders still cover the foreground; foreground FCM messages are suppressed to avoid double-notifying. Tokens are stored in `fcmTokens` and pruned automatically when FCM reports them unregistered.
  - **Verify**: grant permission via "Activer les notifications", close the tab, create an event a few minutes out with a reminder, confirm the OS notification fires.

- [ ] **Step 2: Commit**

```bash
git add docs/deployment.md
git commit -m "docs: FCM push setup + verification in the deployment runbook"
```

---

## Final verification (whole branch)

- [ ] Full suite under the emulator: `pnpm exec firebase emulators:exec --only auth,firestore "pnpm test"` — core (+ fcmTokens/rules), web (+ usePushNotifications), functions (sweep + orchestrate) all green.
- [ ] `pnpm --filter @retrorganizer/functions build` and `pnpm --filter @retrorganizer/web build` succeed; the functions bundle contains no `firebase/firestore` client import.
- [ ] State clearly in the PR what was unit-tested vs. what the user must verify on a deployed Blaze project (token delivery, SW registration, the scheduled trigger).
