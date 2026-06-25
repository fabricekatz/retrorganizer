import { rrulestr } from "rrule";
import type { Event } from "./event";

export interface Occurrence {
  event: Event;
  start: number;
  end: number;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

// UTC instant -> iCal UTC datetime (yyyymmddThhmmssZ) for DTSTART
function toICalUtc(ms: number): string {
  const d = new Date(ms);
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

export function expandEvent(e: Event, rangeStart: number, rangeEnd: number): Occurrence[] {
  const duration = e.end - e.start;
  if (!e.recurrence) {
    if (e.start <= rangeEnd && e.end >= rangeStart) {
      return [{ event: e, start: e.start, end: e.end }];
    }
    return [];
  }
  const rule = rrulestr(`DTSTART:${toICalUtc(e.start)}\nRRULE:${e.recurrence}`);
  const exceptions = new Set(e.recurrenceExceptions);
  return rule
    .between(new Date(rangeStart), new Date(rangeEnd), true)
    .map((d) => d.getTime())
    .filter((ms) => !exceptions.has(ms))
    .map((ms) => ({ event: e, start: ms, end: ms + duration }));
}

export function expandEvents(events: Event[], rangeStart: number, rangeEnd: number): Occurrence[] {
  return events
    .flatMap((e) => expandEvent(e, rangeStart, rangeEnd))
    .sort((a, b) => a.start - b.start);
}
