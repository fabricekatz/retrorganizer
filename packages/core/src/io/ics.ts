import type { Event } from "../domain/event";
import type { EventDraft } from "../domain/event";
import { emptyEventDraft } from "../domain/event";
import { escapeValue, unfoldLines, unescapeValue } from "./vcardEscape";

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

export function icalFloating(ms: number): string {
  const d = new Date(ms);
  return (
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
    `T${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
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
    lines.push(`DTSTART:${icalFloating(e.start)}`);
    lines.push(`DTEND:${icalFloating(e.end)}`);
  }
  lines.push(`SUMMARY:${escapeValue(e.title)}`);
  if (e.location) lines.push(`LOCATION:${escapeValue(e.location)}`);
  if (e.notes) lines.push(`DESCRIPTION:${escapeValue(e.notes)}`);
  if (e.recurrence) lines.push(`RRULE:${e.recurrence}`);
  if (e.recurrenceExceptions.length > 0) {
    lines.push(`EXDATE:${e.recurrenceExceptions.map(icalFloating).join(",")}`);
  }
  lines.push("END:VEVENT");
  return lines.join(CRLF) + CRLF;
}

export function eventsToICS(events: Event[]): string {
  const head = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Retrorganizer//FR//EN"].join(CRLF) + CRLF;
  const body = events.map(eventToVEvent).join("");
  return head + body + "END:VCALENDAR" + CRLF;
}

interface ICalLine { name: string; params: Record<string, string>; value: string; }

function parseICalLine(line: string): ICalLine | null {
  const colon = line.indexOf(":");
  if (colon === -1) return null;
  const head = line.slice(0, colon);
  const value = line.slice(colon + 1);
  const segs = head.split(";");
  const name = (segs[0] ?? "").toUpperCase();
  const params: Record<string, string> = {};
  for (let i = 1; i < segs.length; i++) {
    const seg = segs[i] ?? "";
    const eq = seg.indexOf("=");
    if (eq !== -1) params[seg.slice(0, eq).toUpperCase()] = seg.slice(eq + 1);
  }
  return { name, params, value };
}

// Offset (ms) of an IANA zone at a given instant: (zone wall-clock shown for utcMs) - utcMs.
function zoneOffsetMs(zone: string, utcMs: number): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: zone, hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const parts: Record<string, string> = {};
  for (const p of dtf.formatToParts(new Date(utcMs))) parts[p.type] = p.value;
  const asUTC = Date.UTC(
    Number(parts["year"]), Number(parts["month"]) - 1, Number(parts["day"]),
    Number(parts["hour"]), Number(parts["minute"]), Number(parts["second"]),
  );
  return asUTC - utcMs;
}

// Real instant for a wall-clock (y, mo[1-12], da, hh, mi, ss) interpreted in `zone`.
// Falls back to local time if `zone` is invalid. Refines once for DST boundaries.
function instantFromZonedWallClock(zone: string, y: number, mo: number, da: number, hh: number, mi: number, ss: number): number {
  const guess = Date.UTC(y, mo - 1, da, hh, mi, ss);
  try {
    const off1 = zoneOffsetMs(zone, guess);
    let instant = guess - off1;
    const off2 = zoneOffsetMs(zone, instant);
    if (off2 !== off1) instant = guess - off2;
    return instant;
  } catch {
    return new Date(y, mo - 1, da, hh, mi, ss).getTime();
  }
}

// "20260105T090000Z" (UTC) | "20260105T090000" (floating/local or TZID) | "20260105" (date)
function parseICalDate(value: string, params: Record<string, string>): { ms: number; dateOnly: boolean } | null {
  const v = value.trim();
  const m = v.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/);
  if (!m) return null;
  const [, y, mo, da, hh, mi, ss, z] = m;
  const dateOnly = hh === undefined || params["VALUE"] === "DATE";
  if (dateOnly) {
    return { ms: Date.UTC(Number(y), Number(mo) - 1, Number(da)), dateOnly: true };
  }
  const Y = Number(y), Mo = Number(mo), Da = Number(da);
  const H = Number(hh ?? "0"), Mi = Number(mi ?? "0"), S = Number(ss ?? "0");
  if (z === "Z") {
    return { ms: Date.UTC(Y, Mo - 1, Da, H, Mi, S), dateOnly: false };
  }
  const tzid = params["TZID"];
  if (tzid !== undefined && tzid !== "") {
    return { ms: instantFromZonedWallClock(tzid, Y, Mo, Da, H, Mi, S), dateOnly: false };
  }
  return { ms: new Date(Y, Mo - 1, Da, H, Mi, S).getTime(), dateOnly: false };
}

export function icsToEventDrafts(text: string): EventDraft[] {
  const drafts: EventDraft[] = [];
  let cur: EventDraft | null = null;
  let hasStart = false;
  let explicitEnd = false;
  for (const raw of unfoldLines(text)) {
    const line = raw.trim();
    if (line === "") continue;
    const upper = line.toUpperCase();
    if (upper === "BEGIN:VEVENT") { cur = emptyEventDraft(); hasStart = false; explicitEnd = false; continue; }
    if (upper === "END:VEVENT") {
      if (cur && hasStart) {
        if (!explicitEnd) cur.end = cur.start; // zero-length fallback
        drafts.push(cur);
      }
      cur = null;
      continue;
    }
    if (!cur) continue;
    const p = parseICalLine(line);
    if (!p) continue;
    switch (p.name) {
      case "DTSTART": {
        const d = parseICalDate(p.value, p.params);
        if (d) { cur.start = d.ms; cur.allDay = d.dateOnly; hasStart = true; }
        break;
      }
      case "DTEND": {
        const d = parseICalDate(p.value, p.params);
        if (d) { cur.end = d.dateOnly ? d.ms - 1 : d.ms; explicitEnd = true; }
        break;
      }
      case "SUMMARY": cur.title = unescapeValue(p.value); break;
      case "LOCATION": cur.location = unescapeValue(p.value); break;
      case "DESCRIPTION": cur.notes = unescapeValue(p.value); break;
      case "RRULE": cur.recurrence = p.value.trim(); break;
      case "EXDATE": {
        for (const part of p.value.split(",")) {
          const d = parseICalDate(part, p.params);
          if (d) cur.recurrenceExceptions.push(d.ms);
        }
        break;
      }
      default: break;
    }
  }
  return drafts;
}
