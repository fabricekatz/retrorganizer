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

// Floating iCal datetime (no "Z") built from the LOCAL wall-clock of an instant.
function toICalFloating(ms: number): string {
  const d = new Date(ms);
  return (
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
    `T${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  );
}

// A Date whose UTC components equal the LOCAL components of `ms` — for passing floating bounds to rrule.
function toFloatingDate(ms: number): Date {
  const d = new Date(ms);
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds()));
}

// Inverse: interpret a floating Date's UTC components as LOCAL wall-clock → the real instant in ms.
function fromFloatingDate(d: Date): number {
  return new Date(
    d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(),
    d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds(),
  ).getTime();
}

export function expandEvent(e: Event, rangeStart: number, rangeEnd: number): Occurrence[] {
  const duration = e.end - e.start;
  if (!e.recurrence) {
    if (e.start <= rangeEnd && e.end >= rangeStart) {
      return [{ event: e, start: e.start, end: e.end }];
    }
    return [];
  }
  const rule = rrulestr(`DTSTART:${toICalFloating(e.start)}\nRRULE:${e.recurrence}`);
  const exceptions = new Set(e.recurrenceExceptions);
  return rule
    .between(toFloatingDate(rangeStart), toFloatingDate(rangeEnd), true)
    .map((d) => fromFloatingDate(d))
    .filter((ms) => !exceptions.has(ms))
    .map((ms) => ({ event: e, start: ms, end: ms + duration }));
}

export function expandEvents(events: Event[], rangeStart: number, rangeEnd: number): Occurrence[] {
  return events
    .flatMap((e) => expandEvent(e, rangeStart, rangeEnd))
    .sort((a, b) => a.start - b.start);
}

export function nextOccurrenceAfter(recurrence: string, afterMs: number): number | null {
  const rule = rrulestr(`DTSTART:${toICalFloating(afterMs)}\nRRULE:${recurrence}`);
  const next = rule.after(toFloatingDate(afterMs), false);
  return next ? fromFloatingDate(next) : null;
}
