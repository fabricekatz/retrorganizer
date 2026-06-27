import { describe, it, expect } from "vitest";
import { filterBookmarks, sortBookmarks } from "./bookmarkQuery";
import { parseBookmark } from "./bookmark";

const mk = (id: string, title: string, url: string, description = "") =>
  parseBookmark({ id, ownerId: "u1", createdAt: 1, updatedAt: 1, deletedAt: null, title, url, description });

describe("bookmarkQuery", () => {
  const bs = [mk("1", "Zeta", "https://z.io", "search"), mk("2", "alpha", "https://a.io/docs")];
  it("filters by title, url, or description (case-insensitive)", () => {
    expect(filterBookmarks(bs, "ALPHA").map((b) => b.id)).toEqual(["2"]);
    expect(filterBookmarks(bs, "z.io").map((b) => b.id)).toEqual(["1"]);
    expect(filterBookmarks(bs, "search").map((b) => b.id)).toEqual(["1"]);
    expect(filterBookmarks(bs, "").map((b) => b.id)).toEqual(["1", "2"]);
  });
  it("sorts by title case-insensitively", () => {
    expect(sortBookmarks(bs).map((b) => b.title)).toEqual(["alpha", "Zeta"]);
  });
});
