import { describe, it, expect } from "vitest";
import { parseTask, emptyTaskDraft, draftFromTask } from "./task";

describe("parseTask", () => {
  it("accepts a minimal task and defaults fields", () => {
    const t = parseTask({
      id: "t1", ownerId: "u1", createdAt: 1, updatedAt: 1, deletedAt: null, title: "Acheter du pain",
    });
    expect(t.title).toBe("Acheter du pain");
    expect(t.priority).toBe("normal");
    expect(t.status).toBe("todo");
    expect(t.dueDate).toBeNull();
    expect(t.completedAt).toBeNull();
    expect(t.subtasks).toEqual([]);
    expect(t.eventId).toBeNull();
    expect(t.contactIds).toEqual([]);
  });

  it("rejects a task without a title", () => {
    expect(() => parseTask({
      id: "t1", ownerId: "u1", createdAt: 1, updatedAt: 1, deletedAt: null, title: "",
    })).toThrow();
  });

  it("rejects an invalid priority", () => {
    expect(() => parseTask({
      id: "t1", ownerId: "u1", createdAt: 1, updatedAt: 1, deletedAt: null, title: "X", priority: "urgent",
    })).toThrow();
  });
});

describe("task drafts", () => {
  it("emptyTaskDraft has neutral defaults", () => {
    const d = emptyTaskDraft();
    expect(d.title).toBe("");
    expect(d.priority).toBe("normal");
    expect(d.status).toBe("todo");
    expect(d.dueDate).toBeNull();
    expect(d.subtasks).toEqual([]);
  });

  it("draftFromTask deep-copies arrays", () => {
    const t = parseTask({
      id: "t1", ownerId: "u1", createdAt: 1, updatedAt: 1, deletedAt: null, title: "X",
      subtasks: [{ title: "a", done: false }], contactIds: ["c1"], tags: ["t1"],
    });
    const d = draftFromTask(t);
    d.subtasks.push({ title: "b", done: true });
    d.contactIds.push("c2");
    d.tags.push("t2");
    expect(t.subtasks).toEqual([{ title: "a", done: false }]);
    expect(t.contactIds).toEqual(["c1"]);
    expect(t.tags).toEqual(["t1"]);
  });
});
