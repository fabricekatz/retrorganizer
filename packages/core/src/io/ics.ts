import type { Event } from "../domain/event";
import { escapeValue } from "./vcardEscape";

const CRLF = "\r\n";

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function icalUtc(ms: number): string {
  const d = new Date(ms);
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

export function icalDate(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;
}

const DAY = 24 * 3600_000;

export function eventToVEvent(e: Event): string {
  const lines: string[] = ["BEGIN:VEVENT"];
  lines.push(`UID:${e.id}@retrorganizer`);
  lines.push(`DTSTAMP:${icalUtc(e.updatedAt)}`);
  if (e.allDay) {
    lines.push(`DTSTART;VALUE=DATE:${icalDate(e.start)}`);
    lines.push(`DTEND;VALUE=DATE:${icalDate(e.start + DAY)}`);
  } else {
    lines.push(`DTSTART:${icalUtc(e.start)}`);
    lines.push(`DTEND:${icalUtc(e.end)}`);
  }
  lines.push(`SUMMARY:${escapeValue(e.title)}`);
  if (e.location) lines.push(`LOCATION:${escapeValue(e.location)}`);
  if (e.notes) lines.push(`DESCRIPTION:${escapeValue(e.notes)}`);
  if (e.recurrence) lines.push(`RRULE:${e.recurrence}`);
  if (e.recurrenceExceptions.length > 0) {
    lines.push(`EXDATE:${e.recurrenceExceptions.map(icalUtc).join(",")}`);
  }
  lines.push("END:VEVENT");
  return lines.join(CRLF) + CRLF;
}

export function eventsToICS(events: Event[]): string {
  const head = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Retrorganizer//FR//EN"].join(CRLF) + CRLF;
  const body = events.map(eventToVEvent).join("");
  return head + body + "END:VCALENDAR" + CRLF;
}
