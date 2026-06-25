import { describe, it, expect } from "vitest";
import { expandEvent, expandEvents } from "./recurrence";
import { parseEvent, type Event } from "./event";

// 2026-01-05 09:00 UTC for 1h
const START = Date.UTC(2026, 0, 5, 9, 0, 0);
const HOUR = 3600_000;

function mk(extra: Partial<Event> = {}): Event {
  return parseEvent({
    id: "e1", ownerId: "u1", createdAt: 1, updatedAt: 1, deletedAt: null,
    title: "Standup", start: START, end: START + HOUR, ...extra,
  });
}

describe("expandEvent", () => {
  it("returns a single occurrence for a non-recurring event in range", () => {
    const occ = expandEvent(mk(), START - HOUR, START + HOUR);
    expect(occ).toHaveLength(1);
    expect(occ[0]!.start).toBe(START);
    expect(occ[0]!.end).toBe(START + HOUR);
  });

  it("returns nothing when a non-recurring event is outside the range", () => {
    expect(expandEvent(mk(), START + 10 * HOUR, START + 20 * HOUR)).toEqual([]);
  });

  it("expands a daily rule into one occurrence per day within range", () => {
    const e = mk({ recurrence: "FREQ=DAILY" });
    const occ = expandEvent(e, START, START + 3 * 24 * HOUR); // 4 days inclusive
    expect(occ.map((o) => o.start)).toEqual([
      START, START + 24 * HOUR, START + 2 * 24 * HOUR, START + 3 * 24 * HOUR,
    ]);
    expect(occ.every((o) => o.end - o.start === HOUR)).toBe(true);
  });

  it("skips occurrences listed in recurrenceExceptions", () => {
    const skip = START + 24 * HOUR;
    const e = mk({ recurrence: "FREQ=DAILY", recurrenceExceptions: [skip] });
    const occ = expandEvent(e, START, START + 2 * 24 * HOUR);
    expect(occ.map((o) => o.start)).toEqual([START, START + 2 * 24 * HOUR]);
  });
});

describe("expandEvents", () => {
  it("flattens and sorts occurrences by start", () => {
    const a = mk({ start: START + HOUR, end: START + 2 * HOUR });
    const b = mk({ start: START, end: START + HOUR });
    const occ = expandEvents([a, b], START - HOUR, START + 3 * HOUR);
    expect(occ.map((o) => o.start)).toEqual([START, START + HOUR]);
  });
});
