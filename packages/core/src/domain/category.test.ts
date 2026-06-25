import { describe, it, expect } from "vitest";
import { parseCategory, emptyCategoryDraft, categoryById } from "./category";

const base = { ownerId: "u1", createdAt: 1, updatedAt: 1, deletedAt: null };

describe("parseCategory", () => {
  it("accepts a category and defaults the color", () => {
    const c = parseCategory({ id: "cat1", ...base, name: "Travail" });
    expect(c.name).toBe("Travail");
    expect(c.color).toBe("#7a766a");
  });
  it("keeps a provided color", () => {
    const c = parseCategory({ id: "cat1", ...base, name: "Perso", color: "#ff0000" });
    expect(c.color).toBe("#ff0000");
  });
  it("rejects a category without a name", () => {
    expect(() => parseCategory({ id: "cat1", ...base, name: "" })).toThrow();
  });
});

describe("emptyCategoryDraft", () => {
  it("has an empty name and a default color", () => {
    const d = emptyCategoryDraft();
    expect(d.name).toBe("");
    expect(typeof d.color).toBe("string");
  });
});

describe("categoryById", () => {
  const cats = [parseCategory({ id: "cat1", ...base, name: "Travail" })];
  it("finds a category by id", () => {
    expect(categoryById(cats, "cat1")?.name).toBe("Travail");
  });
  it("returns undefined for null or unknown id", () => {
    expect(categoryById(cats, null)).toBeUndefined();
    expect(categoryById(cats, "nope")).toBeUndefined();
  });
});
