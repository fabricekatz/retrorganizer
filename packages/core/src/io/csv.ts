import type { Contact } from "../domain/contact";
import type { ContactDraft } from "../domain/contactDraft";
import { emptyDraft, withDisplayName } from "../domain/contactDraft";

const CRLF = "\r\n";
const HEADER = [
  "displayName", "firstName", "lastName", "organization", "title", "notes",
  "categoryId", "tags", "phones", "emails", "addresses", "webLinks",
  "importantDates", "customFields",
] as const;
const JSON_COLS = new Set(["tags", "phones", "emails", "addresses", "webLinks", "importantDates", "customFields"]);

function quote(cell: string): string {
  if (/[",\r\n]/.test(cell)) return `"${cell.replace(/"/g, '""')}"`;
  return cell;
}

export function contactsToCsv(cs: Contact[]): string {
  const rows = [HEADER.join(",")];
  for (const c of cs) {
    const cells: Record<string, string> = {
      displayName: c.displayName,
      firstName: c.firstName,
      lastName: c.lastName,
      organization: c.organization ?? "",
      title: c.title ?? "",
      notes: c.notes ?? "",
      categoryId: c.categoryId ?? "",
      tags: JSON.stringify(c.tags),
      phones: JSON.stringify(c.phones),
      emails: JSON.stringify(c.emails),
      addresses: JSON.stringify(c.addresses),
      webLinks: JSON.stringify(c.webLinks),
      importantDates: JSON.stringify(c.importantDates),
      customFields: JSON.stringify(c.customFields),
    };
    rows.push(HEADER.map((h) => quote(cells[h] ?? "")).join(","));
  }
  return rows.join(CRLF) + CRLF;
}

// RFC-4180 parser: returns array of rows, each an array of cell strings.
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  const s = text;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inQuotes) {
      if (ch === '"') {
        if (s[i + 1] === '"') { cell += '"'; i++; }
        else inQuotes = false;
      } else cell += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(cell); cell = "";
    } else if (ch === "\r") {
      // ignore; handled with \n
    } else if (ch === "\n") {
      row.push(cell); cell = "";
      rows.push(row); row = [];
    } else {
      cell += ch;
    }
  }
  if (cell !== "" || row.length > 0) { row.push(cell); rows.push(row); }
  return rows;
}

function parseJsonArray<T>(cell: string): T[] {
  if (cell.trim() === "") return [];
  try {
    const parsed = JSON.parse(cell);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

export function csvToDrafts(text: string): ContactDraft[] {
  const rows = parseCsv(text);
  if (rows.length === 0) return [];
  const header = rows[0]!;
  const idx = (name: string) => header.indexOf(name);
  const drafts: ContactDraft[] = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r]!;
    if (row.every((c) => c === "")) continue;
    const get = (name: string) => (idx(name) >= 0 ? (row[idx(name)] ?? "") : "");
    const d = emptyDraft();
    d.displayName = get("displayName");
    d.firstName = get("firstName");
    d.lastName = get("lastName");
    d.organization = get("organization");
    d.title = get("title");
    d.notes = get("notes");
    const cat = get("categoryId");
    d.categoryId = cat === "" ? null : cat;
    d.tags = parseJsonArray<string>(get("tags"));
    d.phones = parseJsonArray(get("phones"));
    d.emails = parseJsonArray(get("emails"));
    d.addresses = parseJsonArray(get("addresses"));
    d.webLinks = parseJsonArray(get("webLinks"));
    d.importantDates = parseJsonArray(get("importantDates"));
    d.customFields = parseJsonArray(get("customFields"));
    drafts.push(withDisplayName(d));
  }
  return drafts;
}
