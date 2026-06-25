import { describe, it, expect } from "vitest";
import { contactToVCard } from "./vcard";
import type { Contact } from "../domain/contact";

const c: Contact = {
  id: "c1", ownerId: "u1", createdAt: 1, updatedAt: 1, deletedAt: null,
  firstName: "Ada", lastName: "Lovelace", displayName: "Ada Lovelace",
  organization: "Analytical Engines", title: "Mathematician",
  phones: [{ label: "mobile", value: "+33 1 23" }],
  emails: [{ label: "work", value: "ada@x.io" }],
  addresses: [{ label: "home", street: "1 Rue A", city: "Paris", postalCode: "75001", country: "France" }],
  webLinks: [{ label: "site", value: "https://ada.example" }],
  importantDates: [{ label: "naissance", date: "1815-12-10" }],
  notes: "Note; with, specials", customFields: [], categoryId: null, tags: ["vip", "math"],
};

describe("contactToVCard", () => {
  it("emits a 3.0 vCard with standard fields", () => {
    const v = contactToVCard(c);
    expect(v).toContain("BEGIN:VCARD");
    expect(v).toContain("VERSION:3.0");
    expect(v).toContain("N:Lovelace;Ada;;;");
    expect(v).toContain("FN:Ada Lovelace");
    expect(v).toContain("ORG:Analytical Engines");
    expect(v).toContain("TITLE:Mathematician");
    expect(v).toContain("TEL;TYPE=mobile:+33 1 23");
    expect(v).toContain("EMAIL;TYPE=work:ada@x.io");
    expect(v).toContain("ADR;TYPE=home:;;1 Rue A;Paris;;75001;France");
    expect(v).toContain("URL:https://ada.example");
    expect(v).toContain("BDAY:1815-12-10");
    expect(v).toContain("CATEGORIES:vip,math");
    expect(v).toContain("NOTE:Note\\; with\\, specials");
    expect(v.trim().endsWith("END:VCARD")).toBe(true);
  });

  it("omits empty fields", () => {
    const v = contactToVCard({ ...c, organization: undefined, title: undefined, tags: [], notes: undefined, importantDates: [] });
    expect(v).not.toContain("ORG:");
    expect(v).not.toContain("TITLE:");
    expect(v).not.toContain("CATEGORIES:");
    expect(v).not.toContain("BDAY:");
    expect(v).not.toContain("NOTE:");
  });
});
