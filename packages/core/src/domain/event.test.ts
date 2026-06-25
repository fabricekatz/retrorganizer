import { describe, it, expect } from "vitest";
import { parseEvent, emptyEventDraft, draftFromEvent } from "./event";

describe("parseEvent", () => {
  it("accepts a valid event and defaults optional fields", () => {
    const e = parseEvent({
      id: "e1", ownerId: "u1", createdAt: 1, updatedAt: 1, deletedAt: null,
      title: "Réunion", start: 1000, end: 2000,
    });
    expect(e.title).toBe("Réunion");
    expect(e.allDay).toBe(false);
    expect(e.recurrence).toBeNull();
    expect(e.recurrenceExceptions).toEqual([]);
    expect(e.contactIds).toEqual([]);
    expect(e.color).toBe("");
  });

  it("rejects an event whose end is before its start", () => {
    expect(() => parseEvent({
      id: "e1", ownerId: "u1", createdAt: 1, updatedAt: 1, deletedAt: null,
      title: "Bad", start: 5000, end: 2000,
    })).toThrow();
  });

  it("rejects an event without a title", () => {
    expect(() => parseEvent({
      id: "e1", ownerId: "u1", createdAt: 1, updatedAt: 1, deletedAt: null,
      title: "", start: 1000, end: 2000,
    })).toThrow();
  });
});

describe("event drafts", () => {
  it("emptyEventDraft has neutral defaults", () => {
    const d = emptyEventDraft();
    expect(d.title).toBe("");
    expect(d.allDay).toBe(false);
    expect(d.recurrence).toBeNull();
    expect(d.contactIds).toEqual([]);
    expect(d.start).toBe(0);
    expect(d.end).toBe(0);
    expect(d.categoryId).toBeNull();
  });

  it("draftFromEvent deep-copies arrays", () => {
    const e = parseEvent({
      id: "e1", ownerId: "u1", createdAt: 1, updatedAt: 1, deletedAt: null,
      title: "X", start: 1000, end: 2000, contactIds: ["c1"], tags: ["t1"],
    });
    const d = draftFromEvent(e);
    d.contactIds.push("c2");
    d.tags.push("t2");
    expect(e.contactIds).toEqual(["c1"]);
    expect(e.tags).toEqual(["t1"]);
  });
});
