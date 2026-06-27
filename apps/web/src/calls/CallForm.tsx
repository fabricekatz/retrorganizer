import { useState } from "react";
import { tokens } from "@retrorganizer/ui";
import { emptyCallDraft, startOfDay, type CallDraft } from "@retrorganizer/core";
import { useContacts } from "../contacts/useContacts";
import { toDateInput, fromDateInput } from "../calendar/datetime";
import { CategorySelect } from "../categories/CategorySelect";
import { TagInput } from "../categories/TagInput";

const DIRECTIONS: { label: string; value: CallDraft["direction"] }[] = [
  { label: "Entrant", value: "incoming" },
  { label: "Sortant", value: "outgoing" },
  { label: "Manqué", value: "missed" },
];

export interface CallFormProps {
  initial?: CallDraft;
  onSubmit(draft: CallDraft): void;
  onCancel(): void;
}

export function CallForm({ initial, onSubmit, onCancel }: CallFormProps) {
  const [draft, setDraft] = useState<CallDraft>(initial ?? { ...emptyCallDraft(), occurredAt: startOfDay(Date.now()) });
  const { contacts } = useContacts();
  function set<K extends keyof CallDraft>(key: K, value: CallDraft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }
  function submit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit(draft);
  }
  return (
    <form onSubmit={submit} style={{ padding: tokens.space.md, font: `13px ${tokens.font.body}`, display: "grid", gap: tokens.space.sm }}>
      <label>Nom / contact
        <input aria-label="Nom / contact" value={draft.contactName} onChange={(e) => set("contactName", e.target.value)} style={{ display: "block", width: "100%" }} />
      </label>
      {contacts.length > 0 && (
        <label>Lier à un contact
          <select aria-label="Lier à un contact" value={draft.contactId ?? ""}
            onChange={(e) => {
              const id = e.target.value === "" ? null : e.target.value;
              const c = contacts.find((x) => x.id === id);
              setDraft((d) => ({ ...d, contactId: id, contactName: c ? c.displayName : d.contactName }));
            }} style={{ display: "block" }}>
            <option value="">Aucun</option>
            {contacts.map((c) => <option key={c.id} value={c.id}>{c.displayName}</option>)}
          </select>
        </label>
      )}
      <label>Numéro
        <input aria-label="Numéro" value={draft.phoneNumber} onChange={(e) => set("phoneNumber", e.target.value)} style={{ display: "block", width: "100%" }} />
      </label>
      <label>Sens
        <select aria-label="Sens" value={draft.direction} onChange={(e) => set("direction", e.target.value as CallDraft["direction"])} style={{ display: "block" }}>
          {DIRECTIONS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
        </select>
      </label>
      <label>Date
        <input aria-label="Date" type="date" value={draft.occurredAt ? toDateInput(draft.occurredAt) : ""}
          onChange={(e) => set("occurredAt", e.target.value ? fromDateInput(e.target.value) : 0)} style={{ display: "block" }} />
      </label>
      <label>Durée (min)
        <input aria-label="Durée (min)" type="number" min={0} value={draft.durationMin}
          onChange={(e) => set("durationMin", Number(e.target.value) || 0)} style={{ display: "block" }} />
      </label>
      <label>Notes
        <textarea aria-label="Notes" value={draft.notes} onChange={(e) => set("notes", e.target.value)} style={{ display: "block", width: "100%" }} />
      </label>
      <label>Catégorie
        <CategorySelect value={draft.categoryId} onChange={(id) => set("categoryId", id)} />
      </label>
      <label>Tags
        <TagInput value={draft.tags} onChange={(tags) => set("tags", tags)} />
      </label>
      <div style={{ display: "flex", gap: tokens.space.sm }}>
        <button type="submit">Enregistrer</button>
        <button type="button" onClick={onCancel}>Annuler</button>
      </div>
    </form>
  );
}
