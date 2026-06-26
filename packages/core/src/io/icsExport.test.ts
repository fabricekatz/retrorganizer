import { describe, it, expect } from "vitest";
import { eventToVEvent, eventsToICS } from "./ics";
import { parseEvent, type Event } from "../domain/event";

const START = new Date(2026, 0, 5, 9, 0, 0).getTime(); // local 09:00
const HOUR = 3600_000;

function mk(extra: Partial<Event> = {}): Event {
  return parseEvent({
    id: "e1", ownerId: "u1", createdAt: 10, updatedAt: 20, deletedAt: null,
    title: "Réu; A", start: START, end: START + HOUR, ...extra,
  });
}

describe("eventToVEvent", () => {
  it("emits a timed VEVENT with escaped summary", () => {
    const v = eventToVEvent(mk());
    expect(v).toContain("BEGIN:VEVENT");
    expect(v).toContain("UID:e1@retrorganizer");
    expect(v).toContain("DTSTART:20260105T090000");
    expect(v).toContain("DTEND:20260105T100000");
    expect(v).not.toContain("DTSTART:20260105T090000Z");
    expect(v).toContain("SUMMARY:Réu\\; A");
    expect(v.trim().endsWith("END:VEVENT")).toBe(true);
  });

  it("emits an all-day VEVENT with VALUE=DATE and next-day DTEND", () => {
    const v = eventToVEvent(mk({ allDay: true, start: Date.UTC(2026, 0, 5), end: Date.UTC(2026, 0, 5, 23, 59) }));
    expect(v).toContain("DTSTART;VALUE=DATE:20260105");
    expect(v).toContain("DTEND;VALUE=DATE:20260106");
  });

  it("includes RRULE and EXDATE when present", () => {
    const v = eventToVEvent(mk({ recurrence: "FREQ=DAILY", recurrenceExceptions: [START + 24 * HOUR] }));
    expect(v).toContain("RRULE:FREQ=DAILY");
    expect(v).toContain("EXDATE:20260106T090000");
  });

  it("omits LOCATION/DESCRIPTION when empty", () => {
    const v = eventToVEvent(mk());
    expect(v).not.toContain("LOCATION:");
    expect(v).not.toContain("DESCRIPTION:");
  });
});

describe("eventsToICS", () => {
  it("wraps blocks in a VCALENDAR", () => {
    const ics = eventsToICS([mk()]);
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("VERSION:2.0");
    expect(ics.trim().endsWith("END:VCALENDAR")).toBe(true);
  });
});
