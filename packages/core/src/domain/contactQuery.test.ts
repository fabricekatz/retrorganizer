import { describe, it, expect } from "vitest";
import { filterContacts, sortContacts } from "./contactQuery";
import type { Contact } from "./contact";

function mk(id: string, displayName: string, org = "", extra: Partial<Contact> = {}): Contact {
  return {
    id, ownerId: "u1", createdAt: 1, updatedAt: 1, deletedAt: null,
    firstName: "", lastName: "", displayName, organization: org,
    phones: [], emails: [], addresses: [], webLinks: [], importantDates: [],
    customFields: [], categoryId: null, tags: [], ...extra,
  };
}

describe("filterContacts", () => {
  const cs = [
    mk("1", "Ada Lovelace", "Engines"),
    mk("2", "Grace Hopper", "Navy", { emails: [{ label: "w", value: "grace@navy.mil" }] }),
  ];
  it("returns all on empty query", () => {
    expect(filterContacts(cs, "  ").map((c) => c.id)).toEqual(["1", "2"]);
  });
  it("matches name case-insensitively", () => {
    expect(filterContacts(cs, "ada").map((c) => c.id)).toEqual(["1"]);
  });
  it("matches organization and email value", () => {
    expect(filterContacts(cs, "navy").map((c) => c.id)).toEqual(["2"]);
    expect(filterContacts(cs, "grace@navy").map((c) => c.id)).toEqual(["2"]);
  });
});

describe("sortContacts", () => {
  it("sorts by name without mutating input", () => {
    const cs = [mk("2", "Zoe"), mk("1", "Ada")];
    const sorted = sortContacts(cs, "name");
    expect(sorted.map((c) => c.displayName)).toEqual(["Ada", "Zoe"]);
    expect(cs.map((c) => c.id)).toEqual(["2", "1"]); // original untouched
  });
});
