# Retrorganizer — Phase 1 : Contacts — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Livrer le module Contacts complet sur le socle Phase 0 : CRUD avec champs multi-valeurs, recherche/tri dans le module, et import/export vCard (3.0) + CSV (pleine fidélité), branché sur l'onglet Address.

**Architecture:** La logique pure (modèle d'édition `ContactDraft`, recherche/tri, sérialisation vCard/CSV) vit dans `packages/core` (testée en node, réutilisable React Native). `apps/web/src/contacts/` consomme `contactsRepo` (Phase 0) via un hook `useContacts` et rend la liste, le formulaire multi-valeurs et la barre import/export. L'onglet Address pointe vers `ContactsModule` au lieu du placeholder.

**Tech Stack:** TypeScript strict, zod (déjà là), Firestore via `contactsRepo`, React + Vitest + @testing-library/react. Aucune nouvelle dépendance runtime — les parsers vCard/CSV sont écrits à la main et testés.

## Global Constraints

- Produit : **Retrorganizer**. TypeScript **strict** partout.
- Aucune app ne parle directement à Firestore — uniquement via `@retrorganizer/core` (`contactsRepo`, `getFirebase`).
- Toutes les écritures passent par `contactsRepo` (Phase 0) : `create(ownerId, data)`, `get(id)`, `update(id, patch)`, `softDelete(id)`, `listByOwner(ownerId)`.
- Soft-delete uniquement (jamais de suppression dure) ; `listByOwner` exclut déjà les `deletedAt`.
- Champs multi-valeurs obligatoires : téléphones, emails, adresses, liens web, dates importantes, champs personnalisés (cf. spec §7.3 / §5.2).
- **vCard** : export en 3.0 ; import tolérant 3.0 **et** 4.0 pour les champs standard. **CSV** : format pleine fidélité (cellules multi-valeurs encodées en JSON) — zéro perte de données.
- Tests sur récurrences/import-export obligatoires (spec §12.4) : chaque parser a des tests de round-trip.
- Pas de nouvelle dépendance npm runtime.
- Commits fréquents, un par tâche minimum.

## Interfaces héritées de la Phase 0 (à consommer, ne pas redéfinir)

Depuis `@retrorganizer/core` :
- `Contact` = `BaseEntity & { firstName, lastName, displayName, organization?, title?, phones: LabeledValue[], emails: LabeledValue[], addresses: PostalAddress[], webLinks: LabeledValue[], importantDates: LabeledDate[], notes?, customFields: KeyValue[], categoryId: string|null, tags: string[] }`
- `BaseEntity` = `{ id, ownerId, createdAt, updatedAt, deletedAt: number|null }`
- `LabeledValue` = `{ label: string; value: string }`
- `PostalAddress` = `{ label, street, city, postalCode, country }` (tous string)
- `LabeledDate` = `{ label: string; date: string }` (date ISO `yyyy-mm-dd`)
- `KeyValue` = `{ key: string; value: string }`
- `parseContact(input: unknown): Contact`
- `contactsRepo`: `Repository<Contact>` (méthodes ci-dessus)

Depuis `@retrorganizer/ui` : `tokens`, `moduleAccent`, `Tab`, `SectionId`.
Depuis `apps/web` : `useAuth()` (→ `{ user: { uid, email } | null }`), `SECTIONS`, `App` (routes).

---

### Task 1: `ContactDraft` — modèle d'édition + helpers (core)

**Files:**
- Create: `packages/core/src/domain/contactDraft.ts`
- Modify: `packages/core/src/index.ts` (exporter contactDraft)
- Test: `packages/core/src/domain/contactDraft.test.ts`

**Interfaces:**
- Consumes: `Contact`, `LabeledValue`, `PostalAddress`, `LabeledDate`, `KeyValue` (Phase 0).
- Produces:
  - `ContactDraft` = tous les champs de contenu de `Contact` mais avec `organization/title/notes` en `string` (jamais undefined) : `{ firstName, lastName, displayName, organization, title, phones, emails, addresses, webLinks, importantDates, notes, customFields, categoryId: string|null, tags }`
  - `emptyDraft(): ContactDraft` — tous champs vides, tableaux `[]`, `categoryId: null`
  - `draftFromContact(c: Contact): ContactDraft` — projette un Contact en draft (optionnels → `""`)
  - `withDisplayName(d: ContactDraft): ContactDraft` — renvoie une copie où `displayName` est rempli avec `"${firstName} ${lastName}".trim()` s'il est vide
  - `ContactDraft` est assignable à `Partial<Contact>` (donc `contactsRepo.create(uid, draft)` compile).

- [ ] **Step 1: Write the failing test — `packages/core/src/domain/contactDraft.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { emptyDraft, draftFromContact, withDisplayName } from "./contactDraft";
import type { Contact } from "./contact";

const sample: Contact = {
  id: "c1", ownerId: "u1", createdAt: 1, updatedAt: 1, deletedAt: null,
  firstName: "Ada", lastName: "Lovelace", displayName: "Ada Lovelace",
  phones: [{ label: "mobile", value: "+33 1" }], emails: [], addresses: [],
  webLinks: [], importantDates: [], customFields: [], categoryId: null, tags: [],
};

describe("contactDraft", () => {
  it("emptyDraft has empty strings and arrays", () => {
    const d = emptyDraft();
    expect(d.displayName).toBe("");
    expect(d.organization).toBe("");
    expect(d.phones).toEqual([]);
    expect(d.categoryId).toBeNull();
  });

  it("draftFromContact projects optionals to empty strings", () => {
    const d = draftFromContact(sample);
    expect(d.organization).toBe("");
    expect(d.notes).toBe("");
    expect(d.phones).toEqual([{ label: "mobile", value: "+33 1" }]);
  });

  it("withDisplayName fills from first+last when empty", () => {
    const d = withDisplayName({ ...emptyDraft(), firstName: "Ada", lastName: "Lovelace" });
    expect(d.displayName).toBe("Ada Lovelace");
  });

  it("withDisplayName keeps an existing displayName", () => {
    const d = withDisplayName({ ...emptyDraft(), firstName: "X", displayName: "Keep Me" });
    expect(d.displayName).toBe("Keep Me");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @retrorganizer/core test -- contactDraft`
Expected: FAIL — module `./contactDraft` not found.

- [ ] **Step 3: Implement `packages/core/src/domain/contactDraft.ts`**

```ts
import type { Contact } from "./contact";
import type { LabeledValue, PostalAddress, LabeledDate, KeyValue } from "./types";

export interface ContactDraft {
  firstName: string;
  lastName: string;
  displayName: string;
  organization: string;
  title: string;
  phones: LabeledValue[];
  emails: LabeledValue[];
  addresses: PostalAddress[];
  webLinks: LabeledValue[];
  importantDates: LabeledDate[];
  notes: string;
  customFields: KeyValue[];
  categoryId: string | null;
  tags: string[];
}

export function emptyDraft(): ContactDraft {
  return {
    firstName: "", lastName: "", displayName: "", organization: "", title: "",
    phones: [], emails: [], addresses: [], webLinks: [], importantDates: [],
    notes: "", customFields: [], categoryId: null, tags: [],
  };
}

export function draftFromContact(c: Contact): ContactDraft {
  return {
    firstName: c.firstName,
    lastName: c.lastName,
    displayName: c.displayName,
    organization: c.organization ?? "",
    title: c.title ?? "",
    phones: c.phones.map((p) => ({ ...p })),
    emails: c.emails.map((p) => ({ ...p })),
    addresses: c.addresses.map((a) => ({ ...a })),
    webLinks: c.webLinks.map((w) => ({ ...w })),
    importantDates: c.importantDates.map((d) => ({ ...d })),
    notes: c.notes ?? "",
    customFields: c.customFields.map((f) => ({ ...f })),
    categoryId: c.categoryId,
    tags: [...c.tags],
  };
}

export function withDisplayName(d: ContactDraft): ContactDraft {
  if (d.displayName.trim() !== "") return d;
  return { ...d, displayName: `${d.firstName} ${d.lastName}`.trim() };
}
```

- [ ] **Step 4: Export from `packages/core/src/index.ts`** — add this line after the existing domain exports:

```ts
export * from "./domain/contactDraft";
```

- [ ] **Step 5: Run to verify it passes**

Run: `pnpm --filter @retrorganizer/core test -- contactDraft`
Expected: PASS — 4 tests. Then `pnpm --filter @retrorganizer/core typecheck` → clean.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/domain/contactDraft.ts packages/core/src/domain/contactDraft.test.ts packages/core/src/index.ts
git commit -m "feat(core): ContactDraft edit model + helpers"
```

---

### Task 2: vCard escaping primitives (core)

**Files:**
- Create: `packages/core/src/io/vcardEscape.ts`
- Test: `packages/core/src/io/vcardEscape.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `escapeValue(v: string): string` — escape `\`, `\n`, `,`, `;` per RFC 6350/2426
  - `unescapeValue(v: string): string` — single-pass inverse
  - `splitEscaped(v: string, sep: string): string[]` — split on UNescaped `sep`, keeping escapes intact in each part
  - `unfoldLines(text: string): string[]` — RFC line-unfolding: join continuation lines (next line starts with space/tab) onto the previous one; returns the logical lines

- [ ] **Step 1: Write the failing test — `packages/core/src/io/vcardEscape.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { escapeValue, unescapeValue, splitEscaped, unfoldLines } from "./vcardEscape";

describe("vcardEscape", () => {
  it("escapes and unescapes round-trip", () => {
    const raw = "a,b; c\\d\nnext";
    const esc = escapeValue(raw);
    expect(esc).toBe("a\\,b\\; c\\\\d\\nnext");
    expect(unescapeValue(esc)).toBe(raw);
  });

  it("splitEscaped ignores escaped separators", () => {
    expect(splitEscaped("a\\;b;c", ";")).toEqual(["a\\;b", "c"]);
    expect(splitEscaped(";;", ";")).toEqual(["", "", ""]);
  });

  it("unfoldLines joins continuation lines", () => {
    const text = "FN:Ada\r\nNOTE:line one\r\n  line two\r\nEND:VCARD";
    expect(unfoldLines(text)).toEqual(["FN:Ada", "NOTE:line one line two", "END:VCARD"]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @retrorganizer/core test -- vcardEscape`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `packages/core/src/io/vcardEscape.ts`**

```ts
export function escapeValue(v: string): string {
  let out = "";
  for (const ch of v) {
    if (ch === "\\") out += "\\\\";
    else if (ch === "\n") out += "\\n";
    else if (ch === ",") out += "\\,";
    else if (ch === ";") out += "\\;";
    else out += ch;
  }
  return out;
}

export function unescapeValue(v: string): string {
  let out = "";
  for (let i = 0; i < v.length; i++) {
    if (v[i] === "\\" && i + 1 < v.length) {
      const n = v[i + 1];
      if (n === "n" || n === "N") out += "\n";
      else out += n; // \\ \, \; -> \ , ;
      i++;
    } else {
      out += v[i];
    }
  }
  return out;
}

export function splitEscaped(v: string, sep: string): string[] {
  const parts: string[] = [];
  let cur = "";
  for (let i = 0; i < v.length; i++) {
    if (v[i] === "\\" && i + 1 < v.length) {
      cur += v[i] + v[i + 1];
      i++;
    } else if (v[i] === sep) {
      parts.push(cur);
      cur = "";
    } else {
      cur += v[i];
    }
  }
  parts.push(cur);
  return parts;
}

export function unfoldLines(text: string): string[] {
  const physical = text.replace(/\r\n/g, "\n").split("\n");
  const logical: string[] = [];
  for (const line of physical) {
    if ((line.startsWith(" ") || line.startsWith("\t")) && logical.length > 0) {
      logical[logical.length - 1] += line.slice(1);
    } else {
      logical.push(line);
    }
  }
  return logical;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter @retrorganizer/core test -- vcardEscape`
Expected: PASS — 3 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/io/vcardEscape.ts packages/core/src/io/vcardEscape.test.ts
git commit -m "feat(core): vCard escaping + line-unfolding primitives"
```

---

### Task 3: vCard export (core)

**Files:**
- Create: `packages/core/src/io/vcard.ts`
- Modify: `packages/core/src/index.ts` (export io/vcard)
- Test: `packages/core/src/io/vcardExport.test.ts`

**Interfaces:**
- Consumes: `Contact` (Phase 0), `escapeValue` (Task 2).
- Produces:
  - `contactToVCard(c: Contact): string` — one VCARD block, version 3.0, CRLF line endings, fields: `N`, `FN`, `ORG`, `TITLE`, `TEL;TYPE=<label>`, `EMAIL;TYPE=<label>`, `ADR;TYPE=<label>`, `URL`, `BDAY` (first importantDate whose label matches /naiss|birth/i), `NOTE`, `CATEGORIES` (tags). Empty/absent fields are omitted.
  - `contactsToVCard(cs: Contact[]): string` — concatenated blocks separated by CRLF.
  - Helper (not exported): label sanitized for a TYPE param by replacing `;,:` with `_`.

- [ ] **Step 1: Write the failing test — `packages/core/src/io/vcardExport.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { contactToVCard } from "./vcard";
import type { Contact } from "../domain/contact";

const c: Contact = {
  id: "c1", ownerId: "u1", createdAt: 1, updatedAt: 1, deletedAt: null,
  firstName: "Ada", lastName: "Lovelace", displayName: "Ada Lovelace",
  organization: "Analytical Engines", title: "Mathematician",
  phones: [{ label: "mobile", value: "+33 1 23" }],
  emails: [{ label: "work", value: "ada@x.io" }],
  addresses: [{ label: "home", street: "1 Rue A", city: "Paris", postalCode: "75001", country: "France" }],
  webLinks: [{ label: "site", value: "https://ada.example" }],
  importantDates: [{ label: "naissance", date: "1815-12-10" }],
  notes: "Note; with, specials", customFields: [], categoryId: null, tags: ["vip", "math"],
};

describe("contactToVCard", () => {
  it("emits a 3.0 vCard with standard fields", () => {
    const v = contactToVCard(c);
    expect(v).toContain("BEGIN:VCARD");
    expect(v).toContain("VERSION:3.0");
    expect(v).toContain("N:Lovelace;Ada;;;");
    expect(v).toContain("FN:Ada Lovelace");
    expect(v).toContain("ORG:Analytical Engines");
    expect(v).toContain("TITLE:Mathematician");
    expect(v).toContain("TEL;TYPE=mobile:+33 1 23");
    expect(v).toContain("EMAIL;TYPE=work:ada@x.io");
    expect(v).toContain("ADR;TYPE=home:;;1 Rue A;Paris;;75001;France");
    expect(v).toContain("URL:https://ada.example");
    expect(v).toContain("BDAY:1815-12-10");
    expect(v).toContain("CATEGORIES:vip,math");
    expect(v).toContain("NOTE:Note\\; with\\, specials");
    expect(v.trim().endsWith("END:VCARD")).toBe(true);
  });

  it("omits empty fields", () => {
    const v = contactToVCard({ ...c, organization: undefined, title: undefined, tags: [], notes: undefined, importantDates: [] });
    expect(v).not.toContain("ORG:");
    expect(v).not.toContain("TITLE:");
    expect(v).not.toContain("CATEGORIES:");
    expect(v).not.toContain("BDAY:");
    expect(v).not.toContain("NOTE:");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @retrorganizer/core test -- vcardExport`
Expected: FAIL — module `./vcard` not found.

- [ ] **Step 3: Implement `packages/core/src/io/vcard.ts`** (export side; import side added in Task 4)

```ts
import type { Contact } from "../domain/contact";
import { escapeValue } from "./vcardEscape";

const CRLF = "\r\n";

function param(label: string): string {
  return label.replace(/[;,:]/g, "_");
}

export function contactToVCard(c: Contact): string {
  const lines: string[] = ["BEGIN:VCARD", "VERSION:3.0"];
  lines.push(`N:${escapeValue(c.lastName)};${escapeValue(c.firstName)};;;`);
  lines.push(`FN:${escapeValue(c.displayName)}`);
  if (c.organization) lines.push(`ORG:${escapeValue(c.organization)}`);
  if (c.title) lines.push(`TITLE:${escapeValue(c.title)}`);
  for (const p of c.phones) lines.push(`TEL;TYPE=${param(p.label)}:${escapeValue(p.value)}`);
  for (const e of c.emails) lines.push(`EMAIL;TYPE=${param(e.label)}:${escapeValue(e.value)}`);
  for (const a of c.addresses) {
    const adr = [a.street, a.city, "", a.postalCode, a.country].map(escapeValue).join(";");
    lines.push(`ADR;TYPE=${param(a.label)}:;;${adr}`);
  }
  for (const w of c.webLinks) lines.push(`URL:${escapeValue(w.value)}`);
  const bday = c.importantDates.find((d) => /naiss|birth/i.test(d.label));
  if (bday) lines.push(`BDAY:${bday.date}`);
  if (c.tags.length > 0) lines.push(`CATEGORIES:${c.tags.map(escapeValue).join(",")}`);
  if (c.notes) lines.push(`NOTE:${escapeValue(c.notes)}`);
  lines.push("END:VCARD");
  return lines.join(CRLF) + CRLF;
}

export function contactsToVCard(cs: Contact[]): string {
  return cs.map(contactToVCard).join("");
}
```

- [ ] **Step 4: Export from `packages/core/src/index.ts`** — add:

```ts
export * from "./io/vcard";
```

- [ ] **Step 5: Run to verify it passes**

Run: `pnpm --filter @retrorganizer/core test -- vcardExport`
Expected: PASS — 2 tests.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/io/vcard.ts packages/core/src/io/vcardExport.test.ts packages/core/src/index.ts
git commit -m "feat(core): vCard 3.0 export"
```

---

### Task 4: vCard import (core)

**Files:**
- Modify: `packages/core/src/io/vcard.ts` (add import side)
- Test: `packages/core/src/io/vcardImport.test.ts`

**Interfaces:**
- Consumes: `ContactDraft`, `emptyDraft`, `withDisplayName` (Task 1); `unescapeValue`, `splitEscaped`, `unfoldLines` (Task 2); `contactToVCard` (Task 3, for round-trip test).
- Produces:
  - `vCardToDrafts(text: string): ContactDraft[]` — parses one or many VCARD blocks (3.0 and 4.0 tolerant). Maps `N`/`FN`→names, `ORG`/`TITLE`, `TEL`/`EMAIL`/`ADR` (label from `TYPE` param, default `"other"`), `URL`→webLinks (label `"site"`), `BDAY`→importantDates (label `"naissance"`), `CATEGORIES`→tags, `NOTE`→notes. Unknown lines ignored. `displayName` defaults via `withDisplayName`.
  - Internal `parseLine(line)` → `{ name, params: Record<string,string>, value }`.

- [ ] **Step 1: Write the failing test — `packages/core/src/io/vcardImport.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { vCardToDrafts, contactToVCard } from "./vcard";
import type { Contact } from "../domain/contact";

describe("vCardToDrafts", () => {
  it("parses a single 3.0 vCard", () => {
    const text = [
      "BEGIN:VCARD", "VERSION:3.0",
      "N:Lovelace;Ada;;;", "FN:Ada Lovelace",
      "ORG:Analytical Engines", "TITLE:Mathematician",
      "TEL;TYPE=mobile:+33 1 23", "EMAIL;TYPE=work:ada@x.io",
      "ADR;TYPE=home:;;1 Rue A;Paris;;75001;France",
      "URL:https://ada.example", "BDAY:1815-12-10",
      "CATEGORIES:vip,math", "NOTE:Note\\; with\\, specials", "END:VCARD",
    ].join("\r\n");
    const [d] = vCardToDrafts(text);
    expect(d.firstName).toBe("Ada");
    expect(d.lastName).toBe("Lovelace");
    expect(d.displayName).toBe("Ada Lovelace");
    expect(d.organization).toBe("Analytical Engines");
    expect(d.phones).toEqual([{ label: "mobile", value: "+33 1 23" }]);
    expect(d.emails).toEqual([{ label: "work", value: "ada@x.io" }]);
    expect(d.addresses).toEqual([{ label: "home", street: "1 Rue A", city: "Paris", postalCode: "75001", country: "France" }]);
    expect(d.webLinks).toEqual([{ label: "site", value: "https://ada.example" }]);
    expect(d.importantDates).toEqual([{ label: "naissance", date: "1815-12-10" }]);
    expect(d.tags).toEqual(["vip", "math"]);
    expect(d.notes).toBe("Note; with, specials");
  });

  it("parses multiple cards", () => {
    const text = "BEGIN:VCARD\r\nVERSION:3.0\r\nFN:A\r\nEND:VCARD\r\nBEGIN:VCARD\r\nVERSION:4.0\r\nFN:B\r\nEND:VCARD\r\n";
    const drafts = vCardToDrafts(text);
    expect(drafts.map((d) => d.displayName)).toEqual(["A", "B"]);
  });

  it("round-trips export -> import for standard fields", () => {
    const c: Contact = {
      id: "c1", ownerId: "u1", createdAt: 1, updatedAt: 1, deletedAt: null,
      firstName: "Grace", lastName: "Hopper", displayName: "Grace Hopper",
      organization: "Navy", title: "Admiral",
      phones: [{ label: "work", value: "+1 555" }], emails: [{ label: "home", value: "g@x.io" }],
      addresses: [], webLinks: [], importantDates: [], notes: "", customFields: [],
      categoryId: null, tags: ["pioneer"],
    };
    const [d] = vCardToDrafts(contactToVCard(c));
    expect(d.firstName).toBe("Grace");
    expect(d.phones).toEqual([{ label: "work", value: "+1 555" }]);
    expect(d.tags).toEqual(["pioneer"]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @retrorganizer/core test -- vcardImport`
Expected: FAIL — `vCardToDrafts` not exported.

- [ ] **Step 3: Append the import side to `packages/core/src/io/vcard.ts`**

```ts
import type { ContactDraft } from "../domain/contactDraft";
import { emptyDraft, withDisplayName } from "../domain/contactDraft";
import { unescapeValue, splitEscaped, unfoldLines } from "./vcardEscape";

interface ParsedLine { name: string; params: Record<string, string>; value: string; }

function parseLine(line: string): ParsedLine | null {
  const colon = line.indexOf(":");
  if (colon === -1) return null;
  const head = line.slice(0, colon);
  const value = line.slice(colon + 1);
  const segments = head.split(";");
  const nameWithGroup = segments[0] ?? "";
  const name = (nameWithGroup.includes(".") ? nameWithGroup.split(".").pop()! : nameWithGroup).toUpperCase();
  const params: Record<string, string> = {};
  for (let i = 1; i < segments.length; i++) {
    const seg = segments[i] ?? "";
    const eq = seg.indexOf("=");
    if (eq === -1) params["TYPE"] = seg; // bare param value, e.g. vCard 3 "TEL;CELL:"
    else params[seg.slice(0, eq).toUpperCase()] = seg.slice(eq + 1).replace(/^"|"$/g, "");
  }
  return { name, params, value };
}

export function vCardToDrafts(text: string): ContactDraft[] {
  const drafts: ContactDraft[] = [];
  let cur: ContactDraft | null = null;
  for (const raw of unfoldLines(text)) {
    const line = raw.trim();
    if (line === "") continue;
    if (line.toUpperCase() === "BEGIN:VCARD") { cur = emptyDraft(); continue; }
    if (line.toUpperCase() === "END:VCARD") { if (cur) drafts.push(withDisplayName(cur)); cur = null; continue; }
    if (!cur) continue;
    const p = parseLine(line);
    if (!p) continue;
    const label = (p.params["TYPE"] ?? "other").toLowerCase();
    switch (p.name) {
      case "VERSION": break;
      case "N": {
        const parts = splitEscaped(p.value, ";").map(unescapeValue);
        cur.lastName = parts[0] ?? "";
        cur.firstName = parts[1] ?? "";
        break;
      }
      case "FN": cur.displayName = unescapeValue(p.value); break;
      case "ORG": cur.organization = unescapeValue(splitEscaped(p.value, ";")[0] ?? ""); break;
      case "TITLE": cur.title = unescapeValue(p.value); break;
      case "TEL": cur.phones.push({ label, value: unescapeValue(p.value) }); break;
      case "EMAIL": cur.emails.push({ label, value: unescapeValue(p.value) }); break;
      case "ADR": {
        const a = splitEscaped(p.value, ";").map(unescapeValue);
        cur.addresses.push({ label, street: a[2] ?? "", city: a[3] ?? "", postalCode: a[5] ?? "", country: a[6] ?? "" });
        break;
      }
      case "URL": cur.webLinks.push({ label: "site", value: unescapeValue(p.value) }); break;
      case "BDAY": cur.importantDates.push({ label: "naissance", date: p.value.trim() }); break;
      case "CATEGORIES": cur.tags.push(...splitEscaped(p.value, ",").map(unescapeValue).filter((t) => t !== "")); break;
      case "NOTE": cur.notes = unescapeValue(p.value); break;
      default: break;
    }
  }
  return drafts;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter @retrorganizer/core test -- vcardImport`
Expected: PASS — 3 tests. Then `pnpm --filter @retrorganizer/core typecheck` → clean.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/io/vcard.ts packages/core/src/io/vcardImport.test.ts
git commit -m "feat(core): vCard import (3.0/4.0 tolerant) with round-trip test"
```

---

### Task 5: CSV export/import (core, full fidelity)

**Files:**
- Create: `packages/core/src/io/csv.ts`
- Modify: `packages/core/src/index.ts` (export io/csv)
- Test: `packages/core/src/io/csv.test.ts`

**Interfaces:**
- Consumes: `Contact` (Phase 0), `ContactDraft`, `emptyDraft`, `withDisplayName` (Task 1).
- Produces:
  - `contactsToCsv(cs: Contact[]): string` — RFC-4180 CSV. Header: `displayName,firstName,lastName,organization,title,notes,categoryId,tags,phones,emails,addresses,webLinks,importantDates,customFields`. Multi-value columns (`tags,phones,emails,addresses,webLinks,importantDates,customFields`) hold a JSON string of the array. CRLF row endings.
  - `csvToDrafts(text: string): ContactDraft[]` — parses RFC-4180 rows back into drafts; JSON-decodes the multi-value columns; `displayName` filled via `withDisplayName`. Tolerates missing optional columns.

- [ ] **Step 1: Write the failing test — `packages/core/src/io/csv.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { contactsToCsv, csvToDrafts } from "./csv";
import type { Contact } from "../domain/contact";

const c: Contact = {
  id: "c1", ownerId: "u1", createdAt: 1, updatedAt: 1, deletedAt: null,
  firstName: "Ada", lastName: "Lovelace", displayName: "Ada Lovelace",
  organization: "Eng, Inc", title: "Math",
  phones: [{ label: "mobile", value: "+33 1" }], emails: [],
  addresses: [{ label: "home", street: "1 Rue A", city: "Paris", postalCode: "75001", country: "FR" }],
  webLinks: [{ label: "site", value: "https://a.io" }],
  importantDates: [{ label: "naissance", date: "1815-12-10" }],
  notes: "Multi\nline", customFields: [{ key: "Surnom", value: "Countess" }],
  categoryId: "cat1", tags: ["vip", "math"],
};

describe("csv round-trip", () => {
  it("exports a header + row and re-imports identically (full fidelity)", () => {
    const csv = contactsToCsv([c]);
    expect(csv.split("\r\n")[0]).toBe(
      "displayName,firstName,lastName,organization,title,notes,categoryId,tags,phones,emails,addresses,webLinks,importantDates,customFields",
    );
    const [d] = csvToDrafts(csv);
    expect(d.displayName).toBe("Ada Lovelace");
    expect(d.organization).toBe("Eng, Inc"); // comma inside quoted cell
    expect(d.notes).toBe("Multi\nline");       // newline inside quoted cell
    expect(d.phones).toEqual([{ label: "mobile", value: "+33 1" }]);
    expect(d.addresses).toEqual([{ label: "home", street: "1 Rue A", city: "Paris", postalCode: "75001", country: "FR" }]);
    expect(d.customFields).toEqual([{ key: "Surnom", value: "Countess" }]);
    expect(d.tags).toEqual(["vip", "math"]);
    expect(d.categoryId).toBe("cat1");
  });

  it("handles empty input (header only -> no rows)", () => {
    expect(csvToDrafts(contactsToCsv([]))).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @retrorganizer/core test -- csv`
Expected: FAIL — module `./csv` not found.

- [ ] **Step 3: Implement `packages/core/src/io/csv.ts`**

```ts
import type { Contact } from "../domain/contact";
import type { ContactDraft } from "../domain/contactDraft";
import { emptyDraft, withDisplayName } from "../domain/contactDraft";

const CRLF = "\r\n";
const HEADER = [
  "displayName", "firstName", "lastName", "organization", "title", "notes",
  "categoryId", "tags", "phones", "emails", "addresses", "webLinks",
  "importantDates", "customFields",
] as const;
const JSON_COLS = new Set(["tags", "phones", "emails", "addresses", "webLinks", "importantDates", "customFields"]);

function quote(cell: string): string {
  if (/[",\r\n]/.test(cell)) return `"${cell.replace(/"/g, '""')}"`;
  return cell;
}

export function contactsToCsv(cs: Contact[]): string {
  const rows = [HEADER.join(",")];
  for (const c of cs) {
    const cells: Record<string, string> = {
      displayName: c.displayName,
      firstName: c.firstName,
      lastName: c.lastName,
      organization: c.organization ?? "",
      title: c.title ?? "",
      notes: c.notes ?? "",
      categoryId: c.categoryId ?? "",
      tags: JSON.stringify(c.tags),
      phones: JSON.stringify(c.phones),
      emails: JSON.stringify(c.emails),
      addresses: JSON.stringify(c.addresses),
      webLinks: JSON.stringify(c.webLinks),
      importantDates: JSON.stringify(c.importantDates),
      customFields: JSON.stringify(c.customFields),
    };
    rows.push(HEADER.map((h) => quote(cells[h] ?? "")).join(","));
  }
  return rows.join(CRLF) + CRLF;
}

// RFC-4180 parser: returns array of rows, each an array of cell strings.
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  const s = text;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inQuotes) {
      if (ch === '"') {
        if (s[i + 1] === '"') { cell += '"'; i++; }
        else inQuotes = false;
      } else cell += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(cell); cell = "";
    } else if (ch === "\r") {
      // ignore; handled with \n
    } else if (ch === "\n") {
      row.push(cell); cell = "";
      rows.push(row); row = [];
    } else {
      cell += ch;
    }
  }
  if (cell !== "" || row.length > 0) { row.push(cell); rows.push(row); }
  return rows;
}

function parseJsonArray<T>(cell: string): T[] {
  if (cell.trim() === "") return [];
  try {
    const parsed = JSON.parse(cell);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

export function csvToDrafts(text: string): ContactDraft[] {
  const rows = parseCsv(text);
  if (rows.length === 0) return [];
  const header = rows[0]!;
  const idx = (name: string) => header.indexOf(name);
  const drafts: ContactDraft[] = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r]!;
    if (row.every((c) => c === "")) continue;
    const get = (name: string) => (idx(name) >= 0 ? (row[idx(name)] ?? "") : "");
    const d = emptyDraft();
    d.displayName = get("displayName");
    d.firstName = get("firstName");
    d.lastName = get("lastName");
    d.organization = get("organization");
    d.title = get("title");
    d.notes = get("notes");
    const cat = get("categoryId");
    d.categoryId = cat === "" ? null : cat;
    d.tags = parseJsonArray<string>(get("tags"));
    d.phones = parseJsonArray(get("phones"));
    d.emails = parseJsonArray(get("emails"));
    d.addresses = parseJsonArray(get("addresses"));
    d.webLinks = parseJsonArray(get("webLinks"));
    d.importantDates = parseJsonArray(get("importantDates"));
    d.customFields = parseJsonArray(get("customFields"));
    drafts.push(withDisplayName(d));
  }
  return drafts;
}
```

- [ ] **Step 4: Export from `packages/core/src/index.ts`** — add:

```ts
export * from "./io/csv";
```

- [ ] **Step 5: Run to verify it passes**

Run: `pnpm --filter @retrorganizer/core test -- csv`
Expected: PASS — 2 tests. Then `pnpm --filter @retrorganizer/core typecheck` → clean.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/io/csv.ts packages/core/src/io/csv.test.ts packages/core/src/index.ts
git commit -m "feat(core): full-fidelity CSV export/import (JSON multi-value cells)"
```

---

### Task 6: Contact search & sort helpers (core)

**Files:**
- Create: `packages/core/src/domain/contactQuery.ts`
- Modify: `packages/core/src/index.ts` (export contactQuery)
- Test: `packages/core/src/domain/contactQuery.test.ts`

**Interfaces:**
- Consumes: `Contact` (Phase 0).
- Produces:
  - `filterContacts(cs: Contact[], q: string): Contact[]` — case-insensitive substring match over displayName, firstName, lastName, organization, emails[].value, phones[].value. Empty/whitespace query → all.
  - `sortContacts(cs: Contact[], key: "name" | "organization"): Contact[]` — returns a NEW sorted array (does not mutate); `name` sorts by displayName (locale, case-insensitive), `organization` by organization then displayName. Stable.

- [ ] **Step 1: Write the failing test — `packages/core/src/domain/contactQuery.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { filterContacts, sortContacts } from "./contactQuery";
import type { Contact } from "./contact";

function mk(id: string, displayName: string, org = "", extra: Partial<Contact> = {}): Contact {
  return {
    id, ownerId: "u1", createdAt: 1, updatedAt: 1, deletedAt: null,
    firstName: "", lastName: "", displayName, organization: org,
    phones: [], emails: [], addresses: [], webLinks: [], importantDates: [],
    customFields: [], categoryId: null, tags: [], ...extra,
  };
}

describe("filterContacts", () => {
  const cs = [
    mk("1", "Ada Lovelace", "Engines"),
    mk("2", "Grace Hopper", "Navy", { emails: [{ label: "w", value: "grace@navy.mil" }] }),
  ];
  it("returns all on empty query", () => {
    expect(filterContacts(cs, "  ").map((c) => c.id)).toEqual(["1", "2"]);
  });
  it("matches name case-insensitively", () => {
    expect(filterContacts(cs, "ada").map((c) => c.id)).toEqual(["1"]);
  });
  it("matches organization and email value", () => {
    expect(filterContacts(cs, "navy").map((c) => c.id)).toEqual(["2"]);
    expect(filterContacts(cs, "grace@navy").map((c) => c.id)).toEqual(["2"]);
  });
});

describe("sortContacts", () => {
  it("sorts by name without mutating input", () => {
    const cs = [mk("2", "Zoe"), mk("1", "Ada")];
    const sorted = sortContacts(cs, "name");
    expect(sorted.map((c) => c.displayName)).toEqual(["Ada", "Zoe"]);
    expect(cs.map((c) => c.id)).toEqual(["2", "1"]); // original untouched
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @retrorganizer/core test -- contactQuery`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `packages/core/src/domain/contactQuery.ts`**

```ts
import type { Contact } from "./contact";

export function filterContacts(cs: Contact[], q: string): Contact[] {
  const needle = q.trim().toLowerCase();
  if (needle === "") return cs;
  return cs.filter((c) => {
    const hay = [
      c.displayName, c.firstName, c.lastName, c.organization ?? "",
      ...c.emails.map((e) => e.value),
      ...c.phones.map((p) => p.value),
    ].join(" ").toLowerCase();
    return hay.includes(needle);
  });
}

export function sortContacts(cs: Contact[], key: "name" | "organization"): Contact[] {
  const copy = [...cs];
  copy.sort((a, b) => {
    if (key === "organization") {
      const byOrg = (a.organization ?? "").localeCompare(b.organization ?? "", undefined, { sensitivity: "base" });
      if (byOrg !== 0) return byOrg;
    }
    return a.displayName.localeCompare(b.displayName, undefined, { sensitivity: "base" });
  });
  return copy;
}
```

- [ ] **Step 4: Export from `packages/core/src/index.ts`** — add:

```ts
export * from "./domain/contactQuery";
```

- [ ] **Step 5: Run to verify it passes**

Run: `pnpm --filter @retrorganizer/core test -- contactQuery`
Expected: PASS — 4 tests.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/domain/contactQuery.ts packages/core/src/domain/contactQuery.test.ts packages/core/src/index.ts
git commit -m "feat(core): contact search + sort helpers"
```

---

### Task 7: `useContacts` hook (web)

**Files:**
- Create: `apps/web/src/contacts/useContacts.ts`
- Test: `apps/web/src/contacts/useContacts.test.tsx`

**Interfaces:**
- Consumes: `contactsRepo`, `Contact`, `ContactDraft` (core); `useAuth` (web, `apps/web/src/auth/AuthProvider`).
- Produces:
  - `useContacts(): { contacts: Contact[]; loading: boolean; error: string | null; create(d: ContactDraft): Promise<void>; update(id: string, d: ContactDraft): Promise<void>; remove(id: string): Promise<void>; reload(): Promise<void> }`
  - On mount (and when uid changes), loads `contactsRepo.listByOwner(uid)`. Mutations call the repo then `reload()`. If `user` is null, `contacts` is `[]` and `loading` false.

- [ ] **Step 1: Write the failing test — `apps/web/src/contacts/useContacts.test.tsx`**

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useContacts } from "./useContacts";

const listByOwner = vi.fn();
const create = vi.fn();
const softDelete = vi.fn();
vi.mock("@retrorganizer/core", () => ({
  contactsRepo: {
    listByOwner: (...a: unknown[]) => listByOwner(...a),
    create: (...a: unknown[]) => create(...a),
    update: vi.fn(),
    softDelete: (...a: unknown[]) => softDelete(...a),
  },
}));
vi.mock("../auth/AuthProvider", () => ({
  useAuth: () => ({ user: { uid: "u1", email: "a@x.io" } }),
}));

beforeEach(() => {
  listByOwner.mockReset().mockResolvedValue([
    { id: "c1", ownerId: "u1", displayName: "Ada", phones: [], emails: [], addresses: [], webLinks: [], importantDates: [], customFields: [], categoryId: null, tags: [], firstName: "", lastName: "", createdAt: 1, updatedAt: 1, deletedAt: null },
  ]);
  create.mockReset().mockResolvedValue(undefined);
  softDelete.mockReset().mockResolvedValue(undefined);
});

describe("useContacts", () => {
  it("loads contacts for the current user on mount", async () => {
    const { result } = renderHook(() => useContacts());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(listByOwner).toHaveBeenCalledWith("u1");
    expect(result.current.contacts.map((c) => c.id)).toEqual(["c1"]);
  });

  it("create calls repo then reloads", async () => {
    const { result } = renderHook(() => useContacts());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.create({ displayName: "Grace" } as never); });
    expect(create).toHaveBeenCalledWith("u1", { displayName: "Grace" });
    expect(listByOwner).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @retrorganizer/web test -- useContacts`
Expected: FAIL — module `./useContacts` not found.

- [ ] **Step 3: Implement `apps/web/src/contacts/useContacts.ts`**

```ts
import { useCallback, useEffect, useState } from "react";
import { contactsRepo, type Contact, type ContactDraft } from "@retrorganizer/core";
import { useAuth } from "../auth/AuthProvider";

export interface UseContacts {
  contacts: Contact[];
  loading: boolean;
  error: string | null;
  create(d: ContactDraft): Promise<void>;
  update(id: string, d: ContactDraft): Promise<void>;
  remove(id: string): Promise<void>;
  reload(): Promise<void>;
}

export function useContacts(): UseContacts {
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!uid) { setContacts([]); setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      setContacts(await contactsRepo.listByOwner(uid));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Échec du chargement");
    } finally {
      setLoading(false);
    }
  }, [uid]);

  useEffect(() => { void reload(); }, [reload]);

  const create = useCallback(async (d: ContactDraft) => {
    if (!uid) return;
    await contactsRepo.create(uid, d);
    await reload();
  }, [uid, reload]);

  const update = useCallback(async (id: string, d: ContactDraft) => {
    await contactsRepo.update(id, d);
    await reload();
  }, [reload]);

  const remove = useCallback(async (id: string) => {
    await contactsRepo.softDelete(id);
    await reload();
  }, [reload]);

  return { contacts, loading, error, create, update, remove, reload };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter @retrorganizer/web test -- useContacts`
Expected: PASS — 2 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/contacts/useContacts.ts apps/web/src/contacts/useContacts.test.tsx
git commit -m "feat(web): useContacts hook over contactsRepo"
```

---

### Task 8: `MultiValueField` + `ContactForm` (web)

**Files:**
- Create: `apps/web/src/contacts/MultiValueField.tsx`
- Create: `apps/web/src/contacts/AddressField.tsx`
- Create: `apps/web/src/contacts/ContactForm.tsx`
- Test: `apps/web/src/contacts/ContactForm.test.tsx`

**Interfaces:**
- Consumes: `tokens` (ui); `ContactDraft`, `emptyDraft`, `withDisplayName` (core).
- Produces:
  - `MultiValueField`: `<MultiValueField legend valueLabel valueType?="text"|"date" rows onChange />` where `rows: LabeledRow[]`, `LabeledRow = { label: string; value: string }`, and `onChange(rows: LabeledRow[]): void`. Renders an add button (`+ {legend}`), and per row two inputs (label, value — the value input is `type={valueType}`) + a remove button.
  - `AddressField`: `<AddressField rows onChange />` where `rows: PostalAddress[]` and `onChange(rows: PostalAddress[]): void`. Per row: inputs for label/street/city/postalCode/country (aria-labels `Adresse <champ> {i+1}`, e.g. `Adresse ville 1`) + a remove button; add button `+ Adresse`.
  - `ContactForm`: `<ContactForm initial?={ContactDraft} onSubmit onCancel />` — controlled form over a `ContactDraft`. Plain inputs for first/last/displayName/organization/title and a textarea for notes. `MultiValueField` for phones, emails, webLinks, importantDates (valueType `date`), and customFields (mapping `key`↔`label`). `AddressField` for addresses. On submit, applies `withDisplayName` and calls `onSubmit(draft)`. The submit button reads "Enregistrer".

- [ ] **Step 1: Write the failing test — `apps/web/src/contacts/ContactForm.test.tsx`**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { emptyDraft } from "@retrorganizer/core";
import { ContactForm } from "./ContactForm";

describe("ContactForm", () => {
  it("submits a draft with names, a phone, and an address", () => {
    const onSubmit = vi.fn();
    render(<ContactForm onSubmit={onSubmit} onCancel={() => {}} />);
    fireEvent.change(screen.getByLabelText("Prénom"), { target: { value: "Ada" } });
    fireEvent.change(screen.getByLabelText("Nom"), { target: { value: "Lovelace" } });
    fireEvent.click(screen.getByRole("button", { name: "+ Téléphone" }));
    fireEvent.change(screen.getByLabelText("Téléphone libellé 1"), { target: { value: "mobile" } });
    fireEvent.change(screen.getByLabelText("Téléphone valeur 1"), { target: { value: "+33 1" } });
    fireEvent.click(screen.getByRole("button", { name: "+ Adresse" }));
    fireEvent.change(screen.getByLabelText("Adresse ville 1"), { target: { value: "Paris" } });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const draft = onSubmit.mock.calls[0][0];
    expect(draft.firstName).toBe("Ada");
    expect(draft.displayName).toBe("Ada Lovelace"); // filled by withDisplayName
    expect(draft.phones).toEqual([{ label: "mobile", value: "+33 1" }]);
    expect(draft.addresses).toEqual([{ label: "", street: "", city: "Paris", postalCode: "", country: "" }]);
  });

  it("pre-fills from initial draft", () => {
    render(<ContactForm initial={{ ...emptyDraft(), displayName: "Grace Hopper" }} onSubmit={() => {}} onCancel={() => {}} />);
    expect(screen.getByLabelText("Nom affiché")).toHaveValue("Grace Hopper");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @retrorganizer/web test -- ContactForm`
Expected: FAIL — module `./ContactForm` not found.

- [ ] **Step 3: Implement `apps/web/src/contacts/MultiValueField.tsx`**

```tsx
import { tokens } from "@retrorganizer/ui";

export interface LabeledRow { label: string; value: string; }

export interface MultiValueFieldProps {
  legend: string;        // e.g. "Téléphone"
  valueLabel: string;    // placeholder for the value input
  valueType?: "text" | "date";
  rows: LabeledRow[];
  onChange(rows: LabeledRow[]): void;
}

export function MultiValueField({ legend, valueLabel, valueType = "text", rows, onChange }: MultiValueFieldProps) {
  function update(i: number, patch: Partial<LabeledRow>) {
    onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  }
  function add() { onChange([...rows, { label: "", value: "" }]); }
  function removeAt(i: number) { onChange(rows.filter((_, j) => j !== i)); }

  return (
    <fieldset style={{ border: `1px solid ${tokens.color.line}`, marginBottom: tokens.space.sm }}>
      <legend>{legend}</legend>
      {rows.map((r, i) => (
        <div key={i} style={{ display: "flex", gap: tokens.space.xs, marginBottom: tokens.space.xs }}>
          <input
            aria-label={`${legend} libellé ${i + 1}`}
            placeholder="libellé"
            value={r.label}
            onChange={(e) => update(i, { label: e.target.value })}
          />
          <input
            aria-label={`${legend} valeur ${i + 1}`}
            type={valueType}
            placeholder={valueLabel}
            value={r.value}
            onChange={(e) => update(i, { value: e.target.value })}
          />
          <button type="button" aria-label={`Supprimer ${legend} ${i + 1}`} onClick={() => removeAt(i)}>×</button>
        </div>
      ))}
      <button type="button" onClick={add}>+ {legend}</button>
    </fieldset>
  );
}
```

- [ ] **Step 3b: Implement `apps/web/src/contacts/AddressField.tsx`**

```tsx
import { tokens } from "@retrorganizer/ui";
import type { PostalAddress } from "@retrorganizer/core";

export interface AddressFieldProps {
  rows: PostalAddress[];
  onChange(rows: PostalAddress[]): void;
}

const FIELDS: { key: keyof PostalAddress; label: string; ph: string }[] = [
  { key: "label", label: "libellé", ph: "libellé" },
  { key: "street", label: "rue", ph: "rue" },
  { key: "city", label: "ville", ph: "ville" },
  { key: "postalCode", label: "code postal", ph: "code postal" },
  { key: "country", label: "pays", ph: "pays" },
];

export function AddressField({ rows, onChange }: AddressFieldProps) {
  function update(i: number, patch: Partial<PostalAddress>) {
    onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  }
  function add() { onChange([...rows, { label: "", street: "", city: "", postalCode: "", country: "" }]); }
  function removeAt(i: number) { onChange(rows.filter((_, j) => j !== i)); }

  return (
    <fieldset style={{ border: `1px solid ${tokens.color.line}`, marginBottom: tokens.space.sm }}>
      <legend>Adresse</legend>
      {rows.map((r, i) => (
        <div key={i} style={{ display: "flex", flexWrap: "wrap", gap: tokens.space.xs, marginBottom: tokens.space.xs }}>
          {FIELDS.map((f) => (
            <input
              key={f.key}
              aria-label={`Adresse ${f.label} ${i + 1}`}
              placeholder={f.ph}
              value={r[f.key]}
              onChange={(e) => update(i, { [f.key]: e.target.value })}
            />
          ))}
          <button type="button" aria-label={`Supprimer Adresse ${i + 1}`} onClick={() => removeAt(i)}>×</button>
        </div>
      ))}
      <button type="button" onClick={add}>+ Adresse</button>
    </fieldset>
  );
}
```

- [ ] **Step 4: Implement `apps/web/src/contacts/ContactForm.tsx`**

```tsx
import { useState } from "react";
import { tokens } from "@retrorganizer/ui";
import { emptyDraft, withDisplayName, type ContactDraft } from "@retrorganizer/core";
import { MultiValueField } from "./MultiValueField";
import { AddressField } from "./AddressField";

export interface ContactFormProps {
  initial?: ContactDraft;
  onSubmit(draft: ContactDraft): void;
  onCancel(): void;
}

export function ContactForm({ initial, onSubmit, onCancel }: ContactFormProps) {
  const [draft, setDraft] = useState<ContactDraft>(initial ?? emptyDraft());
  function set<K extends keyof ContactDraft>(key: K, value: ContactDraft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }
  function submit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit(withDisplayName(draft));
  }
  const field = (label: string, key: "firstName" | "lastName" | "displayName" | "organization" | "title") => (
    <label style={{ display: "block", marginBottom: tokens.space.xs }}>
      {label}
      <input
        aria-label={label}
        value={draft[key]}
        onChange={(e) => set(key, e.target.value)}
        style={{ display: "block", width: "100%" }}
      />
    </label>
  );

  return (
    <form onSubmit={submit} style={{ padding: tokens.space.md, font: `13px ${tokens.font.body}` }}>
      {field("Prénom", "firstName")}
      {field("Nom", "lastName")}
      {field("Nom affiché", "displayName")}
      {field("Organisation", "organization")}
      {field("Fonction", "title")}
      <MultiValueField legend="Téléphone" valueLabel="numéro" rows={draft.phones}
        onChange={(rows) => set("phones", rows)} />
      <MultiValueField legend="Email" valueLabel="adresse" rows={draft.emails}
        onChange={(rows) => set("emails", rows)} />
      <AddressField rows={draft.addresses} onChange={(rows) => set("addresses", rows)} />
      <MultiValueField legend="Lien web" valueLabel="URL" rows={draft.webLinks}
        onChange={(rows) => set("webLinks", rows)} />
      <MultiValueField legend="Date importante" valueLabel="date" valueType="date"
        rows={draft.importantDates.map((d) => ({ label: d.label, value: d.date }))}
        onChange={(rows) => set("importantDates", rows.map((r) => ({ label: r.label, date: r.value })))} />
      <MultiValueField legend="Champ perso" valueLabel="valeur"
        rows={draft.customFields.map((f) => ({ label: f.key, value: f.value }))}
        onChange={(rows) => set("customFields", rows.map((r) => ({ key: r.label, value: r.value })))} />
      <label style={{ display: "block", marginBottom: tokens.space.xs }}>
        Notes
        <textarea aria-label="Notes" value={draft.notes}
          onChange={(e) => set("notes", e.target.value)} style={{ display: "block", width: "100%" }} />
      </label>
      <div style={{ display: "flex", gap: tokens.space.sm }}>
        <button type="submit">Enregistrer</button>
        <button type="button" onClick={onCancel}>Annuler</button>
      </div>
    </form>
  );
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `pnpm --filter @retrorganizer/web test -- ContactForm`
Expected: PASS — 2 tests. Then `pnpm --filter @retrorganizer/web typecheck` → clean.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/contacts/MultiValueField.tsx apps/web/src/contacts/AddressField.tsx apps/web/src/contacts/ContactForm.tsx apps/web/src/contacts/ContactForm.test.tsx
git commit -m "feat(web): MultiValueField + AddressField + ContactForm (all multi-value fields)"
```

---

### Task 9: `ContactList` + `ImportExportBar` + `ContactsModule` + route (web)

**Files:**
- Create: `apps/web/src/contacts/ContactList.tsx`
- Create: `apps/web/src/contacts/ImportExportBar.tsx`
- Create: `apps/web/src/contacts/ContactsModule.tsx`
- Modify: `apps/web/src/App.tsx` (route `address` → `ContactsModule`)
- Test: `apps/web/src/contacts/ContactList.test.tsx`
- Test: `apps/web/src/contacts/ContactsModule.test.tsx`

**Interfaces:**
- Consumes: `useContacts` (Task 7), `ContactForm` (Task 8), `filterContacts`, `sortContacts`, `contactsToVCard`, `contactsToCsv`, `vCardToDrafts`, `csvToDrafts`, `draftFromContact` (core); `tokens` (ui).
- Produces:
  - `ContactList`: `<ContactList contacts onSelect onNew query onQueryChange sortKey onSortKeyChange />` — search input (`aria-label="Rechercher"`), a sort `<select>` (`aria-label="Trier par"`, options name/organization), a "+ Nouveau" button, and a list of buttons (one per contact, showing displayName + organization).
  - `ImportExportBar`: `<ImportExportBar contacts onImport />` — "Exporter vCard", "Exporter CSV" buttons (build text + trigger download via a Blob anchor), and a file `<input type="file" aria-label="Importer un fichier">` that reads the file, detects vCard vs CSV by content/extension, and calls `onImport(drafts)`.
  - `ContactsModule`: orchestrates `useContacts` + list/form/import-export. Holds `mode: "list" | "edit"`, the selected contact, `query`, `sortKey`. New/select → edit; submit → create/update + back to list; import → create each draft.
  - `App.tsx`: the route for the `address` section renders `<ContactsModule />`; other MVP sections keep `<SectionPlaceholder />`.

- [ ] **Step 1: Write the failing test — `apps/web/src/contacts/ContactList.test.tsx`**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ContactList } from "./ContactList";
import type { Contact } from "@retrorganizer/core";

function mk(id: string, name: string, org = ""): Contact {
  return { id, ownerId: "u1", createdAt: 1, updatedAt: 1, deletedAt: null, firstName: "", lastName: "", displayName: name, organization: org, phones: [], emails: [], addresses: [], webLinks: [], importantDates: [], customFields: [], categoryId: null, tags: [] };
}

describe("ContactList", () => {
  const contacts = [mk("1", "Ada Lovelace", "Engines"), mk("2", "Grace Hopper", "Navy")];

  it("renders one entry per contact and fires onSelect", () => {
    const onSelect = vi.fn();
    render(<ContactList contacts={contacts} onSelect={onSelect} onNew={() => {}}
      query="" onQueryChange={() => {}} sortKey="name" onSortKeyChange={() => {}} />);
    expect(screen.getByRole("button", { name: /Ada Lovelace/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Grace Hopper/ }));
    expect(onSelect).toHaveBeenCalledWith(contacts[1]);
  });

  it("typing in search calls onQueryChange", () => {
    const onQueryChange = vi.fn();
    render(<ContactList contacts={contacts} onSelect={() => {}} onNew={() => {}}
      query="" onQueryChange={onQueryChange} sortKey="name" onSortKeyChange={() => {}} />);
    fireEvent.change(screen.getByLabelText("Rechercher"), { target: { value: "ada" } });
    expect(onQueryChange).toHaveBeenCalledWith("ada");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @retrorganizer/web test -- ContactList`
Expected: FAIL — module `./ContactList` not found.

- [ ] **Step 3: Implement `apps/web/src/contacts/ContactList.tsx`**

```tsx
import { tokens } from "@retrorganizer/ui";
import type { Contact } from "@retrorganizer/core";

export type SortKey = "name" | "organization";

export interface ContactListProps {
  contacts: Contact[];
  onSelect(c: Contact): void;
  onNew(): void;
  query: string;
  onQueryChange(q: string): void;
  sortKey: SortKey;
  onSortKeyChange(k: SortKey): void;
}

export function ContactList({ contacts, onSelect, onNew, query, onQueryChange, sortKey, onSortKeyChange }: ContactListProps) {
  return (
    <div style={{ padding: tokens.space.sm, font: `13px ${tokens.font.body}` }}>
      <div style={{ display: "flex", gap: tokens.space.sm, marginBottom: tokens.space.sm }}>
        <input aria-label="Rechercher" placeholder="Rechercher" value={query}
          onChange={(e) => onQueryChange(e.target.value)} />
        <select aria-label="Trier par" value={sortKey}
          onChange={(e) => onSortKeyChange(e.target.value as SortKey)}>
          <option value="name">Nom</option>
          <option value="organization">Organisation</option>
        </select>
        <button type="button" onClick={onNew}>+ Nouveau</button>
      </div>
      <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {contacts.map((c) => (
          <li key={c.id}>
            <button type="button" onClick={() => onSelect(c)}
              style={{ display: "block", width: "100%", textAlign: "left", border: "none",
                borderBottom: `1px solid ${tokens.color.line}`, background: "transparent",
                padding: tokens.space.xs, cursor: "pointer", color: tokens.color.ink }}>
              {c.displayName}{c.organization ? ` — ${c.organization}` : ""}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 4: Implement `apps/web/src/contacts/ImportExportBar.tsx`**

```tsx
import { tokens } from "@retrorganizer/ui";
import {
  contactsToVCard, contactsToCsv, vCardToDrafts, csvToDrafts,
  type Contact, type ContactDraft,
} from "@retrorganizer/core";

export interface ImportExportBarProps {
  contacts: Contact[];
  onImport(drafts: ContactDraft[]): void;
}

function download(filename: string, text: string) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function ImportExportBar({ contacts, onImport }: ImportExportBarProps) {
  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const isVcard = /BEGIN:VCARD/i.test(text) || file.name.toLowerCase().endsWith(".vcf");
    onImport(isVcard ? vCardToDrafts(text) : csvToDrafts(text));
    e.target.value = "";
  }
  return (
    <div style={{ display: "flex", gap: tokens.space.sm, padding: tokens.space.sm,
      borderBottom: `1px solid ${tokens.color.line}` }}>
      <button type="button" onClick={() => download("contacts.vcf", contactsToVCard(contacts))}>Exporter vCard</button>
      <button type="button" onClick={() => download("contacts.csv", contactsToCsv(contacts))}>Exporter CSV</button>
      <input type="file" aria-label="Importer un fichier" accept=".vcf,.csv,text/*" onChange={onFile} />
    </div>
  );
}
```

- [ ] **Step 5: Implement `apps/web/src/contacts/ContactsModule.tsx`**

```tsx
import { useMemo, useState } from "react";
import { tokens } from "@retrorganizer/ui";
import {
  filterContacts, sortContacts, draftFromContact,
  type Contact, type ContactDraft,
} from "@retrorganizer/core";
import { useContacts } from "./useContacts";
import { ContactList, type SortKey } from "./ContactList";
import { ContactForm } from "./ContactForm";
import { ImportExportBar } from "./ImportExportBar";

export function ContactsModule() {
  const { contacts, loading, error, create, update, remove } = useContacts();
  const [mode, setMode] = useState<"list" | "edit">("list");
  const [selected, setSelected] = useState<Contact | null>(null);
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("name");

  const visible = useMemo(
    () => sortContacts(filterContacts(contacts, query), sortKey),
    [contacts, query, sortKey],
  );

  async function onSubmit(draft: ContactDraft) {
    if (selected) await update(selected.id, draft);
    else await create(draft);
    setMode("list");
    setSelected(null);
  }

  async function onImport(drafts: ContactDraft[]) {
    for (const d of drafts) await create(d);
  }

  if (loading) return <div style={{ padding: tokens.space.lg }}>Chargement…</div>;

  return (
    <div>
      {error && <p role="alert" style={{ color: "#a8431f", padding: tokens.space.sm }}>{error}</p>}
      {mode === "list" ? (
        <>
          <ImportExportBar contacts={contacts} onImport={onImport} />
          <ContactList
            contacts={visible}
            onSelect={(c) => { setSelected(c); setMode("edit"); }}
            onNew={() => { setSelected(null); setMode("edit"); }}
            query={query} onQueryChange={setQuery}
            sortKey={sortKey} onSortKeyChange={setSortKey}
          />
        </>
      ) : (
        <div>
          <ContactForm
            initial={selected ? draftFromContact(selected) : undefined}
            onSubmit={onSubmit}
            onCancel={() => { setMode("list"); setSelected(null); }}
          />
          {selected && (
            <button type="button" style={{ margin: tokens.space.md }}
              onClick={async () => { await remove(selected.id); setMode("list"); setSelected(null); }}>
              Supprimer
            </button>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 6: Wire the route in `apps/web/src/App.tsx`**

Add the import near the other route imports:

```tsx
import { ContactsModule } from "./contacts/ContactsModule";
```

Then change the section route element so the `address` section renders the module. Replace the single route-mapping line:

```tsx
{SECTIONS.map((s) => (
  <Route key={s.id} path={s.path}
    element={s.mvp ? <SectionPlaceholder label={s.label} /> : <ComingSoon label={s.label} />} />
))}
```

with:

```tsx
{SECTIONS.map((s) => (
  <Route key={s.id} path={s.path}
    element={
      s.id === "address"
        ? <ContactsModule />
        : s.mvp
          ? <SectionPlaceholder label={s.label} />
          : <ComingSoon label={s.label} />
    } />
))}
```

- [ ] **Step 7: Write the module test — `apps/web/src/contacts/ContactsModule.test.tsx`**

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ContactsModule } from "./ContactsModule";

const listByOwner = vi.fn();
const create = vi.fn();
vi.mock("@retrorganizer/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@retrorganizer/core")>();
  return {
    ...actual,
    contactsRepo: {
      listByOwner: (...a: unknown[]) => listByOwner(...a),
      create: (...a: unknown[]) => create(...a),
      update: vi.fn(),
      softDelete: vi.fn(),
    },
  };
});
vi.mock("../auth/AuthProvider", () => ({ useAuth: () => ({ user: { uid: "u1", email: "a@x.io" } }) }));

beforeEach(() => {
  listByOwner.mockReset().mockResolvedValue([]);
  create.mockReset().mockResolvedValue(undefined);
});

describe("ContactsModule", () => {
  it("creates a contact through the new-contact flow", async () => {
    render(<ContactsModule />);
    await waitFor(() => expect(screen.getByRole("button", { name: "+ Nouveau" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "+ Nouveau" }));
    fireEvent.change(screen.getByLabelText("Prénom"), { target: { value: "Ada" } });
    fireEvent.change(screen.getByLabelText("Nom"), { target: { value: "Lovelace" } });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
    expect(create.mock.calls[0][0]).toBe("u1");
    expect(create.mock.calls[0][1].displayName).toBe("Ada Lovelace");
  });
});
```

This test uses the REAL core helpers (`filterContacts`, `sortContacts`, `draftFromContact`, `withDisplayName`) via `importOriginal`, mocking only `contactsRepo` and auth.

- [ ] **Step 8: Run to verify both web tests pass**

Run: `pnpm --filter @retrorganizer/web test -- contacts`
Expected: PASS — ContactList (2) + ContactsModule (1) + ContactForm (2) + useContacts (2).

- [ ] **Step 9: Full verification**

Run: `pnpm --filter @retrorganizer/web test` → all web tests pass (incl. App/auth/sections from Phase 0).
Run: `pnpm --filter @retrorganizer/web typecheck` → clean.
Run: `pnpm build` → succeeds, `apps/web/dist` produced.

- [ ] **Step 10: Commit**

```bash
git add apps/web/src/contacts/ContactList.tsx apps/web/src/contacts/ImportExportBar.tsx apps/web/src/contacts/ContactsModule.tsx apps/web/src/contacts/ContactList.test.tsx apps/web/src/contacts/ContactsModule.test.tsx apps/web/src/App.tsx
git commit -m "feat(web): contacts list/search/sort + import-export + Address route"
```

---

## Définition de « terminé » pour la Phase 1

- `pnpm exec firebase emulators:exec --only auth,firestore "pnpm test"` : tous les tests verts (core : domaine + rules + repo + **contactDraft, vcardEscape, vcardExport, vcardImport, csv, contactQuery** ; web : Phase 0 + **useContacts, ContactForm, ContactList, ContactsModule**).
- `pnpm build` produit `apps/web/dist`.
- L'onglet **Address** affiche la liste des contacts, permet créer/éditer/supprimer avec champs multi-valeurs, rechercher et trier, et exporter/importer vCard + CSV.
- Round-trips vCard (champs standard) et CSV (pleine fidélité) couverts par des tests.

À l'issue de la Phase 1, le plan suivant est la **Phase 2 — Calendrier** (vues jour/semaine/mois/agenda, récurrence RRULE, liens contact, import/export ICS).
