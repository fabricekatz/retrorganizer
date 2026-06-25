import type { Contact } from "./contact";
import type { LabeledValue, PostalAddress, LabeledDate, KeyValue } from "./types";

export interface ContactDraft {
  firstName: string;
  lastName: string;
  displayName: string;
  organization: string;
  title: string;
  phones: LabeledValue[];
  emails: LabeledValue[];
  addresses: PostalAddress[];
  webLinks: LabeledValue[];
  importantDates: LabeledDate[];
  notes: string;
  customFields: KeyValue[];
  categoryId: string | null;
  tags: string[];
}

export function emptyDraft(): ContactDraft {
  return {
    firstName: "", lastName: "", displayName: "", organization: "", title: "",
    phones: [], emails: [], addresses: [], webLinks: [], importantDates: [],
    notes: "", customFields: [], categoryId: null, tags: [],
  };
}

export function draftFromContact(c: Contact): ContactDraft {
  return {
    firstName: c.firstName,
    lastName: c.lastName,
    displayName: c.displayName,
    organization: c.organization ?? "",
    title: c.title ?? "",
    phones: c.phones.map((p) => ({ ...p })),
    emails: c.emails.map((p) => ({ ...p })),
    addresses: c.addresses.map((a) => ({ ...a })),
    webLinks: c.webLinks.map((w) => ({ ...w })),
    importantDates: c.importantDates.map((d) => ({ ...d })),
    notes: c.notes ?? "",
    customFields: c.customFields.map((f) => ({ ...f })),
    categoryId: c.categoryId,
    tags: [...c.tags],
  };
}

export function withDisplayName(d: ContactDraft): ContactDraft {
  if (d.displayName.trim() !== "") return { ...d };
  return { ...d, displayName: `${d.firstName} ${d.lastName}`.trim() };
}
