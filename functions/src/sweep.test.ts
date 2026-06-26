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
