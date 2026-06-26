import { useCallback, useEffect, useRef, useState } from "react";
import { computeDueReminders, computeDueTaskReminders, reminderKey, type ReminderHit } from "@retrorganizer/core";
import { useEvents } from "../calendar/useEvents";
import { useTasks } from "../tasks/useTasks";

const TICK_MS = 60 * 1000;

export interface UseReminders {
  due: ReminderHit[];
  dismiss(key: string): void;
}

export function useReminders(): UseReminders {
  const { events } = useEvents();
  const eventsRef = useRef(events);
  eventsRef.current = events;
  const { tasks } = useTasks();
  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;
  const lastCheck = useRef<number>(0);
  const [due, setDue] = useState<ReminderHit[]>([]);

  useEffect(() => {
    lastCheck.current = Date.now();
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      void Notification.requestPermission();
    }
    const interval = setInterval(() => {
      const now = Date.now();
      const hits = [
        ...computeDueReminders(eventsRef.current, lastCheck.current, now),
        ...computeDueTaskReminders(tasksRef.current, lastCheck.current, now),
      ];
      lastCheck.current = now;
      if (hits.length === 0) return;
      setDue((prev) => [...prev, ...hits]);
      const visible = typeof document === "undefined" || document.visibilityState === "visible";
      if (visible && typeof Notification !== "undefined" && Notification.permission === "granted") {
        for (const h of hits) {
          new Notification(h.title, { body: h.type === "task" ? "Rappel de tâche" : "Rappel d'événement" });
        }
      }
    }, TICK_MS);
    return () => clearInterval(interval);
  }, []);

  const dismiss = useCallback((key: string) => {
    setDue((prev) => prev.filter((h) => reminderKey(h) !== key));
  }, []);

  return { due, dismiss };
}
