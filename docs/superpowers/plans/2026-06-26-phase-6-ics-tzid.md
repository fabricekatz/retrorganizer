# ICS TZID Interop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make ICS import/export preserve local wall-clock time across DST, consistent with the app's floating-time recurrence model. Import must correctly interpret `TZID`-qualified, UTC (`Z`), and floating date-times; export must emit timed values as floating local time so external calendars don't drift recurrences across a DST boundary.

**Architecture:** Two coupled changes in `packages/core/src/io/ics.ts`, sequenced import-first so each task is independently green:
- **Import** gains three cases in `parseICalDate`: trailing `Z` → UTC instant (unchanged); a `TZID=<IANA zone>` parameter → convert the named-zone wall-clock to the real instant via an `Intl.DateTimeFormat`-based offset helper (no external tz library); otherwise (floating) → local wall-clock instant. All-day `VALUE=DATE` stays a UTC-midnight instant (unchanged).
- **Export** serializes timed `DTSTART`/`DTEND`/`EXDATE` as floating local time (no `Z`), so a recurring event's `RRULE` expands at the same wall-clock each occurrence in any consumer. All-day `VALUE=DATE` and `DTSTAMP` (a genuine UTC timestamp) are unchanged.

The order matters: the existing round-trip test asserts the round-tripped **instant**, and floating-export + floating-as-local-import are inverse operations regardless of the runner's timezone — but only once both halves agree. Doing import first keeps the round-trip green throughout (the still-UTC export round-trips via the unchanged `Z` path; after export flips to floating, the already-floating-aware import round-trips it).

**Tech Stack:** TypeScript (strict), `Intl.DateTimeFormat` (standard, platform-agnostic), Vitest.

## Global Constraints

- TypeScript strict with `noUncheckedIndexedAccess`. No `as` casts (use `?? "0"` / `Number(...)`, not `!`/`as`).
- `packages/core` stays platform-agnostic: use only `Intl.DateTimeFormat` (available in Node, jsdom, browsers) — do NOT add a timezone library.
- Behavior-preserving where not explicitly changed: the `Z` (UTC) import path, all-day `VALUE=DATE` (UTC-midnight) import/export, and `DTSTAMP` export must be byte-identical to today.
- Tests must be deterministic regardless of the CI runner's timezone: assert TZID conversions against fixed known offsets (Europe/Paris is UTC+1 in January, UTC+2 in July), assert floating round-trips against the instant (not the string), and construct floating-export test events with the LOCAL `Date` constructor.
- An unknown/invalid `TZID` must not throw — fall back to treating the value as floating (local).

---

### Task 1: Import — handle TZID and floating date-times

**Files:**
- Modify: `packages/core/src/io/ics.ts`
- Test: `packages/core/src/io/icsImport.test.ts`

**Interfaces:**
- Consumes: `Intl.DateTimeFormat`.
- Produces: `parseICalDate(value, params)` now returns the correct instant for `Z` (UTC), `TZID=<zone>` (named-zone wall-clock), and floating (local) timed values; all-day unchanged. New internal helpers `zoneOffsetMs` and `instantFromZonedWallClock`. No exported-signature change.

- [ ] **Step 1: Write the failing tests**

Add to `packages/core/src/io/icsImport.test.ts` (keep all existing tests unchanged):

```ts
  it("parses a floating timed VEVENT as local wall-clock", () => {
    const text = ["BEGIN:VEVENT", "UID:f1", "DTSTART:20260105T090000", "DTEND:20260105T100000", "SUMMARY:Floating", "END:VEVENT"].join("\r\n");
    const d = icsToEventDrafts(text)[0]!;
    expect(d.start).toBe(new Date(2026, 0, 5, 9, 0, 0).getTime()); // local 09:00, any runner TZ
    expect(d.end).toBe(new Date(2026, 0, 5, 10, 0, 0).getTime());
  });

  it("parses a TZID-qualified DTSTART to the correct instant (winter, Europe/Paris = UTC+1)", () => {
    const text = ["BEGIN:VEVENT", "UID:t1", "DTSTART;TZID=Europe/Paris:20260105T090000", "SUMMARY:Paris", "END:VEVENT"].join("\r\n");
    const d = icsToEventDrafts(text)[0]!;
    expect(d.start).toBe(Date.UTC(2026, 0, 5, 8, 0, 0)); // 09:00 Paris (UTC+1) = 08:00 UTC
  });

  it("parses a TZID-qualified DTSTART across the DST boundary (summer, Europe/Paris = UTC+2)", () => {
    const text = ["BEGIN:VEVENT", "UID:t2", "DTSTART;TZID=Europe/Paris:20260705T090000", "SUMMARY:Été", "END:VEVENT"].join("\r\n");
    const d = icsToEventDrafts(text)[0]!;
    expect(d.start).toBe(Date.UTC(2026, 6, 5, 7, 0, 0)); // 09:00 Paris (UTC+2) = 07:00 UTC
  });

  it("falls back to floating (local) for an unknown TZID", () => {
    const text = ["BEGIN:VEVENT", "UID:t3", "DTSTART;TZID=Not/AZone:20260105T090000", "SUMMARY:X", "END:VEVENT"].join("\r\n");
    const d = icsToEventDrafts(text)[0]!;
    expect(d.start).toBe(new Date(2026, 0, 5, 9, 0, 0).getTime());
  });
```

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm --filter @retrorganizer/core test -- icsImport`
Expected: FAIL — floating parses as UTC (wrong instant) and TZID is ignored (parsed as UTC).

- [ ] **Step 3: Implement in `packages/core/src/io/ics.ts`**

Add these helpers above `parseICalDate`:

```ts
// Offset (ms) of an IANA zone at a given instant: (zone wall-clock shown for utcMs) - utcMs.
function zoneOffsetMs(zone: string, utcMs: number): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: zone, hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const parts: Record<string, string> = {};
  for (const p of dtf.formatToParts(new Date(utcMs))) parts[p.type] = p.value;
  const asUTC = Date.UTC(
    Number(parts["year"]), Number(parts["month"]) - 1, Number(parts["day"]),
    Number(parts["hour"]), Number(parts["minute"]), Number(parts["second"]),
  );
  return asUTC - utcMs;
}

// Real instant for a wall-clock (y, mo[1-12], da, hh, mi, ss) interpreted in `zone`.
// Falls back to local time if `zone` is invalid. Refines once for DST boundaries.
function instantFromZonedWallClock(zone: string, y: number, mo: number, da: number, hh: number, mi: number, ss: number): number {
  const guess = Date.UTC(y, mo - 1, da, hh, mi, ss);
  try {
    const off1 = zoneOffsetMs(zone, guess);
    let instant = guess - off1;
    const off2 = zoneOffsetMs(zone, instant);
    if (off2 !== off1) instant = guess - off2;
    return instant;
  } catch {
    return new Date(y, mo - 1, da, hh, mi, ss).getTime();
  }
}
```

Replace the body of `parseICalDate` with the case-split version:

```ts
// "20260105T090000Z" (UTC) | "20260105T090000" (floating/local or TZID) | "20260105" (date)
function parseICalDate(value: string, params: Record<string, string>): { ms: number; dateOnly: boolean } | null {
  const v = value.trim();
  const m = v.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/);
  if (!m) return null;
  const [, y, mo, da, hh, mi, ss, z] = m;
  const dateOnly = hh === undefined || params["VALUE"] === "DATE";
  if (dateOnly) {
    return { ms: Date.UTC(Number(y), Number(mo) - 1, Number(da)), dateOnly: true };
  }
  const Y = Number(y), Mo = Number(mo), Da = Number(da);
  const H = Number(hh ?? "0"), Mi = Number(mi ?? "0"), S = Number(ss ?? "0");
  if (z === "Z") {
    return { ms: Date.UTC(Y, Mo - 1, Da, H, Mi, S), dateOnly: false };
  }
  const tzid = params["TZID"];
  if (tzid !== undefined && tzid !== "") {
    return { ms: instantFromZonedWallClock(tzid, Y, Mo, Da, H, Mi, S), dateOnly: false };
  }
  return { ms: new Date(Y, Mo - 1, Da, H, Mi, S).getTime(), dateOnly: false };
}
```

- [ ] **Step 4: Run to verify they pass**

Run: `pnpm --filter @retrorganizer/core test -- icsImport`
Expected: PASS — the new floating/TZID/fallback tests plus all existing ones (the `Z` timed test, all-day, and the export→import round-trip, which still uses the current UTC export via the unchanged `Z` path).

- [ ] **Step 5: Typecheck + commit**

Run: `pnpm --filter @retrorganizer/core typecheck` (expect clean).

```bash
git add packages/core/src/io/ics.ts packages/core/src/io/icsImport.test.ts
git commit -m "feat(core): ICS import honours TZID and floating date-times"
```

---

### Task 2: Export — floating local time for timed values

**Files:**
- Modify: `packages/core/src/io/ics.ts`
- Test: `packages/core/src/io/icsExport.test.ts`

**Interfaces:**
- Produces: `eventToVEvent` emits timed `DTSTART`/`DTEND`/`EXDATE` as floating local date-times (no `Z`). All-day (`VALUE=DATE`) and `DTSTAMP` unchanged.

- [ ] **Step 1: Update the export test for floating output**

In `packages/core/src/io/icsExport.test.ts`:

Change the timed fixture base so its start is a LOCAL wall-clock instant (makes floating output deterministic on any runner). Replace the `START` constant:

```ts
const START = new Date(2026, 0, 5, 9, 0, 0).getTime(); // local 09:00
```

Update the "emits a timed VEVENT" assertions to floating (no `Z`):

```ts
    expect(v).toContain("DTSTART:20260105T090000");
    expect(v).toContain("DTEND:20260105T100000");
    expect(v).not.toContain("DTSTART:20260105T090000Z");
```

Update the RRULE/EXDATE test's EXDATE assertion to floating:

```ts
    expect(v).toContain("EXDATE:20260106T090000");
```

(The all-day test stays as-is — `DTSTART;VALUE=DATE:20260105` / `DTEND;VALUE=DATE:20260106` — it uses `Date.UTC` dates and the export keeps `icalDate` UTC-based.)

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @retrorganizer/core test -- icsExport`
Expected: FAIL — export still appends `Z` to timed values.

- [ ] **Step 3: Implement in `packages/core/src/io/ics.ts`**

Add a floating serializer next to `icalUtc` (local getters, no `Z`):

```ts
export function icalFloating(ms: number): string {
  const d = new Date(ms);
  return (
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
    `T${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  );
}
```

In `eventToVEvent`, change the timed branch and EXDATE to use `icalFloating` (leave `DTSTAMP` as `icalUtc`, and the all-day branch as `icalDate`):

```ts
  } else {
    lines.push(`DTSTART:${icalFloating(e.start)}`);
    lines.push(`DTEND:${icalFloating(e.end)}`);
  }
```

and

```ts
  if (e.recurrenceExceptions.length > 0) {
    lines.push(`EXDATE:${e.recurrenceExceptions.map(icalFloating).join(",")}`);
  }
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter @retrorganizer/core test -- icsExport`
Expected: PASS.

- [ ] **Step 5: Run the import test too (the round-trip now exercises floating both ways)**

Run: `pnpm --filter @retrorganizer/core test -- icsImport`
Expected: PASS — the export→import round-trip test still asserts the round-tripped instant equals `START`; floating export + floating-as-local import (Task 1) are inverse operations, so it holds in any runner timezone.

- [ ] **Step 6: Typecheck + commit**

Run: `pnpm --filter @retrorganizer/core typecheck` (expect clean).

```bash
git add packages/core/src/io/ics.ts packages/core/src/io/icsExport.test.ts
git commit -m "feat(core): ICS export emits floating local times (DST-correct recurrences)"
```

---

## Final verification (whole branch)

- [ ] Full suite under the emulator (Java on PATH): `pnpm exec firebase emulators:exec --only auth,firestore "pnpm test"` — expect core green (incl. new ICS tests) and web unchanged.
- [ ] `pnpm --filter @retrorganizer/web build` succeeds.
- [ ] Reason through interop in the final review: a weekly 09:00 event now exports `DTSTART:…T090000` (floating) + `RRULE`, so Google/Apple Calendar expand it at 09:00 local every week with no DST drift; an imported `DTSTART;TZID=Europe/Paris:…` lands at the correct instant; same-app/same-zone round-trips are preserved (instant-stable).
