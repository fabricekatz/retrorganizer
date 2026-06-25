import type { Task, TaskStatus, TaskPriority } from "./task";

const PRIORITY_RANK: Record<TaskPriority, number> = { high: 0, normal: 1, low: 2 };

export function filterTasks(tasks: Task[], opts: { status?: TaskStatus | "all"; search?: string }): Task[] {
  const needle = (opts.search ?? "").trim().toLowerCase();
  return tasks.filter((t) => {
    if (opts.status && opts.status !== "all" && t.status !== opts.status) return false;
    if (needle !== "") {
      const hay = `${t.title} ${t.description}`.toLowerCase();
      if (!hay.includes(needle)) return false;
    }
    return true;
  });
}

export function sortTasks(tasks: Task[], key: "priority" | "dueDate" | "title"): Task[] {
  const copy = [...tasks];
  copy.sort((a, b) => {
    if (key === "priority") return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    if (key === "dueDate") {
      if (a.dueDate === b.dueDate) return 0;
      if (a.dueDate === null) return 1;
      if (b.dueDate === null) return -1;
      return a.dueDate - b.dueDate;
    }
    return a.title.localeCompare(b.title, undefined, { sensitivity: "base" });
  });
  return copy;
}
