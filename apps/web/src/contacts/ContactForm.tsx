import { useState } from "react";
import { tokens } from "@retrorganizer/ui";
import { emptyDraft, withDisplayName, type ContactDraft } from "@retrorganizer/core";
import { MultiValueField } from "./MultiValueField";
import { AddressField } from "./AddressField";

export interface ContactFormProps {
  initial?: ContactDraft;
  onSubmit(draft: ContactDraft): void;
  onCancel(): void;
}

export function ContactForm({ initial, onSubmit, onCancel }: ContactFormProps) {
  const [draft, setDraft] = useState<ContactDraft>(initial ?? emptyDraft());
  function set<K extends keyof ContactDraft>(key: K, value: ContactDraft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }
  function submit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit(withDisplayName(draft));
  }
  const field = (label: string, key: "firstName" | "lastName" | "displayName" | "organization" | "title") => (
    <label style={{ display: "block", marginBottom: tokens.space.xs }}>
      {label}
      <input
        aria-label={label}
        value={draft[key]}
        onChange={(e) => set(key, e.target.value)}
        style={{ display: "block", width: "100%" }}
      />
    </label>
  );

  return (
    <form onSubmit={submit} style={{ padding: tokens.space.md, font: `13px ${tokens.font.body}` }}>
      {field("Prénom", "firstName")}
      {field("Nom", "lastName")}
      {field("Nom affiché", "displayName")}
      {field("Organisation", "organization")}
      {field("Fonction", "title")}
      <MultiValueField legend="Téléphone" valueLabel="numéro" rows={draft.phones}
        onChange={(rows) => set("phones", rows)} />
      <MultiValueField legend="Email" valueLabel="adresse" rows={draft.emails}
        onChange={(rows) => set("emails", rows)} />
      <AddressField rows={draft.addresses} onChange={(rows) => set("addresses", rows)} />
      <MultiValueField legend="Lien web" valueLabel="URL" rows={draft.webLinks}
        onChange={(rows) => set("webLinks", rows)} />
      <MultiValueField legend="Date importante" valueLabel="date" valueType="date"
        rows={draft.importantDates.map((d) => ({ label: d.label, value: d.date }))}
        onChange={(rows) => set("importantDates", rows.map((r) => ({ label: r.label, date: r.value })))} />
      <MultiValueField legend="Champ perso" valueLabel="valeur"
        rows={draft.customFields.map((f) => ({ label: f.key, value: f.value }))}
        onChange={(rows) => set("customFields", rows.map((r) => ({ key: r.label, value: r.value })))} />
      <label style={{ display: "block", marginBottom: tokens.space.xs }}>
        Notes
        <textarea aria-label="Notes" value={draft.notes}
          onChange={(e) => set("notes", e.target.value)} style={{ display: "block", width: "100%" }} />
      </label>
      <div style={{ display: "flex", gap: tokens.space.sm }}>
        <button type="submit">Enregistrer</button>
        <button type="button" onClick={onCancel}>Annuler</button>
      </div>
    </form>
  );
}
