import { describe, it, expect } from "vitest";
import { filterTasks, sortTasks } from "./taskQuery";
import { parseTask, type Task } from "./task";

function mk(id: string, extra: Partial<Task> = {}): Task {
  return parseTask({ id, ownerId: "u1", createdAt: 1, updatedAt: 1, deletedAt: null, title: id, ...extra });
}

describe("filterTasks", () => {
  const tasks = [
    mk("a", { status: "todo", title: "Acheter pain" }),
    mk("b", { status: "done", title: "Payer facture" }),
  ];
  it("returns all for status 'all'", () => {
    expect(filterTasks(tasks, { status: "all" }).map((t) => t.id)).toEqual(["a", "b"]);
  });
  it("filters by status", () => {
    expect(filterTasks(tasks, { status: "done" }).map((t) => t.id)).toEqual(["b"]);
  });
  it("filters by search over title/description", () => {
    expect(filterTasks(tasks, { search: "pain" }).map((t) => t.id)).toEqual(["a"]);
  });
});

describe("sortTasks", () => {
  it("sorts by priority high first without mutating input", () => {
    const tasks = [mk("a", { priority: "low" }), mk("b", { priority: "high" }), mk("c", { priority: "normal" })];
    const sorted = sortTasks(tasks, "priority");
    expect(sorted.map((t) => t.id)).toEqual(["b", "c", "a"]);
    expect(tasks.map((t) => t.id)).toEqual(["a", "b", "c"]);
  });
  it("sorts by dueDate ascending with nulls last", () => {
    const tasks = [mk("a", { dueDate: null }), mk("b", { dueDate: 200 }), mk("c", { dueDate: 100 })];
    expect(sortTasks(tasks, "dueDate").map((t) => t.id)).toEqual(["c", "b", "a"]);
  });
});
