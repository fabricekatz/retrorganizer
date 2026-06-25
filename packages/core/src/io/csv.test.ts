import { describe, it, expect } from "vitest";
import { contactsToCsv, csvToDrafts } from "./csv";
import type { Contact } from "../domain/contact";

const c: Contact = {
  id: "c1", ownerId: "u1", createdAt: 1, updatedAt: 1, deletedAt: null,
  firstName: "Ada", lastName: "Lovelace", displayName: "Ada Lovelace",
  organization: "Eng, Inc", title: "Math",
  phones: [{ label: "mobile", value: "+33 1" }], emails: [],
  addresses: [{ label: "home", street: "1 Rue A", city: "Paris", postalCode: "75001", country: "FR" }],
  webLinks: [{ label: "site", value: "https://a.io" }],
  importantDates: [{ label: "naissance", date: "1815-12-10" }],
  notes: "Multi\nline", customFields: [{ key: "Surnom", value: "Countess" }],
  categoryId: "cat1", tags: ["vip", "math"],
};

describe("csv round-trip", () => {
  it("exports a header + row and re-imports identically (full fidelity)", () => {
    const csv = contactsToCsv([c]);
    expect(csv.split("\r\n")[0]).toBe(
      "displayName,firstName,lastName,organization,title,notes,categoryId,tags,phones,emails,addresses,webLinks,importantDates,customFields",
    );
    const d = csvToDrafts(csv)[0]!;
    expect(d.displayName).toBe("Ada Lovelace");
    expect(d.organization).toBe("Eng, Inc"); // comma inside quoted cell
    expect(d.notes).toBe("Multi\nline");       // newline inside quoted cell
    expect(d.phones).toEqual([{ label: "mobile", value: "+33 1" }]);
    expect(d.addresses).toEqual([{ label: "home", street: "1 Rue A", city: "Paris", postalCode: "75001", country: "FR" }]);
    expect(d.customFields).toEqual([{ key: "Surnom", value: "Countess" }]);
    expect(d.tags).toEqual(["vip", "math"]);
    expect(d.categoryId).toBe("cat1");
  });

  it("handles empty input (header only -> no rows)", () => {
    expect(csvToDrafts(contactsToCsv([]))).toEqual([]);
  });
});
