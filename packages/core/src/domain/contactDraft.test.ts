import { describe, it, expect } from "vitest";
import { emptyDraft, draftFromContact, withDisplayName } from "./contactDraft";
import type { Contact } from "./contact";

const sample: Contact = {
  id: "c1", ownerId: "u1", createdAt: 1, updatedAt: 1, deletedAt: null,
  firstName: "Ada", lastName: "Lovelace", displayName: "Ada Lovelace",
  phones: [{ label: "mobile", value: "+33 1" }], emails: [], addresses: [],
  webLinks: [], importantDates: [], customFields: [], categoryId: null, tags: [],
};

describe("contactDraft", () => {
  it("emptyDraft has empty strings and arrays", () => {
    const d = emptyDraft();
    expect(d.displayName).toBe("");
    expect(d.organization).toBe("");
    expect(d.phones).toEqual([]);
    expect(d.categoryId).toBeNull();
  });

  it("draftFromContact projects optionals to empty strings", () => {
    const d = draftFromContact(sample);
    expect(d.organization).toBe("");
    expect(d.notes).toBe("");
    expect(d.phones).toEqual([{ label: "mobile", value: "+33 1" }]);
    d.phones[0]!.value = "mutated";
    expect(sample.phones[0]!.value).toBe("+33 1");
  });

  it("draftFromContact carries an optional photoUrl through", () => {
    expect(draftFromContact(sample).photoUrl).toBeUndefined();
    expect(draftFromContact({ ...sample, photoUrl: "data:image/jpeg;base64,xyz" }).photoUrl).toBe("data:image/jpeg;base64,xyz");
  });

  it("withDisplayName fills from first+last when empty", () => {
    const d = withDisplayName({ ...emptyDraft(), firstName: "Ada", lastName: "Lovelace" });
    expect(d.displayName).toBe("Ada Lovelace");
  });

  it("withDisplayName keeps an existing displayName", () => {
    const d = withDisplayName({ ...emptyDraft(), firstName: "X", displayName: "Keep Me" });
    expect(d.displayName).toBe("Keep Me");
  });
});
