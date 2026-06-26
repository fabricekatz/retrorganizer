import { computeDueReminders, computeDueTaskReminders } from "../../packages/core/src/reminders/dueReminders";
import type { Event } from "../../packages/core/src/domain/event";
import type { Task } from "../../packages/core/src/domain/task";

export interface NotificationPayload {
  title: string;
  body: string;
}

export function dueNotifications(events: Event[], tasks: Task[], fromMs: number, toMs: number): NotificationPayload[] {
  const hits = [
    ...computeDueReminders(events, fromMs, toMs),
    ...computeDueTaskReminders(tasks, fromMs, toMs),
  ];
  return hits.map((h) => ({
    title: h.title,
    body: h.type === "task" ? "Rappel de tâche" : "Rappel d'événement",
  }));
}
