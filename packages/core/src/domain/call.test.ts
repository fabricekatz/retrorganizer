import { describe, it, expect } from "vitest";
import { parseCall, emptyCallDraft, draftFromCall } from "./call";

const base = { id: "c1", ownerId: "u1", createdAt: 1, updatedAt: 1, deletedAt: null };

describe("parseCall", () => {
  it("accepts a minimal call and defaults fields", () => {
    const c = parseCall({ ...base, occurredAt: 1000 });
    expect(c.direction).toBe("outgoing");
    expect(c.durationMin).toBe(0);
    expect(c.contactId).toBeNull();
    expect(c.contactName).toBe("");
    expect(c.notes).toBe("");
  });
  it("rejects an invalid direction", () => {
    expect(() => parseCall({ ...base, occurredAt: 1, direction: "sideways" })).toThrow();
  });
});

describe("call drafts", () => {
  it("emptyCallDraft has neutral defaults", () => {
    expect(emptyCallDraft()).toEqual({
      contactId: null, contactName: "", phoneNumber: "", direction: "outgoing",
      occurredAt: 0, durationMin: 0, notes: "", categoryId: null, tags: [],
    });
  });
  it("draftFromCall deep-copies tags", () => {
    const c = parseCall({ ...base, occurredAt: 1, tags: ["a"] });
    const d = draftFromCall(c);
    d.tags.push("b");
    expect(c.tags).toEqual(["a"]);
  });
});
