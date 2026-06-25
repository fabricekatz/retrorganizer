import { describe, it, expect } from "vitest";
import { nextOccurrenceAfter } from "./recurrence";

const DUE = Date.UTC(2026, 0, 5, 9, 0, 0);
const DAY = 24 * 3600_000;

describe("nextOccurrenceAfter", () => {
  it("advances a daily rule by one day", () => {
    expect(nextOccurrenceAfter("FREQ=DAILY", DUE)).toBe(DUE + DAY);
  });
  it("advances a weekly rule by seven days", () => {
    expect(nextOccurrenceAfter("FREQ=WEEKLY", DUE)).toBe(DUE + 7 * DAY);
  });
  it("returns null when the rule has no future occurrence (COUNT=1)", () => {
    expect(nextOccurrenceAfter("FREQ=DAILY;COUNT=1", DUE)).toBeNull();
  });
});
