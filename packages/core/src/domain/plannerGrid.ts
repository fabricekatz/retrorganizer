import { expandEvents } from "./recurrence";
import type { Event } from "./event";
import type { Task } from "./task";

export interface MonthBucket {
  month: number; // 0-11
  eventCount: number;
  taskCount: number;
}

/** Per-month counts of event occurrences and open (non-done, dated) tasks for `year`. */
export function yearMonthBuckets(year: number, events: Event[], tasks: Task[]): MonthBucket[] {
  const start = new Date(year, 0, 1).getTime();
  const end = new Date(year + 1, 0, 1).getTime();
  const buckets: MonthBucket[] = Array.from({ length: 12 }, (_, month) => ({ month, eventCount: 0, taskCount: 0 }));

  for (const occ of expandEvents(events, start, end)) {
    buckets[new Date(occ.start).getMonth()]!.eventCount++;
  }
  for (const t of tasks) {
    if (t.dueDate === null || t.status === "done") continue;
    const d = new Date(t.dueDate);
    if (d.getFullYear() === year) buckets[d.getMonth()]!.taskCount++;
  }
  return buckets;
}
