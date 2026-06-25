import { describe, it, expect } from "vitest";
import { parseNote, parseNoteSection, emptyNoteDraft, draftFromNote, emptyDoc } from "./note";

describe("parseNoteSection", () => {
  it("accepts a section and defaults order", () => {
    const s = parseNoteSection({ id: "s1", ownerId: "u1", createdAt: 1, updatedAt: 1, deletedAt: null, name: "Travail" });
    expect(s.name).toBe("Travail");
    expect(s.order).toBe(0);
  });
  it("rejects a section without a name", () => {
    expect(() => parseNoteSection({ id: "s1", ownerId: "u1", createdAt: 1, updatedAt: 1, deletedAt: null, name: "" })).toThrow();
  });
});

describe("parseNote", () => {
  it("accepts a note and defaults body to an empty doc", () => {
    const n = parseNote({ id: "n1", ownerId: "u1", createdAt: 1, updatedAt: 1, deletedAt: null, sectionId: "s1" });
    expect(n.sectionId).toBe("s1");
    expect(n.title).toBe("");
    expect(n.body).toEqual({ type: "doc", content: [] });
    expect(n.linkedEntities).toEqual([]);
  });
  it("keeps a provided rich body", () => {
    const body = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Bonjour" }] }] };
    const n = parseNote({ id: "n1", ownerId: "u1", createdAt: 1, updatedAt: 1, deletedAt: null, sectionId: "s1", body });
    expect(n.body).toEqual(body);
  });
});

describe("note drafts", () => {
  it("emptyNoteDraft carries the section and a fresh empty doc", () => {
    const d = emptyNoteDraft("s1");
    expect(d.sectionId).toBe("s1");
    expect(d.body).toEqual({ type: "doc", content: [] });
    expect(emptyDoc()).not.toBe(emptyDoc()); // fresh object each call
  });
  it("draftFromNote deep-copies linkedEntities", () => {
    const n = parseNote({ id: "n1", ownerId: "u1", createdAt: 1, updatedAt: 1, deletedAt: null, sectionId: "s1", linkedEntities: [{ type: "contact", id: "c1" }] });
    const d = draftFromNote(n);
    d.linkedEntities.push({ type: "event", id: "e1" });
    expect(n.linkedEntities).toEqual([{ type: "contact", id: "c1" }]);
  });
});
