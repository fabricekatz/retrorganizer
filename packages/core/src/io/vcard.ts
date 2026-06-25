import type { Contact } from "../domain/contact";
import { escapeValue } from "./vcardEscape";

const CRLF = "\r\n";

function param(label: string): string {
  return label.replace(/[;,:]/g, "_");
}

export function contactToVCard(c: Contact): string {
  const lines: string[] = ["BEGIN:VCARD", "VERSION:3.0"];
  lines.push(`N:${escapeValue(c.lastName)};${escapeValue(c.firstName)};;;`);
  lines.push(`FN:${escapeValue(c.displayName)}`);
  if (c.organization) lines.push(`ORG:${escapeValue(c.organization)}`);
  if (c.title) lines.push(`TITLE:${escapeValue(c.title)}`);
  for (const p of c.phones) lines.push(`TEL;TYPE=${param(p.label)}:${escapeValue(p.value)}`);
  for (const e of c.emails) lines.push(`EMAIL;TYPE=${param(e.label)}:${escapeValue(e.value)}`);
  for (const a of c.addresses) {
    const adr = [a.street, a.city, "", a.postalCode, a.country].map(escapeValue).join(";");
    lines.push(`ADR;TYPE=${param(a.label)}:;;${adr}`);
  }
  for (const w of c.webLinks) lines.push(`URL:${escapeValue(w.value)}`);
  const bday = c.importantDates.find((d) => /naiss|birth/i.test(d.label));
  if (bday) lines.push(`BDAY:${bday.date}`);
  if (c.tags.length > 0) lines.push(`CATEGORIES:${c.tags.map(escapeValue).join(",")}`);
  if (c.notes) lines.push(`NOTE:${escapeValue(c.notes)}`);
  lines.push("END:VCARD");
  return lines.join(CRLF) + CRLF;
}

export function contactsToVCard(cs: Contact[]): string {
  return cs.map(contactToVCard).join("");
}
