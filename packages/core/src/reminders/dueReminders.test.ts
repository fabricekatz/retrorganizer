import { describe, it, expect } from "vitest";
import { computeDueReminders, reminderKey } from "./dueReminders";
import { parseEvent, type Event } from "../domain/event";

const T = Date.UTC(2026, 0, 5, 9, 0, 0); // event start
const MIN = 60000;
const base = { ownerId: "u1", createdAt: 1, updatedAt: 1, deletedAt: null };

function mk(extra: Partial<Event> = {}): Event {
  return parseEvent({ id: "e1", ...base, title: "Réunion", start: T, end: T + 3600000, ...extra });
}

describe("computeDueReminders", () => {
  it("fires a reminder offset minutes before the start, inside the window", () => {
    const e = mk({ reminderOffsets: [10] }); // fireAt = T - 10min
    const hits = computeDueReminders([e], T - 10 * MIN - 1, T - 10 * MIN);
    expect(hits).toHaveLength(1);
    expect(hits[0]!.fireAt).toBe(T - 10 * MIN);
    expect(hits[0]!.entityId).toBe("e1");
    expect(hits[0]!.occurrenceStart).toBe(T);
  });

  it("excludes a reminder whose fire time is at or before the window start", () => {
    const e = mk({ reminderOffsets: [10] });
    expect(computeDueReminders([e], T - 10 * MIN, T)).toEqual([]); // fireAt == fromMs → excluded
  });

  it("returns nothing for an event with no reminder offsets", () => {
    expect(computeDueReminders([mk()], T - 60 * MIN, T)).toEqual([]);
  });

  it("emits a reminder for each daily recurrence in the window", () => {
    const e = mk({ recurrence: "FREQ=DAILY", reminderOffsets: [10] });
    // window spanning 3 daily reminders (day0..day2 fire times)
    const from = T - 10 * MIN - 1;
    const to = T - 10 * MIN + 2 * 24 * 60 * MIN;
    const hits = computeDueReminders([e], from, to);
    expect(hits.map((h) => h.occurrenceStart)).toEqual([T, T + 24 * 60 * MIN, T + 2 * 24 * 60 * MIN]);
  });

  it("reminderKey is stable and unique per occurrence+fire time", () => {
    const e = mk({ reminderOffsets: [10, 60] });
    const hits = computeDueReminders([e], T - 60 * MIN - 1, T - 10 * MIN);
    const keys = hits.map(reminderKey);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
