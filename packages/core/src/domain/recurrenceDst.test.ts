import { describe, it, expect } from "vitest";
import { expandEvent, nextOccurrenceAfter } from "./recurrence";
import { parseEvent, type Event } from "./event";

// NOTE: this test is meaningful in a DST timezone (the dev machine, e.g. Europe/Paris):
// the OLD UTC-anchored code drifts an hour across the spring/autumn transition and FAILS;
// the floating-local fix keeps the local wall-clock and PASSES. In a UTC runner there is
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
