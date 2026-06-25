# Retrorganizer — Phase 0 : Fondations — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Poser le socle du monorepo Retrorganizer : pnpm/Turborepo, `packages/core` (domaine + repositories Firestore testés sur émulateur), `packages/ui` (design tokens rétro), `apps/web` (coque à 8 onglets, routing, auth email + Google), Security Rules, et CI. Livrable vérifiable : l'app se build, le login fonctionne, on navigue entre les 8 sections.

**Architecture:** Monorepo pnpm + Turborepo. La logique métier vit dans `packages/core` (plateforme-agnostique, réutilisable en React Native plus tard) derrière une couche de repositories abstraite au-dessus du SDK Firebase JS. `apps/web` (React + Vite) ne parle jamais directement à Firestore : il consomme `core` via des hooks. Le design rétro est centralisé dans `packages/ui` (tokens + primitives).

**Tech Stack:** pnpm workspaces, Turborepo, TypeScript (strict), Vite, React 18, React Router, Firebase JS SDK (Auth + Firestore), zod, Vitest, @testing-library/react, @firebase/rules-unit-testing, Firebase Emulator Suite, GitHub Actions.

## Global Constraints

- Nom produit : **Retrorganizer** (verbatim dans titres, manifeste, login).
- TypeScript **strict** activé partout (`"strict": true`).
- Aucune app ne parle directement à Firestore — uniquement via `packages/core/repositories`.
- Toutes les entités portent `id`, `ownerId`, `createdAt`, `updatedAt`, `deletedAt` (soft-delete).
- Isolation par utilisateur via Security Rules `request.auth.uid == resource.data.ownerId`.
- Auth : email/mot de passe **et** OAuth Google (Firebase Auth).
- 8 onglets présents dès la Phase 0 : Diary, ToDo, Address, Notepad, Planner, Anniversary, Web, Calls. Les 4 hors-MVP affichent « Bientôt disponible ».
- Tests sur émulateur Firestore (jamais sur un projet réel).
- Commits fréquents, un par tâche minimum.

---

## File Structure

```
package.json                 Racine : scripts pnpm/turbo, devDeps partagées
pnpm-workspace.yaml          Déclare apps/* et packages/*
turbo.json                   Pipeline build/test/lint/typecheck
tsconfig.base.json           Config TS stricte partagée
.firebaserc / firebase.json  Projet Firebase, émulateurs, hosting
firestore.rules              Security Rules (isolation par ownerId)
firestore.indexes.json       Index composites
.github/workflows/ci.yml     CI : install, lint, typecheck, test

packages/core/
  src/domain/types.ts        Types de domaine + champs communs (BaseEntity)
  src/domain/contact.ts      Modèle Contact + schéma zod + validation
  src/firebase/app.ts        Singleton Firebase (app, auth, db) + connexion émulateur
  src/repositories/base.ts   createRepository<T>() générique (CRUD + soft-delete)
  src/repositories/contacts.ts  ContactsRepo
  src/index.ts               Exports publics du package

packages/ui/
  src/tokens.ts              Palette rétro, accents par module, typographie, espacements
  src/components/Tab.tsx     Onglet vertical coloré
  src/index.ts               Exports

apps/web/
  index.html
  src/main.tsx               Bootstrap React + Router
  src/App.tsx                Layout : menu bar, toolbar, onglets, zone page
  src/auth/AuthProvider.tsx  Contexte auth (email + Google)
  src/auth/LoginScreen.tsx   Écran de login
  src/routes/sections.ts     Définition des 8 sections (id, label, couleur, route)
  src/routes/ComingSoon.tsx  Placeholder « Bientôt disponible »
```

---

### Task 1: Initialiser le monorepo (pnpm + Turborepo)

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.base.json`, `.nvmrc`

**Interfaces:**
- Consumes: rien (premier task).
- Produces: workspace pnpm fonctionnel ; scripts `pnpm build|test|lint|typecheck` délégués à Turborepo ; `tsconfig.base.json` (strict) étendu par tous les packages.

- [ ] **Step 1: Créer `.nvmrc`**

```
20
```

- [ ] **Step 2: Créer `pnpm-workspace.yaml`**

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

- [ ] **Step 3: Créer `tsconfig.base.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "resolveJsonModule": true,
    "isolatedModules": true
  }
}
```

- [ ] **Step 4: Créer `turbo.json`**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": { "dependsOn": ["^build"], "outputs": ["dist/**"] },
    "test": { "dependsOn": ["^build"] },
    "lint": {},
    "typecheck": { "dependsOn": ["^build"] }
  }
}
```

- [ ] **Step 5: Créer `package.json` racine**

```json
{
  "name": "retrorganizer",
  "private": true,
  "packageManager": "pnpm@9.0.0",
  "scripts": {
    "build": "turbo build",
    "test": "turbo test",
    "lint": "turbo lint",
    "typecheck": "turbo typecheck",
    "dev": "turbo dev"
  },
  "devDependencies": {
    "turbo": "^2.0.0",
    "typescript": "^5.5.0"
  }
}
```

- [ ] **Step 6: Installer et vérifier**

Run: `pnpm install`
Expected: installation OK, création de `pnpm-lock.yaml`, message « Done ».

Run: `pnpm exec turbo --version`
Expected: affiche `2.x.x`.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: scaffold pnpm + turborepo monorepo"
```

---

### Task 2: `packages/core` — modèle Contact + validation (établit le pattern TDD)

**Files:**
- Create: `packages/core/package.json`, `packages/core/tsconfig.json`, `packages/core/vitest.config.ts`
- Create: `packages/core/src/domain/types.ts`, `packages/core/src/domain/contact.ts`, `packages/core/src/index.ts`
- Test: `packages/core/src/domain/contact.test.ts`

**Interfaces:**
- Consumes: `tsconfig.base.json` (Task 1).
- Produces:
  - `BaseEntity` = `{ id: string; ownerId: string; createdAt: number; updatedAt: number; deletedAt: number | null }`
  - `Contact extends BaseEntity` avec `firstName, lastName, displayName, organization?, title?, phones: LabeledValue[], emails: LabeledValue[], addresses: PostalAddress[], webLinks: LabeledValue[], importantDates: LabeledDate[], notes?, customFields: KeyValue[], categoryId: string | null, tags: string[]`
  - `LabeledValue = { label: string; value: string }`
  - `contactSchema` (zod) et `parseContact(input: unknown): Contact`

- [ ] **Step 1: Créer `packages/core/package.json`**

```json
{
  "name": "@retrorganizer/core",
  "version": "0.0.0",
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc --noEmit",
    "lint": "echo 'lint: core ok'"
  },
  "dependencies": {
    "firebase": "^10.12.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Step 2: Créer `packages/core/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "outDir": "dist", "rootDir": "src" },
  "include": ["src"]
}
```

- [ ] **Step 3: Créer `packages/core/vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { environment: "node", include: ["src/**/*.test.ts"] },
});
```

- [ ] **Step 4: Créer `packages/core/src/domain/types.ts`**

```ts
export interface BaseEntity {
  id: string;
  ownerId: string;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}

export interface LabeledValue {
  label: string;
  value: string;
}

export interface PostalAddress {
  label: string;
  street: string;
  city: string;
  postalCode: string;
  country: string;
}

export interface LabeledDate {
  label: string;
  date: string; // ISO yyyy-mm-dd
}

export interface KeyValue {
  key: string;
  value: string;
}
```

- [ ] **Step 5: Écrire le test qui échoue — `packages/core/src/domain/contact.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { parseContact } from "./contact";

describe("parseContact", () => {
  it("accepts a minimal valid contact and defaults arrays", () => {
    const c = parseContact({
      id: "c1",
      ownerId: "u1",
      createdAt: 1,
      updatedAt: 1,
      deletedAt: null,
      firstName: "Ada",
      lastName: "Lovelace",
      displayName: "Ada Lovelace",
    });
    expect(c.displayName).toBe("Ada Lovelace");
    expect(c.phones).toEqual([]);
    expect(c.tags).toEqual([]);
    expect(c.categoryId).toBeNull();
  });

  it("rejects a contact without ownerId", () => {
    expect(() =>
      parseContact({ id: "c1", displayName: "X" }),
    ).toThrow();
  });
});
```

- [ ] **Step 6: Lancer le test pour confirmer l'échec**

Run: `pnpm --filter @retrorganizer/core test`
Expected: FAIL — « Cannot find module './contact' » ou « parseContact is not a function ».

- [ ] **Step 7: Implémenter `packages/core/src/domain/contact.ts`**

```ts
import { z } from "zod";
import type { BaseEntity, LabeledValue, PostalAddress, LabeledDate, KeyValue } from "./types";

const labeledValue = z.object({ label: z.string(), value: z.string() });
const postalAddress = z.object({
  label: z.string(),
  street: z.string(),
  city: z.string(),
  postalCode: z.string(),
  country: z.string(),
});
const labeledDate = z.object({ label: z.string(), date: z.string() });
const keyValue = z.object({ key: z.string(), value: z.string() });

export const contactSchema = z.object({
  id: z.string(),
  ownerId: z.string().min(1),
  createdAt: z.number(),
  updatedAt: z.number(),
  deletedAt: z.number().nullable(),
  firstName: z.string().default(""),
  lastName: z.string().default(""),
  displayName: z.string().min(1),
  organization: z.string().optional(),
  title: z.string().optional(),
  phones: z.array(labeledValue).default([]),
  emails: z.array(labeledValue).default([]),
  addresses: z.array(postalAddress).default([]),
  webLinks: z.array(labeledValue).default([]),
  importantDates: z.array(labeledDate).default([]),
  notes: z.string().optional(),
  customFields: z.array(keyValue).default([]),
  categoryId: z.string().nullable().default(null),
  tags: z.array(z.string()).default([]),
});

export type Contact = z.infer<typeof contactSchema> & BaseEntity;
export type { LabeledValue, PostalAddress, LabeledDate, KeyValue };

export function parseContact(input: unknown): Contact {
  return contactSchema.parse(input) as Contact;
}
```

- [ ] **Step 8: Créer `packages/core/src/index.ts`**

```ts
export * from "./domain/types";
export * from "./domain/contact";
```

- [ ] **Step 9: Lancer le test pour confirmer le succès**

Run: `pnpm --filter @retrorganizer/core test`
Expected: PASS — 2 tests verts.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat(core): add Contact domain model with zod validation"
```

---

### Task 3: Firebase + Security Rules (testées sur émulateur)

**Files:**
- Create: `firebase.json`, `.firebaserc`, `firestore.rules`, `firestore.indexes.json`, `.env.example`
- Create: `packages/core/src/firebase/app.ts`
- Test: `packages/core/src/firebase/rules.test.ts`

**Interfaces:**
- Consumes: rien de neuf.
- Produces:
  - `firestore.rules` : isolation `request.auth.uid == resource.data.ownerId` sur toutes les collections.
  - `getFirebase(): { app, auth, db }` — singleton ; en dev/test, connexion aux émulateurs si `VITE_USE_EMULATORS` / `FIRESTORE_EMULATOR_HOST`.

- [ ] **Step 1: Créer `.firebaserc`**

```json
{ "projects": { "default": "retrorganizer-dev" } }
```

- [ ] **Step 2: Créer `firebase.json`**

```json
{
  "firestore": {
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  },
  "hosting": {
    "public": "apps/web/dist",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [{ "source": "**", "destination": "/index.html" }]
  },
  "emulators": {
    "auth": { "port": 9099 },
    "firestore": { "port": 8080 },
    "ui": { "enabled": true }
  }
}
```

- [ ] **Step 3: Créer `firestore.rules`**

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isOwner() {
      return request.auth != null && request.auth.uid == resource.data.ownerId;
    }
    function isCreatingOwn() {
      return request.auth != null && request.auth.uid == request.resource.data.ownerId;
    }
    match /{collection}/{docId} {
      allow read, delete: if isOwner();
      allow update: if isOwner() && isCreatingOwn();
      allow create: if isCreatingOwn();
    }
  }
}
```

- [ ] **Step 4: Créer `firestore.indexes.json`**

```json
{
  "indexes": [
    {
      "collectionGroup": "events",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "ownerId", "order": "ASCENDING" },
        { "fieldPath": "start", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "tasks",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "ownerId", "order": "ASCENDING" },
        { "fieldPath": "dueDate", "order": "ASCENDING" }
      ]
    }
  ],
  "fieldOverrides": []
}
```

- [ ] **Step 5: Créer `.env.example`**

```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=retrorganizer-dev
VITE_FIREBASE_APP_ID=
VITE_USE_EMULATORS=true
```

- [ ] **Step 6: Implémenter `packages/core/src/firebase/app.ts`**

```ts
import { initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, connectAuthEmulator, type Auth } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator, type Firestore } from "firebase/firestore";

export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
}

let cached: { app: FirebaseApp; auth: Auth; db: Firestore } | null = null;

export function initFirebase(config: FirebaseConfig, useEmulators = false) {
  if (cached) return cached;
  const app = initializeApp(config);
  const auth = getAuth(app);
  const db = getFirestore(app);
  if (useEmulators) {
    connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
    connectFirestoreEmulator(db, "127.0.0.1", 8080);
  }
  cached = { app, auth, db };
  return cached;
}

export function getFirebase() {
  if (!cached) throw new Error("Firebase not initialized — call initFirebase() first");
  return cached;
}
```

- [ ] **Step 7: Ajouter la devDep de test des rules**

Run: `pnpm --filter @retrorganizer/core add -D @firebase/rules-unit-testing`
Expected: ajout au `package.json` de core.

- [ ] **Step 8: Écrire le test des rules — `packages/core/src/firebase/rules.test.ts`**

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFileSync } from "node:fs";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, setDoc, getDoc } from "firebase/firestore";

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "retrorganizer-dev",
    firestore: { rules: readFileSync("../../firestore.rules", "utf8") },
  });
});

afterAll(async () => { await env.cleanup(); });

describe("firestore rules", () => {
  it("lets a user create their own contact", async () => {
    const db = env.authenticatedContext("u1").firestore();
    await assertSucceeds(
      setDoc(doc(db, "contacts/c1"), { ownerId: "u1", displayName: "Ada" }),
    );
  });

  it("forbids reading another user's contact", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "contacts/c2"), { ownerId: "u1", displayName: "Ada" });
    });
    const db = env.authenticatedContext("intruder").firestore();
    await assertFails(getDoc(doc(db, "contacts/c2")));
  });
});
```

- [ ] **Step 9: Lancer l'émulateur Firestore puis les tests**

Run (terminal 1, laisser tourner) : `pnpm exec firebase emulators:start --only firestore`
Expected: « All emulators ready », Firestore sur `127.0.0.1:8080`.

Run (terminal 2) : `pnpm --filter @retrorganizer/core test -- rules`
Expected: PASS — 2 tests verts (création autorisée, lecture croisée refusée).

> Note exécutant : si `firebase` n'est pas dispo, l'ajouter en devDep racine
> (`pnpm add -Dw firebase-tools`) ou l'avoir en CLI globale.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat(core): firebase init + firestore security rules with emulator tests"
```

---

### Task 4: Repository générique + ContactsRepo (testé sur émulateur)

**Files:**
- Create: `packages/core/src/repositories/base.ts`, `packages/core/src/repositories/contacts.ts`
- Modify: `packages/core/src/index.ts` (exporter les repositories)
- Test: `packages/core/src/repositories/contacts.test.ts`

**Interfaces:**
- Consumes: `getFirebase()` (Task 3), `Contact` / `parseContact` (Task 2).
- Produces:
  - `createRepository<T extends BaseEntity>(collectionName, parse)` → `{ create, get, update, softDelete, listByOwner }`
  - `create(ownerId, data): Promise<T>` (génère id + timestamps, `deletedAt: null`)
  - `get(id): Promise<T | null>` (retourne `null` si `deletedAt` non-null)
  - `update(id, patch): Promise<void>` (met `updatedAt`)
  - `softDelete(id): Promise<void>` (met `deletedAt`)
  - `listByOwner(ownerId): Promise<T[]>` (exclut les soft-deleted)
  - `contactsRepo` = `createRepository<Contact>("contacts", parseContact)`

- [ ] **Step 1: Écrire le test — `packages/core/src/repositories/contacts.test.ts`**

```ts
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { initFirebase } from "../firebase/app";
import { contactsRepo } from "./contacts";
import { getFirebase } from "../firebase/app";
import { collection, getDocs, deleteDoc, doc } from "firebase/firestore";

beforeAll(() => {
  initFirebase(
    { apiKey: "x", authDomain: "x", projectId: "retrorganizer-dev", appId: "x" },
    true,
  );
});

afterEach(async () => {
  const { db } = getFirebase();
  const snap = await getDocs(collection(db, "contacts"));
  await Promise.all(snap.docs.map((d) => deleteDoc(doc(db, "contacts", d.id))));
});

describe("contactsRepo", () => {
  it("creates and reads back a contact", async () => {
    const created = await contactsRepo.create("u1", { displayName: "Ada Lovelace" });
    expect(created.id).toBeTruthy();
    expect(created.ownerId).toBe("u1");
    expect(created.deletedAt).toBeNull();
    const fetched = await contactsRepo.get(created.id);
    expect(fetched?.displayName).toBe("Ada Lovelace");
  });

  it("hides soft-deleted contacts from get and list", async () => {
    const c = await contactsRepo.create("u1", { displayName: "Temp" });
    await contactsRepo.softDelete(c.id);
    expect(await contactsRepo.get(c.id)).toBeNull();
    const list = await contactsRepo.listByOwner("u1");
    expect(list.find((x) => x.id === c.id)).toBeUndefined();
  });
});
```

- [ ] **Step 2: Lancer pour confirmer l'échec**

Run (émulateur Firestore actif) : `pnpm --filter @retrorganizer/core test -- contacts.test`
Expected: FAIL — module `./contacts` introuvable.

- [ ] **Step 3: Implémenter `packages/core/src/repositories/base.ts`**

```ts
import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc, query, where,
} from "firebase/firestore";
import { getFirebase } from "../firebase/app";
import type { BaseEntity } from "../domain/types";

export interface Repository<T extends BaseEntity> {
  create(ownerId: string, data: Partial<T>): Promise<T>;
  get(id: string): Promise<T | null>;
  update(id: string, patch: Partial<T>): Promise<void>;
  softDelete(id: string): Promise<void>;
  listByOwner(ownerId: string): Promise<T[]>;
}

export function createRepository<T extends BaseEntity>(
  collectionName: string,
  parse: (input: unknown) => T,
): Repository<T> {
  const col = () => collection(getFirebase().db, collectionName);
  const ref = (id: string) => doc(getFirebase().db, collectionName, id);

  return {
    async create(ownerId, data) {
      const now = Date.now();
      const id = data.id ?? crypto.randomUUID();
      const entity = parse({ ...data, id, ownerId, createdAt: now, updatedAt: now, deletedAt: null });
      await setDoc(ref(id), entity as object);
      return entity;
    },
    async get(id) {
      const snap = await getDoc(ref(id));
      if (!snap.exists()) return null;
      const entity = parse(snap.data());
      return entity.deletedAt === null ? entity : null;
    },
    async update(id, patch) {
      await updateDoc(ref(id), { ...patch, updatedAt: Date.now() });
    },
    async softDelete(id) {
      await updateDoc(ref(id), { deletedAt: Date.now() });
    },
    async listByOwner(ownerId) {
      const q = query(col(), where("ownerId", "==", ownerId), where("deletedAt", "==", null));
      const snap = await getDocs(q);
      return snap.docs.map((d) => parse(d.data()));
    },
  };
}
```

- [ ] **Step 4: Implémenter `packages/core/src/repositories/contacts.ts`**

```ts
import { createRepository } from "./base";
import { parseContact, type Contact } from "../domain/contact";

export const contactsRepo = createRepository<Contact>("contacts", parseContact);
```

- [ ] **Step 5: Exporter depuis `packages/core/src/index.ts`**

```ts
export * from "./domain/types";
export * from "./domain/contact";
export * from "./firebase/app";
export * from "./repositories/base";
export * from "./repositories/contacts";
```

- [ ] **Step 6: Lancer pour confirmer le succès**

Run (émulateur actif) : `pnpm --filter @retrorganizer/core test`
Expected: PASS — tous les tests core verts (domaine + rules + repo).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(core): generic repository + contactsRepo with emulator tests"
```

---

### Task 5: `packages/ui` — design tokens rétro + composant Tab

**Files:**
- Create: `packages/ui/package.json`, `packages/ui/tsconfig.json`, `packages/ui/vitest.config.ts`
- Create: `packages/ui/src/tokens.ts`, `packages/ui/src/components/Tab.tsx`, `packages/ui/src/index.ts`
- Test: `packages/ui/src/components/Tab.test.tsx`

**Interfaces:**
- Consumes: rien.
- Produces:
  - `tokens` : `{ color, moduleAccent, font, space, radius }`
  - `moduleAccent: Record<SectionId, string>` (8 entrées)
  - `<Tab label active accentColor onClick />`

- [ ] **Step 1: Créer `packages/ui/package.json`**

```json
{
  "name": "@retrorganizer/ui",
  "version": "0.0.0",
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc --noEmit",
    "lint": "echo 'lint: ui ok'"
  },
  "peerDependencies": { "react": "^18.3.0", "react-dom": "^18.3.0" },
  "devDependencies": {
    "@testing-library/react": "^16.0.0",
    "@testing-library/jest-dom": "^6.4.0",
    "@types/react": "^18.3.0",
    "jsdom": "^24.0.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Step 2: Créer `packages/ui/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "jsx": "react-jsx", "outDir": "dist", "rootDir": "src" },
  "include": ["src"]
}
```

- [ ] **Step 3: Créer `packages/ui/vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["@testing-library/jest-dom/vitest"],
    include: ["src/**/*.test.tsx"],
  },
});
```

- [ ] **Step 4: Implémenter `packages/ui/src/tokens.ts`**

```ts
export type SectionId =
  | "diary" | "todo" | "address" | "notepad"
  | "planner" | "anniversary" | "web" | "calls";

export const moduleAccent: Record<SectionId, string> = {
  diary: "#2f6f4f",        // vert sapin
  todo: "#a8431f",         // brique
  address: "#1f4e79",      // bleu encre
  notepad: "#b8860b",      // ocre
  planner: "#5b3a8c",      // prune
  anniversary: "#9c2b4e",  // grenat
  web: "#0f6e6e",          // sarcelle
  calls: "#6b6b1f",        // olive
};

export const tokens = {
  color: {
    paper: "#f4f1e8",
    ink: "#2b2b2b",
    line: "#cfc8b8",
    surface: "#fbfaf5",
    muted: "#7a766a",
  },
  font: {
    body: "'Segoe UI', system-ui, sans-serif",
    mono: "'Cascadia Code', ui-monospace, monospace",
  },
  space: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 },
  radius: { sm: 2, md: 4 },
} as const;
```

- [ ] **Step 5: Écrire le test — `packages/ui/src/components/Tab.test.tsx`**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Tab } from "./Tab";

describe("Tab", () => {
  it("renders its label and marks active state", () => {
    render(<Tab label="Diary" active accentColor="#2f6f4f" onClick={() => {}} />);
    const btn = screen.getByRole("tab", { name: "Diary" });
    expect(btn).toHaveAttribute("aria-selected", "true");
  });

  it("calls onClick when pressed", () => {
    const onClick = vi.fn();
    render(<Tab label="ToDo" active={false} accentColor="#a8431f" onClick={onClick} />);
    screen.getByRole("tab", { name: "ToDo" }).click();
    expect(onClick).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 6: Lancer pour confirmer l'échec**

Run: `pnpm --filter @retrorganizer/ui test`
Expected: FAIL — module `./Tab` introuvable.

- [ ] **Step 7: Implémenter `packages/ui/src/components/Tab.tsx`**

```tsx
import { tokens } from "../tokens";

export interface TabProps {
  label: string;
  active: boolean;
  accentColor: string;
  onClick: () => void;
}

export function Tab({ label, active, accentColor, onClick }: TabProps) {
  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={onClick}
      style={{
        display: "block",
        width: "100%",
        textAlign: "left",
        padding: `${tokens.space.sm}px ${tokens.space.md}px`,
        border: "none",
        borderLeft: `4px solid ${active ? accentColor : "transparent"}`,
        background: active ? tokens.color.surface : "transparent",
        color: tokens.color.ink,
        font: `14px ${tokens.font.body}`,
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}
```

- [ ] **Step 8: Créer `packages/ui/src/index.ts`**

```ts
export * from "./tokens";
export * from "./components/Tab";
```

- [ ] **Step 9: Lancer pour confirmer le succès**

Run: `pnpm --filter @retrorganizer/ui test`
Expected: PASS — 2 tests verts.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat(ui): retro design tokens + Tab component"
```

---

### Task 6: `apps/web` — scaffold Vite + React + Router

**Files:**
- Create: `apps/web/package.json`, `apps/web/tsconfig.json`, `apps/web/vite.config.ts`, `apps/web/index.html`
- Create: `apps/web/src/main.tsx`, `apps/web/src/routes/sections.ts`, `apps/web/src/routes/ComingSoon.tsx`
- Test: `apps/web/src/routes/sections.test.ts`

**Interfaces:**
- Consumes: `@retrorganizer/ui` (tokens, SectionId), `@retrorganizer/core`.
- Produces:
  - `SECTIONS: Section[]` où `Section = { id: SectionId; label: string; path: string; mvp: boolean }`
  - `<ComingSoon label />`

- [ ] **Step 1: Créer `apps/web/package.json`**

```json
{
  "name": "@retrorganizer/web",
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "test": "vitest run",
    "typecheck": "tsc --noEmit",
    "lint": "echo 'lint: web ok'"
  },
  "dependencies": {
    "@retrorganizer/core": "workspace:*",
    "@retrorganizer/ui": "workspace:*",
    "firebase": "^10.12.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "react-router-dom": "^6.24.0"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.4.0",
    "@testing-library/react": "^16.0.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "jsdom": "^24.0.0",
    "vite": "^5.3.0",
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Step 2: Créer `apps/web/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "jsx": "react-jsx", "noEmit": true },
  "include": ["src"]
}
```

- [ ] **Step 3: Créer `apps/web/vite.config.ts`**

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["@testing-library/jest-dom/vitest"],
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
```

- [ ] **Step 4: Créer `apps/web/index.html`**

```html
<!doctype html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Retrorganizer</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 5: Écrire le test — `apps/web/src/routes/sections.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { SECTIONS } from "./sections";

describe("SECTIONS", () => {
  it("defines all 8 organizer sections", () => {
    expect(SECTIONS).toHaveLength(8);
    expect(SECTIONS.map((s) => s.id)).toEqual([
      "diary", "todo", "address", "notepad",
      "planner", "anniversary", "web", "calls",
    ]);
  });

  it("marks the 4 MVP sections", () => {
    const mvp = SECTIONS.filter((s) => s.mvp).map((s) => s.id);
    expect(mvp).toEqual(["diary", "todo", "address", "notepad"]);
  });
});
```

- [ ] **Step 6: Lancer pour confirmer l'échec**

Run: `pnpm --filter @retrorganizer/web test`
Expected: FAIL — module `./sections` introuvable.

- [ ] **Step 7: Implémenter `apps/web/src/routes/sections.ts`**

```ts
import type { SectionId } from "@retrorganizer/ui";

export interface Section {
  id: SectionId;
  label: string;
  path: string;
  mvp: boolean;
}

export const SECTIONS: Section[] = [
  { id: "diary", label: "Diary", path: "/diary", mvp: true },
  { id: "todo", label: "To Do", path: "/todo", mvp: true },
  { id: "address", label: "Address", path: "/address", mvp: true },
  { id: "notepad", label: "Notepad", path: "/notepad", mvp: true },
  { id: "planner", label: "Planner", path: "/planner", mvp: false },
  { id: "anniversary", label: "Anniversary", path: "/anniversary", mvp: false },
  { id: "web", label: "Web", path: "/web", mvp: false },
  { id: "calls", label: "Calls", path: "/calls", mvp: false },
];
```

- [ ] **Step 8: Implémenter `apps/web/src/routes/ComingSoon.tsx`**

```tsx
import { tokens } from "@retrorganizer/ui";

export function ComingSoon({ label }: { label: string }) {
  return (
    <div style={{ padding: tokens.space.xl, color: tokens.color.muted }}>
      <h2 style={{ color: tokens.color.ink }}>{label}</h2>
      <p>Bientôt disponible.</p>
    </div>
  );
}
```

- [ ] **Step 9: Lancer pour confirmer le succès**

Run: `pnpm --filter @retrorganizer/web test`
Expected: PASS — 2 tests verts.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat(web): scaffold Vite app + 8 organizer sections"
```

---

### Task 7: Auth (email + Google) + AuthProvider

**Files:**
- Create: `apps/web/src/auth/AuthProvider.tsx`, `apps/web/src/auth/LoginScreen.tsx`, `apps/web/src/firebaseConfig.ts`
- Test: `apps/web/src/auth/AuthProvider.test.tsx`

**Interfaces:**
- Consumes: `initFirebase`, `getFirebase` (core).
- Produces:
  - `<AuthProvider>` (contexte)
  - `useAuth(): { user: { uid: string; email: string | null } | null; loading: boolean; signInEmail(email, pw); signUpEmail(email, pw); signInGoogle(); signOut() }`
  - `<LoginScreen />` (email/mot de passe + bouton Google)

- [ ] **Step 1: Créer `apps/web/src/firebaseConfig.ts`**

```ts
import { initFirebase } from "@retrorganizer/core";

export function bootstrapFirebase() {
  return initFirebase(
    {
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? "demo",
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? "demo",
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? "retrorganizer-dev",
      appId: import.meta.env.VITE_FIREBASE_APP_ID ?? "demo",
    },
    import.meta.env.VITE_USE_EMULATORS === "true",
  );
}
```

- [ ] **Step 2: Écrire le test — `apps/web/src/auth/AuthProvider.test.tsx`**

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { AuthProvider, useAuth } from "./AuthProvider";

vi.mock("@retrorganizer/core", () => ({
  getFirebase: () => ({ auth: {} }),
  initFirebase: () => ({ auth: {} }),
}));

let authCallback: (u: unknown) => void = () => {};
vi.mock("firebase/auth", () => ({
  onAuthStateChanged: (_auth: unknown, cb: (u: unknown) => void) => { authCallback = cb; return () => {}; },
  signInWithEmailAndPassword: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  signInWithPopup: vi.fn(),
  GoogleAuthProvider: class {},
  signOut: vi.fn(),
}));

function Probe() {
  const { user, loading } = useAuth();
  return <div>{loading ? "loading" : user ? `user:${user.uid}` : "anon"}</div>;
}

describe("AuthProvider", () => {
  beforeEach(() => { authCallback = () => {}; });

  it("exposes the authenticated user once auth state resolves", () => {
    render(<AuthProvider><Probe /></AuthProvider>);
    expect(screen.getByText("loading")).toBeInTheDocument();
    act(() => authCallback({ uid: "u1", email: "ada@x.io" }));
    expect(screen.getByText("user:u1")).toBeInTheDocument();
  });

  it("shows anon when no user", () => {
    render(<AuthProvider><Probe /></AuthProvider>);
    act(() => authCallback(null));
    expect(screen.getByText("anon")).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Lancer pour confirmer l'échec**

Run: `pnpm --filter @retrorganizer/web test -- AuthProvider`
Expected: FAIL — module `./AuthProvider` introuvable.

- [ ] **Step 4: Implémenter `apps/web/src/auth/AuthProvider.tsx`**

```tsx
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import {
  onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  signInWithPopup, GoogleAuthProvider, signOut as fbSignOut,
} from "firebase/auth";
import { getFirebase } from "@retrorganizer/core";

interface AuthUser { uid: string; email: string | null; }
interface AuthValue {
  user: AuthUser | null;
  loading: boolean;
  signInEmail(email: string, pw: string): Promise<void>;
  signUpEmail(email: string, pw: string): Promise<void>;
  signInGoogle(): Promise<void>;
  signOut(): Promise<void>;
}

const Ctx = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const { auth } = getFirebase();

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u ? { uid: u.uid, email: u.email } : null);
      setLoading(false);
    });
  }, [auth]);

  const value: AuthValue = {
    user,
    loading,
    signInEmail: async (e, p) => { await signInWithEmailAndPassword(auth, e, p); },
    signUpEmail: async (e, p) => { await createUserWithEmailAndPassword(auth, e, p); },
    signInGoogle: async () => { await signInWithPopup(auth, new GoogleAuthProvider()); },
    signOut: async () => { await fbSignOut(auth); },
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used within AuthProvider");
  return v;
}
```

- [ ] **Step 5: Implémenter `apps/web/src/auth/LoginScreen.tsx`**

```tsx
import { useState } from "react";
import { tokens } from "@retrorganizer/ui";
import { useAuth } from "./AuthProvider";

export function LoginScreen() {
  const { signInEmail, signUpEmail, signInGoogle } = useAuth();
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [mode, setMode] = useState<"in" | "up">("in");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await (mode === "in" ? signInEmail(email, pw) : signUpEmail(email, pw));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec de connexion");
    }
  }

  return (
    <div style={{ maxWidth: 360, margin: "10vh auto", font: `14px ${tokens.font.body}` }}>
      <h1 style={{ color: tokens.color.ink }}>Retrorganizer</h1>
      <form onSubmit={submit}>
        <input aria-label="Email" type="email" value={email}
          onChange={(e) => setEmail(e.target.value)} placeholder="email"
          style={{ display: "block", width: "100%", marginBottom: tokens.space.sm }} />
        <input aria-label="Mot de passe" type="password" value={pw}
          onChange={(e) => setPw(e.target.value)} placeholder="mot de passe"
          style={{ display: "block", width: "100%", marginBottom: tokens.space.sm }} />
        <button type="submit">{mode === "in" ? "Se connecter" : "Créer un compte"}</button>
      </form>
      <button onClick={() => signInGoogle()} style={{ marginTop: tokens.space.sm }}>
        Continuer avec Google
      </button>
      <button onClick={() => setMode(mode === "in" ? "up" : "in")}
        style={{ marginTop: tokens.space.sm, background: "none", border: "none", color: tokens.color.muted, cursor: "pointer" }}>
        {mode === "in" ? "Pas de compte ? S'inscrire" : "Déjà un compte ? Se connecter"}
      </button>
      {error && <p role="alert" style={{ color: "#a8431f" }}>{error}</p>}
    </div>
  );
}
```

- [ ] **Step 6: Lancer pour confirmer le succès**

Run: `pnpm --filter @retrorganizer/web test -- AuthProvider`
Expected: PASS — 2 tests verts.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(web): firebase auth (email + Google) with AuthProvider"
```

---

### Task 8: Coque applicative — App shell, onglets, routes protégées

**Files:**
- Create: `apps/web/src/App.tsx`, `apps/web/src/routes/SectionPlaceholder.tsx`
- Modify: `apps/web/src/main.tsx` (bootstrap Firebase + Router + AuthProvider)
- Test: `apps/web/src/App.test.tsx`

**Interfaces:**
- Consumes: `SECTIONS` (Task 6), `Tab` + `moduleAccent` (Task 5), `useAuth` (Task 7).
- Produces: `<App />` — barre de menus, toolbar, onglets verticaux, zone page ; redirige vers `LoginScreen` si non connecté.

- [ ] **Step 1: Écrire le test — `apps/web/src/App.test.tsx`**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { App } from "./App";

vi.mock("./auth/AuthProvider", () => ({
  useAuth: () => ({ user: { uid: "u1", email: "ada@x.io" }, loading: false, signOut: vi.fn() }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe("App", () => {
  it("renders the 8 section tabs for an authenticated user", () => {
    render(<MemoryRouter initialEntries={["/diary"]}><App /></MemoryRouter>);
    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(8);
    expect(screen.getByRole("tab", { name: "Address" })).toBeInTheDocument();
  });

  it("shows the Retrorganizer wordmark in the menu bar", () => {
    render(<MemoryRouter initialEntries={["/diary"]}><App /></MemoryRouter>);
    expect(screen.getByText("Retrorganizer")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Lancer pour confirmer l'échec**

Run: `pnpm --filter @retrorganizer/web test -- App.test`
Expected: FAIL — module `./App` introuvable.

- [ ] **Step 3: Implémenter `apps/web/src/routes/SectionPlaceholder.tsx`**

```tsx
import { tokens } from "@retrorganizer/ui";

export function SectionPlaceholder({ label }: { label: string }) {
  return (
    <div style={{ padding: tokens.space.xl }}>
      <h2 style={{ color: tokens.color.ink }}>{label}</h2>
      <p style={{ color: tokens.color.muted }}>Module en cours de construction (Phase suivante).</p>
    </div>
  );
}
```

- [ ] **Step 4: Implémenter `apps/web/src/App.tsx`**

```tsx
import { Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import { Tab, tokens, moduleAccent } from "@retrorganizer/ui";
import { SECTIONS } from "./routes/sections";
import { ComingSoon } from "./routes/ComingSoon";
import { SectionPlaceholder } from "./routes/SectionPlaceholder";
import { useAuth } from "./auth/AuthProvider";
import { LoginScreen } from "./auth/LoginScreen";

export function App() {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  if (loading) return <div style={{ padding: tokens.space.xl }}>Chargement…</div>;
  if (!user) return <LoginScreen />;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: tokens.color.paper }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: `${tokens.space.xs}px ${tokens.space.md}px`, borderBottom: `1px solid ${tokens.color.line}`,
        font: `13px ${tokens.font.body}` }}>
        <strong style={{ color: tokens.color.ink }}>Retrorganizer</strong>
        <button onClick={() => signOut()}>Déconnexion</button>
      </header>

      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        <nav role="tablist" aria-orientation="vertical"
          style={{ width: 160, borderRight: `1px solid ${tokens.color.line}`, background: tokens.color.paper }}>
          {SECTIONS.map((s) => (
            <Tab key={s.id} label={s.label} accentColor={moduleAccent[s.id]}
              active={location.pathname.startsWith(s.path)} onClick={() => navigate(s.path)} />
          ))}
        </nav>

        <main style={{ flex: 1, overflow: "auto", background: tokens.color.surface,
          margin: tokens.space.md, border: `1px solid ${tokens.color.line}`, borderRadius: tokens.radius.md }}>
          <Routes>
            <Route path="/" element={<Navigate to="/diary" replace />} />
            {SECTIONS.map((s) => (
              <Route key={s.id} path={s.path}
                element={s.mvp ? <SectionPlaceholder label={s.label} /> : <ComingSoon label={s.label} />} />
            ))}
            <Route path="*" element={<Navigate to="/diary" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Implémenter `apps/web/src/main.tsx`**

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { bootstrapFirebase } from "./firebaseConfig";
import { AuthProvider } from "./auth/AuthProvider";
import { App } from "./App";

bootstrapFirebase();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
```

- [ ] **Step 6: Lancer pour confirmer le succès**

Run: `pnpm --filter @retrorganizer/web test`
Expected: PASS — tests App + sections verts.

- [ ] **Step 7: Vérifier le build complet du monorepo**

Run: `pnpm build`
Expected: build web réussi (tsc + vite), `apps/web/dist` créé.

- [ ] **Step 8: Vérification manuelle (émulateurs)**

Run (terminal 1) : `pnpm exec firebase emulators:start --only auth,firestore`
Run (terminal 2) : `pnpm --filter @retrorganizer/web dev`
Attendu : ouvrir l'URL Vite → écran login → créer un compte sur l'émulateur Auth → voir la coque avec 8 onglets, navigation entre Diary/ToDo/Address/Notepad (placeholders) et Planner/Anniversary/Web/Calls (« Bientôt disponible »).

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat(web): app shell with 8 tabs, protected routes, retro layout"
```

---

### Task 9: CI GitHub Actions

**Files:**
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: scripts `pnpm lint|typecheck|test|build` (Tasks 1-8).
- Produces: pipeline CI vert sur push/PR.

- [ ] **Step 1: Créer `.github/workflows/ci.yml`**

```yaml
name: CI
on:
  push: { branches: [main] }
  pull_request: {}

jobs:
  build-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm typecheck
      - name: Run tests (with Firestore emulator)
        run: pnpm exec firebase emulators:exec --only auth,firestore "pnpm test"
```

> Note exécutant : `firebase emulators:exec` démarre les émulateurs, lance la
> commande, puis les arrête — c'est ce qui rend les tests rules/repo verts en CI.
> Ajouter `firebase-tools` en devDep racine si absent : `pnpm add -Dw firebase-tools`.

- [ ] **Step 2: Vérifier la syntaxe du workflow localement (best effort)**

Run: `pnpm exec firebase emulators:exec --only auth,firestore "pnpm test"`
Expected: tous les tests des packages passent sous émulateurs.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "ci: add GitHub Actions pipeline (lint, typecheck, test on emulators)"
```

---

## Définition de « terminé » pour la Phase 0

- `pnpm install && pnpm build` réussit à froid.
- `pnpm exec firebase emulators:exec --only auth,firestore "pnpm test"` : tous les tests verts (domaine, rules, repo, ui, web).
- L'app web tournée en local : login email + Google (émulateur), coque rétro à 8 onglets, navigation OK, 4 sections « Bientôt disponible ».
- CI verte sur la PR.

À l'issue de la Phase 0, je rédige le plan de la **Phase 1 — Contacts** (CRUD complet, champs multi-valeurs, import/export vCard + CSV) sur ce socle.
