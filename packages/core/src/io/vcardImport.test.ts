import { describe, it, expect } from "vitest";
import { vCardToDrafts, contactToVCard } from "./vcard";
import type { Contact } from "../domain/contact";

describe("vCardToDrafts", () => {
  it("parses a single 3.0 vCard", () => {
    const text = [
      "BEGIN:VCARD", "VERSION:3.0",
      "N:Lovelace;Ada;;;", "FN:Ada Lovelace",
      "ORG:Analytical Engines", "TITLE:Mathematician",
      "TEL;TYPE=mobile:+33 1 23", "EMAIL;TYPE=work:ada@x.io",
      "ADR;TYPE=home:;;1 Rue A;Paris;;75001;France",
      "URL:https://ada.example", "BDAY:1815-12-10",
      "CATEGORIES:vip,math", "NOTE:Note\\; with\\, specials", "END:VCARD",
    ].join("\r\n");
    const d = vCardToDrafts(text)[0]!;
    expect(d.firstName).toBe("Ada");
    expect(d.lastName).toBe("Lovelace");
    expect(d.displayName).toBe("Ada Lovelace");
    expect(d.organization).toBe("Analytical Engines");
    expect(d.phones).toEqual([{ label: "mobile", value: "+33 1 23" }]);
    expect(d.emails).toEqual([{ label: "work", value: "ada@x.io" }]);
    expect(d.addresses).toEqual([{ label: "home", street: "1 Rue A", city: "Paris", postalCode: "75001", country: "France" }]);
    expect(d.webLinks).toEqual([{ label: "site", value: "https://ada.example" }]);
    expect(d.importantDates).toEqual([{ label: "naissance", date: "1815-12-10" }]);
    expect(d.tags).toEqual(["vip", "math"]);
    expect(d.notes).toBe("Note; with, specials");
  });

  it("parses multiple cards", () => {
    const text = "BEGIN:VCARD\r\nVERSION:3.0\r\nFN:A\r\nEND:VCARD\r\nBEGIN:VCARD\r\nVERSION:4.0\r\nFN:B\r\nEND:VCARD\r\n";
    const drafts = vCardToDrafts(text);
    expect(drafts.map((d) => d.displayName)).toEqual(["A", "B"]);
  });

  it("round-trips export -> import for standard fields", () => {
    const c: Contact = {
      id: "c1", ownerId: "u1", createdAt: 1, updatedAt: 1, deletedAt: null,
      firstName: "Grace", lastName: "Hopper", displayName: "Grace Hopper",
      organization: "Navy", title: "Admiral",
      phones: [{ label: "work", value: "+1 555" }], emails: [{ label: "home", value: "g@x.io" }],
      addresses: [], webLinks: [], importantDates: [], notes: "", customFields: [],
      categoryId: null, tags: ["pioneer"],
    };
    const d = vCardToDrafts(contactToVCard(c))[0]!;
    expect(d.firstName).toBe("Grace");
    expect(d.phones).toEqual([{ label: "work", value: "+1 555" }]);
    expect(d.tags).toEqual(["pioneer"]);
  });
});
