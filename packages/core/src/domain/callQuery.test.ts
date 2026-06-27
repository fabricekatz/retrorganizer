import { describe, it, expect } from "vitest";
import { filterCalls, sortCalls } from "./callQuery";
import { parseCall } from "./call";

const mk = (id: string, name: string, occurredAt: number, phone = "", notes = "") =>
  parseCall({ id, ownerId: "u1", createdAt: 1, updatedAt: 1, deletedAt: null, contactName: name, phoneNumber: phone, occurredAt, notes });

describe("callQuery", () => {
  const cs = [mk("1", "Ada", 1000, "+33 1", "rappeler"), mk("2", "Grace", 3000, "+1 555")];
  it("filters by name, phone, or notes", () => {
    expect(filterCalls(cs, "ada").map((c) => c.id)).toEqual(["1"]);
    expect(filterCalls(cs, "555").map((c) => c.id)).toEqual(["2"]);
    expect(filterCalls(cs, "rappeler").map((c) => c.id)).toEqual(["1"]);
  });
  it("sorts most-recent first", () => {
    expect(sortCalls(cs).map((c) => c.id)).toEqual(["2", "1"]);
  });
});
