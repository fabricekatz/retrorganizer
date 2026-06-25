import { describe, it, expect } from "vitest";
import { parseContact } from "./contact";

describe("parseContact", () => {
  it("accepts a minimal valid contact and defaults arrays", () => {
    const c = parseContact({
      id: "c1",
      ownerId: "u1",
      createdAt: 1,
      updatedAt: 1,
      deletedAt: null,
      firstName: "Ada",
      lastName: "Lovelace",
      displayName: "Ada Lovelace",
    });
    expect(c.displayName).toBe("Ada Lovelace");
    expect(c.phones).toEqual([]);
    expect(c.tags).toEqual([]);
    expect(c.categoryId).toBeNull();
  });

  it("rejects a contact without ownerId", () => {
    expect(() =>
      parseContact({ id: "c1", displayName: "X" }),
    ).toThrow();
  });
});
