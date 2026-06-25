import type { Contact } from "../domain/contact";
import type { ContactDraft } from "../domain/contactDraft";
import { emptyDraft, withDisplayName } from "../domain/contactDraft";
import { escapeValue, unescapeValue, splitEscaped, unfoldLines } from "./vcardEscape";

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

interface ParsedLine { name: string; params: Record<string, string>; value: string; }

function parseLine(line: string): ParsedLine | null {
  const colon = line.indexOf(":");
  if (colon === -1) return null;
  const head = line.slice(0, colon);
  const value = line.slice(colon + 1);
  const segments = head.split(";");
  const nameWithGroup = segments[0] ?? "";
  const name = (nameWithGroup.includes(".") ? nameWithGroup.split(".").pop()! : nameWithGroup).toUpperCase();
  const params: Record<string, string> = {};
  for (let i = 1; i < segments.length; i++) {
    const seg = segments[i] ?? "";
    const eq = seg.indexOf("=");
    if (eq === -1) params["TYPE"] = seg; // bare param value, e.g. vCard 3 "TEL;CELL:"
    else params[seg.slice(0, eq).toUpperCase()] = seg.slice(eq + 1).replace(/^"|"$/g, "");
  }
  return { name, params, value };
}

export function vCardToDrafts(text: string): ContactDraft[] {
  const drafts: ContactDraft[] = [];
  let cur: ContactDraft | null = null;
  for (const raw of unfoldLines(text)) {
    const line = raw.trim();
    if (line === "") continue;
    if (line.toUpperCase() === "BEGIN:VCARD") { cur = emptyDraft(); continue; }
    if (line.toUpperCase() === "END:VCARD") { if (cur) drafts.push(withDisplayName(cur)); cur = null; continue; }
    if (!cur) continue;
    const p = parseLine(line);
    if (!p) continue;
    const label = (p.params["TYPE"] ?? "other").toLowerCase();
    switch (p.name) {
      case "VERSION": break;
      case "N": {
        const parts = splitEscaped(p.value, ";").map(unescapeValue);
        cur.lastName = parts[0] ?? "";
        cur.firstName = parts[1] ?? "";
        break;
      }
      case "FN": cur.displayName = unescapeValue(p.value); break;
      case "ORG": cur.organization = unescapeValue(splitEscaped(p.value, ";")[0] ?? ""); break;
      case "TITLE": cur.title = unescapeValue(p.value); break;
      case "TEL": cur.phones.push({ label, value: unescapeValue(p.value) }); break;
      case "EMAIL": cur.emails.push({ label, value: unescapeValue(p.value) }); break;
      case "ADR": {
        const a = splitEscaped(p.value, ";").map(unescapeValue);
        cur.addresses.push({ label, street: a[2] ?? "", city: a[3] ?? "", postalCode: a[5] ?? "", country: a[6] ?? "" });
        break;
      }
      case "URL": cur.webLinks.push({ label: "site", value: unescapeValue(p.value) }); break;
      case "BDAY": cur.importantDates.push({ label: "naissance", date: p.value.trim() }); break;
      case "CATEGORIES": cur.tags.push(...splitEscaped(p.value, ",").map(unescapeValue).filter((t) => t !== "")); break;
      case "NOTE": cur.notes = unescapeValue(p.value); break;
      default: break;
    }
  }
  return drafts;
}
