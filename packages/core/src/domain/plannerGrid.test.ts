import { describe, it, expect } from "vitest";
import { yearMonthBuckets } from "./plannerGrid";
import { parseEvent } from "./event";
import { parseTask } from "./task";

function ev(start: number) {
  // a 1-hour, non-recurring event at `start`
  return parseEvent({
    id: `e${start}`, ownerId: "u1", createdAt: 1, updatedAt: 1, deletedAt: null,
    title: "X", start, end: start + 3600000, allDay: false,
  });
}
function task(dueDate: number | null, status = "todo") {
  return parseTask({
    id: `t${dueDate}-${status}`, ownerId: "u1", createdAt: 1, updatedAt: 1, deletedAt: null,
    title: "T", dueDate, status,
  });
}

describe("yearMonthBuckets", () => {
  it("returns 12 zeroed buckets for no data", () => {
    const b = yearMonthBuckets(2026, [], []);
    expect(b).toHaveLength(12);
    expect(b.every((x) => x.eventCount === 0 && x.taskCount === 0)).toBe(true);
    expect(b[0]!.month).toBe(0);
    expect(b[11]!.month).toBe(11);
  });

  it("counts events into their month and ignores other years", () => {
    const jan = new Date(2026, 0, 15, 9).getTime();
    const mar = new Date(2026, 2, 3, 9).getTime();
    const otherYear = new Date(2027, 0, 1, 9).getTime();
    const b = yearMonthBuckets(2026, [ev(jan), ev(mar), ev(otherYear)], []);
    expect(b[0]!.eventCount).toBe(1);
    expect(b[2]!.eventCount).toBe(1);
    expect(b.reduce((n, x) => n + x.eventCount, 0)).toBe(2);
  });

  it("counts open tasks by due-month, skipping done and undated", () => {
    const feb = new Date(2026, 1, 10).getTime();
    const b = yearMonthBuckets(2026, [], [task(feb), task(feb, "done"), task(null)]);
    expect(b[1]!.taskCount).toBe(1);
    expect(b.reduce((n, x) => n + x.taskCount, 0)).toBe(1);
  });
});
