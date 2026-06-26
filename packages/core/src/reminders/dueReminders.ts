import { expandEvents } from "../domain/recurrence";
import type { Event } from "../domain/event";
import type { Task } from "../domain/task";

const REMINDER_HORIZON_MS = 1440 * 60000; // 1 day — covers the largest reminder offset

export interface ReminderHit {
  type: "event" | "task";
  entityId: string;
  title: string;
  fireAt: number;
  occurrenceStart: number;
}

export function reminderKey(h: ReminderHit): string {
  return `${h.entityId}:${h.occurrenceStart}:${h.fireAt}`;
}

export function computeDueReminders(events: Event[], fromMs: number, toMs: number): ReminderHit[] {
  const occurrences = expandEvents(events, fromMs, toMs + REMINDER_HORIZON_MS);
  const hits: ReminderHit[] = [];
  for (const occ of occurrences) {
    for (const offset of occ.event.reminderOffsets) {
      const fireAt = occ.start - offset * 60000;
      if (fireAt > fromMs && fireAt <= toMs) {
        hits.push({ type: "event", entityId: occ.event.id, title: occ.event.title, fireAt, occurrenceStart: occ.start });
      }
    }
  }
  return hits.sort((a, b) => a.fireAt - b.fireAt);
}

export function computeDueTaskReminders(tasks: Task[], fromMs: number, toMs: number): ReminderHit[] {
  const hits: ReminderHit[] = [];
  for (const t of tasks) {
    if (t.dueDate === null || t.status === "done") continue;
    for (const offset of t.reminderOffsets) {
      const fireAt = t.dueDate - offset * 60000;
      if (fireAt > fromMs && fireAt <= toMs) {
        hits.push({ type: "task", entityId: t.id, title: t.title, fireAt, occurrenceStart: t.dueDate });
      }
    }
  }
  return hits.sort((a, b) => a.fireAt - b.fireAt);
}
