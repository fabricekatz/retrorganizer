import { describe, it, expect } from "vitest";
import { parseBookmark, emptyBookmarkDraft, draftFromBookmark } from "./bookmark";

const base = { id: "b1", ownerId: "u1", createdAt: 1, updatedAt: 1, deletedAt: null };

describe("parseBookmark", () => {
  it("accepts a minimal bookmark and defaults fields", () => {
    const b = parseBookmark({ ...base, title: "Anthropic", url: "https://anthropic.com" });
    expect(b.description).toBe("");
    expect(b.categoryId).toBeNull();
    expect(b.tags).toEqual([]);
  });
  it("rejects a bookmark without a title or url", () => {
    expect(() => parseBookmark({ ...base, title: "", url: "x" })).toThrow();
    expect(() => parseBookmark({ ...base, title: "x", url: "" })).toThrow();
  });
});

describe("bookmark drafts", () => {
  it("emptyBookmarkDraft has neutral defaults", () => {
    expect(emptyBookmarkDraft()).toEqual({ title: "", url: "", description: "", categoryId: null, tags: [] });
  });
  it("draftFromBookmark deep-copies tags", () => {
    const b = parseBookmark({ ...base, title: "X", url: "u", tags: ["a"] });
    const d = draftFromBookmark(b);
    d.tags.push("b");
    expect(b.tags).toEqual(["a"]);
  });
});
