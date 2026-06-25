import { tokens } from "@retrorganizer/ui";
import {
  contactsToVCard, contactsToCsv, vCardToDrafts, csvToDrafts,
  type Contact, type ContactDraft,
} from "@retrorganizer/core";

export interface ImportExportBarProps {
  contacts: Contact[];
  onImport(drafts: ContactDraft[]): void;
}

function download(filename: string, text: string) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function ImportExportBar({ contacts, onImport }: ImportExportBarProps) {
  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const isVcard = /BEGIN:VCARD/i.test(text) || file.name.toLowerCase().endsWith(".vcf");
    onImport(isVcard ? vCardToDrafts(text) : csvToDrafts(text));
    e.target.value = "";
  }
  return (
    <div style={{ display: "flex", gap: tokens.space.sm, padding: tokens.space.sm,
      borderBottom: `1px solid ${tokens.color.line}` }}>
      <button type="button" onClick={() => download("contacts.vcf", contactsToVCard(contacts))}>Exporter vCard</button>
      <button type="button" onClick={() => download("contacts.csv", contactsToCsv(contacts))}>Exporter CSV</button>
      <input type="file" aria-label="Importer un fichier" accept=".vcf,.csv,text/*" onChange={onFile} />
    </div>
  );
}
