import { describe, it, expect } from "vitest";
import { icsToEventDrafts, eventsToICS } from "./ics";
import { parseEvent, type Event } from "../domain/event";

const START = Date.UTC(2026, 0, 5, 9, 0, 0);
const HOUR = 3600_000;

describe("icsToEventDrafts", () => {
  it("parses a timed VEVENT", () => {
    const text = [
      "BEGIN:VCALENDAR", "VERSION:2.0",
      "BEGIN:VEVENT", "UID:e1@retrorganizer",
      "DTSTART:20260105T090000Z", "DTEND:20260105T100000Z",
      "SUMMARY:Réu\\; A", "LOCATION:Paris", "DESCRIPTION:notes",
      "RRULE:FREQ=DAILY", "EXDATE:20260106T090000Z",
      "END:VEVENT", "END:VCALENDAR",
    ].join("\r\n");
    const d = icsToEventDrafts(text)[0]!;
    expect(d.title).toBe("Réu; A");
    expect(d.start).toBe(START);
    expect(d.end).toBe(START + HOUR);
    expect(d.allDay).toBe(false);
    expect(d.location).toBe("Paris");
    expect(d.notes).toBe("notes");
    expect(d.recurrence).toBe("FREQ=DAILY");
    expect(d.recurrenceExceptions).toEqual([START + 24 * HOUR]);
  });

  it("parses an all-day VEVENT (VALUE=DATE)", () => {
    const text = [
      "BEGIN:VEVENT", "UID:x", "DTSTART;VALUE=DATE:20260105", "DTEND;VALUE=DATE:20260106",
      "SUMMARY:Congé", "END:VEVENT",
    ].join("\r\n");
    const d = icsToEventDrafts(text)[0]!;
    expect(d.allDay).toBe(true);
    expect(d.start).toBe(Date.UTC(2026, 0, 5));
    expect(d.title).toBe("Congé");
  });

  it("skips a VEVENT without DTSTART", () => {
    const text = ["BEGIN:VEVENT", "SUMMARY:Nope", "END:VEVENT"].join("\r\n");
    expect(icsToEventDrafts(text)).toEqual([]);
  });

  it("round-trips export -> import for a timed recurring event", () => {
    const e: Event = parseEvent({
      id: "e1", ownerId: "u1", createdAt: 10, updatedAt: 20, deletedAt: null,
      title: "Standup", start: START, end: START + HOUR,
      recurrence: "FREQ=WEEKLY;BYDAY=MO", recurrenceExceptions: [START + 7 * 24 * HOUR],
      location: "Salle 1", notes: "daily sync",
    });
    const d = icsToEventDrafts(eventsToICS([e]))[0]!;
    expect(d.title).toBe("Standup");
    expect(d.start).toBe(START);
    expect(d.recurrence).toBe("FREQ=WEEKLY;BYDAY=MO");
    expect(d.recurrenceExceptions).toEqual([START + 7 * 24 * HOUR]);
    expect(d.location).toBe("Salle 1");
  });
});
