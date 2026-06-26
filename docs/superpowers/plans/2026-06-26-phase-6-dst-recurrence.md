# Retrorganizer — Phase 6 : Fix DST des récurrences — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corriger la dérive d'heure des événements/tâches récurrents à travers un changement d'heure (DST). Le moteur de récurrence (`packages/core/src/domain/recurrence.ts`) ancre actuellement le RRULE sur un `DTSTART` **UTC**, donc rrule répète à instant UTC fixe — un hebdo « 9 h locale » s'affiche « 10 h » après le passage à l'heure d'été. On bascule sur un ancrage **flottant/local** pour que les occurrences conservent leur mur-horloge local.

**Architecture:** Changement confiné à `recurrence.ts` (fonctions pures `expandEvent`/`expandEvents`/`nextOccurrenceAfter`, consommées par le calendrier, les rappels et les tâches récurrentes). On remplace l'ancrage UTC par la « danse des fuseaux » rrule : formater le `DTSTART` en datetime **flottant** (composantes LOCALES, sans `Z`), passer à `rrule.between/after` des bornes flottantes (composantes UTC = composantes locales), puis reconvertir chaque occurrence flottante en instant local réel.

**Tech Stack:** TypeScript strict, `rrule` (déjà là), Vitest. Aucune nouvelle dépendance. Aucun changement d'UI ni de modèle de données (les `recurrence` RRULE et `recurrenceExceptions` en ms restent identiques).

## Global Constraints

- Produit : **Retrorganizer**. TypeScript **strict** (noUncheckedIndexedAccess ON).
- Changement **confiné à `packages/core/src/domain/recurrence.ts`** : signatures publiques inchangées (`expandEvent(e, rangeStart, rangeEnd)`, `expandEvents(...)`, `nextOccurrenceAfter(recurrence, afterMs)`). Aucune modif d'`event.ts`, `ics.ts`, des hooks ou de l'UI.
- **Rétro-compatibilité** : les suites existantes `recurrence.test`, `recurrenceNext.test`, `dueReminders.test` doivent rester vertes (leurs fenêtres sont en janvier — pas de transition DST — donc l'ancrage flottant donne les mêmes ms que l'ancrage UTC).
- `recurrenceExceptions` (ms de début d'occurrence) et la valeur `recurrence` (chaîne RRULE nue) ne changent pas de format ; le matching d'exceptions reste par égalité de ms réel.
- Portée explicitement **hors scope** (suivi séparé) : l'encodage **ICS** (`ics.ts`) reste en UTC — l'interop DST avec des apps externes (TZID/floating dans le .ics) est un autre item. Ce fix corrige l'**affichage interne** (calendrier + rappels + avance des tâches récurrentes).

## Interfaces (inchangées en signature)

- `expandEvent(e: Event, rangeStart: number, rangeEnd: number): Occurrence[]`
- `expandEvents(events: Event[], rangeStart: number, rangeEnd: number): Occurrence[]`
- `nextOccurrenceAfter(recurrence: string, afterMs: number): number | null`
- `Occurrence = { event: Event; start: number; end: number }`

---

### Task 1: Ancrage flottant/local de la récurrence (core)

**Files:**
- Modify: `packages/core/src/domain/recurrence.ts`
- Test: `packages/core/src/domain/recurrenceDst.test.ts` (new)

**Interfaces:**
- Consumes: `Event` (core), `rrulestr` (rrule).
- Produces: `expandEvent`/`expandEvents`/`nextOccurrenceAfter` unchanged in signature, but now anchor the RRULE to a **floating/local** DTSTART so occurrences preserve local wall-clock across DST. `expandEvents` keeps its sort by `start`. Internal helpers `toICalFloating(ms)`, `toFloatingDate(ms)`, `fromFloatingDate(d)` replace the old UTC `toICalUtc` (remove `toICalUtc` from this file — it was internal and is no longer used here; `ics.ts` keeps its own `icalUtc`).

- [ ] **Step 1: READ the current `packages/core/src/domain/recurrence.ts`** to see the exact current code (the `toICalUtc` helper, `expandEvent`, `expandEvents`, `nextOccurrenceAfter`). You will replace the UTC anchoring with floating anchoring and remove the now-unused `toICalUtc`.

- [ ] **Step 2: Write the failing DST test — `packages/core/src/domain/recurrenceDst.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { expandEvent, nextOccurrenceAfter } from "./recurrence";
import { parseEvent, type Event } from "./event";

// NOTE: this test is meaningful in a DST timezone (the dev machine, e.g. Europe/Paris):
// the OLD UTC-anchored code drifts an hour across the spring/autumn transition and FAILS;
// the floating-local fix keeps the local wall-clock and PASSES. In a UTC CI runner there is
// no DST so it passes either way — that's expected (the test protects real DST users).

function weekly(localStartMs: number): Event {
  return parseEvent({
    id: "e1", ownerId: "u1", createdAt: 1, updatedAt: 1, deletedAt: null,
    title: "Standup", start: localStartMs, end: localStartMs + 3600000, recurrence: "FREQ=WEEKLY",
  });
}

describe("recurrence keeps local wall-clock across DST", () => {
  it("a weekly 09:00 event stays at 09:00 local across the year (incl. DST transitions)", () => {
    const start = new Date(2026, 0, 5, 9, 0, 0).getTime(); // local Mon 2026-01-05 09:00
    const occ = expandEvent(weekly(start), start, new Date(2026, 11, 31, 23, 59).getTime());
    expect(occ.length).toBeGreaterThan(40);
    for (const o of occ) {
      const d = new Date(o.start);
      expect(d.getHours()).toBe(9);
      expect(d.getMinutes()).toBe(0);
    }
  });

  it("nextOccurrenceAfter preserves the local hour one week later", () => {
    const due = new Date(2026, 2, 23, 9, 0, 0).getTime(); // local Mon 2026-03-23 09:00 (just before a typical spring transition)
    const next = nextOccurrenceAfter("FREQ=WEEKLY", due);
    expect(next).not.toBeNull();
    expect(new Date(next!).getHours()).toBe(9);
    expect(new Date(next!).getMinutes()).toBe(0);
  });
});
```

- [ ] **Step 3: Run to verify it fails on a DST machine**

Run: `pnpm --filter @retrorganizer/core test -- recurrenceDst`
Expected (on a DST timezone runner, e.g. the dev Mac): FAIL — occurrences after the DST transition report `getHours() === 10` (or 8), not 9. (On a UTC runner it would pass already — if so, note the runner TZ in the report; the fix is still required and the existing suites prove no regression.)

- [ ] **Step 4: Replace the UTC anchoring with floating anchoring in `packages/core/src/domain/recurrence.ts`**

Keep the imports (`rrulestr` from "rrule", `Event` type) and the `Occurrence` interface. Replace the UTC date helper(s) and the bodies of `expandEvent`/`nextOccurrenceAfter` with the floating versions below. Remove the now-unused `toICalUtc`.

```ts
import { rrulestr } from "rrule";
import type { Event } from "./event";

export interface Occurrence {
  event: Event;
  start: number;
  end: number;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

// Floating iCal datetime (no "Z") built from the LOCAL wall-clock of an instant.
function toICalFloating(ms: number): string {
  const d = new Date(ms);
  return (
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
    `T${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  );
}

// A Date whose UTC components equal the LOCAL components of `ms` — for passing floating bounds to rrule.
function toFloatingDate(ms: number): Date {
  const d = new Date(ms);
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds()));
}

// Inverse: interpret a floating Date's UTC components as LOCAL wall-clock → the real instant in ms.
function fromFloatingDate(d: Date): number {
  return new Date(
    d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(),
    d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds(),
  ).getTime();
}

export function expandEvent(e: Event, rangeStart: number, rangeEnd: number): Occurrence[] {
  const duration = e.end - e.start;
  if (!e.recurrence) {
    if (e.start <= rangeEnd && e.end >= rangeStart) {
      return [{ event: e, start: e.start, end: e.end }];
    }
    return [];
  }
  const rule = rrulestr(`DTSTART:${toICalFloating(e.start)}\nRRULE:${e.recurrence}`);
  const exceptions = new Set(e.recurrenceExceptions);
  return rule
    .between(toFloatingDate(rangeStart), toFloatingDate(rangeEnd), true)
    .map((d) => fromFloatingDate(d))
    .filter((ms) => !exceptions.has(ms))
    .map((ms) => ({ event: e, start: ms, end: ms + duration }));
}

export function expandEvents(events: Event[], rangeStart: number, rangeEnd: number): Occurrence[] {
  return events
    .flatMap((e) => expandEvent(e, rangeStart, rangeEnd))
    .sort((a, b) => a.start - b.start);
}

export function nextOccurrenceAfter(recurrence: string, afterMs: number): number | null {
  const rule = rrulestr(`DTSTART:${toICalFloating(afterMs)}\nRRULE:${recurrence}`);
  const next = rule.after(toFloatingDate(afterMs), false);
  return next ? fromFloatingDate(next) : null;
}
```

> Pourquoi ça marche : un `DTSTART` flottant (sans `Z`) est interprété par rrule via les composantes telles quelles ; les occurrences reviennent comme des Dates « flottantes » dont les composantes UTC = le mur-horloge local récurrent. `toFloatingDate` encode les bornes dans le même espace, et `fromFloatingDate` reconstruit l'instant réel via `new Date(localComponents)` — qui résout correctement le décalage DST du jour considéré. Pour une fenêtre sans transition (ex. janvier), l'avance d'un jour/semaine = un nombre entier d'heures constant, donc les ms produits sont identiques à l'ancien ancrage UTC → les suites existantes restent vertes.

- [ ] **Step 5: Run the DST test — now green**

Run: `pnpm --filter @retrorganizer/core test -- recurrenceDst`
Expected: PASS — 2 tests (toutes les occurrences à 09:00 local ; `nextOccurrenceAfter` à 09:00 local).

- [ ] **Step 6: Run the existing recurrence-dependent suites — confirm NO regression**

Run: `pnpm --filter @retrorganizer/core test -- recurrence recurrenceNext dueReminders`
Expected: PASS — toutes vertes (les fixtures de janvier produisent les mêmes ms qu'avant).
Then the full core suite + typecheck:
Run: `pnpm --filter @retrorganizer/core test` (pure suites) and `pnpm --filter @retrorganizer/core typecheck` → clean.
Also run the whole monorepo to be safe (the web calendar/reminders consume this):
Run: `pnpm exec firebase emulators:exec --only auth,firestore "pnpm test"` → all green.

> Note exécutant : Java/openjdk sur le PATH pour l'émulateur. `recurrence.ts` est pur — ses propres tests ne touchent pas l'émulateur, mais le run complet vérifie que rien (web inclus) ne régresse.

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/domain/recurrence.ts packages/core/src/domain/recurrenceDst.test.ts
git commit -m "fix(core): anchor recurrence to local wall-clock (DST-correct expansion)"
```

---

## Définition de « terminé »

- `pnpm exec firebase emulators:exec --only auth,firestore "pnpm test"` : tous les tests verts, incluant la nouvelle suite **recurrenceDst** et les suites existantes **recurrence / recurrenceNext / dueReminders** (aucune régression).
- `pnpm --filter @retrorganizer/core typecheck` propre.
- Un événement (ou une tâche) récurrent conserve son **mur-horloge local** de part et d'autre d'un changement d'heure — visible dans le calendrier, les rappels et l'avance des tâches récurrentes.

Suivi restant (Phase 6, non couvert ici) : interop **ICS** DST (TZID/floating dans le `.ics` exporté), push serveur FCM, `EventsProvider`, gestionnaire de catégories, affichage catégorie/tags dans les listes, code-splitting du bundle, durcissement CI.
