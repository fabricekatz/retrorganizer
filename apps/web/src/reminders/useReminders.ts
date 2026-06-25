import { useCallback, useEffect, useRef, useState } from "react";
import { computeDueReminders, reminderKey, type ReminderHit } from "@retrorganizer/core";
import { useEvents } from "../calendar/useEvents";

const TICK_MS = 60 * 1000;

export interface UseReminders {
  due: ReminderHit[];
  dismiss(key: string): void;
}

export function useReminders(): UseReminders {
  const { events } = useEvents();
  const eventsRef = useRef(events);
  eventsRef.current = events;
  const lastCheck = useRef<number>(Date.now());
  const [due, setDue] = useState<ReminderHit[]>([]);

  useEffect(() => {
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      void Notification.requestPermission();
    }
    const interval = setInterval(() => {
      const now = Date.now();
      const hits = computeDueReminders(eventsRef.current, lastCheck.current, now);
      lastCheck.current = now;
      if (hits.length === 0) return;
      setDue((prev) => [...prev, ...hits]);
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        for (const h of hits) {
          new Notification(h.title, { body: "Rappel d'événement" });
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
