import { useState } from "react";
import { tokens } from "@retrorganizer/ui";
import { emptyEventDraft, type EventDraft } from "@retrorganizer/core";
import { useContacts } from "../contacts/useContacts";
import { toLocalInput, fromLocalInput, toDateInput, fromDateInput } from "./datetime";
import { CategorySelect } from "../categories/CategorySelect";
import { TagInput } from "../categories/TagInput";

export const EVENT_RECUR_PRESETS: { label: string; value: string }[] = [
  { label: "Aucune", value: "" },
  { label: "Tous les jours", value: "FREQ=DAILY" },
  { label: "Toutes les semaines", value: "FREQ=WEEKLY" },
  { label: "Tous les mois", value: "FREQ=MONTHLY" },
  { label: "Tous les ans", value: "FREQ=YEARLY" },
];

export const EVENT_REMINDER_PRESETS: { label: string; value: number }[] = [
  { label: "Aucun", value: -1 },
  { label: "10 minutes avant", value: 10 },
  { label: "1 heure avant", value: 60 },
  { label: "1 jour avant", value: 1440 },
];

export interface EventFormProps {
  initial?: EventDraft;
  onSubmit(draft: EventDraft): void;
  onCancel(): void;
}

export function EventForm({ initial, onSubmit, onCancel }: EventFormProps) {
  const [draft, setDraft] = useState<EventDraft>(initial ? { ...initial, reminderOffsets: initial.reminderOffsets.slice(0, 1) } : emptyEventDraft());
  const [error, setError] = useState<string | null>(null);
  const { contacts } = useContacts();

  function set<K extends keyof EventDraft>(key: K, value: EventDraft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (draft.end < draft.start) {
      setError("La fin doit être après le début.");
      return;
    }
    onSubmit(draft);
  }

  const reminderValue = draft.reminderOffsets[0] ?? -1;

  return (
    <form onSubmit={submit} style={{ padding: tokens.space.md, font: `13px ${tokens.font.body}`, display: "grid", gap: tokens.space.sm }}>
      <label>Titre
        <input aria-label="Titre" value={draft.title} onChange={(e) => set("title", e.target.value)}
          style={{ display: "block", width: "100%" }} />
      </label>

      <label>
        <input type="checkbox" aria-label="Toute la journée" checked={draft.allDay}
          onChange={(e) => set("allDay", e.target.checked)} /> Toute la journée
      </label>

      {draft.allDay ? (
        <>
          <label>Début
            <input aria-label="Début" type="date" value={draft.start ? toDateInput(draft.start) : ""}
              onChange={(e) => { if (e.target.value) set("start", fromDateInput(e.target.value)); }} style={{ display: "block" }} />
          </label>
          <label>Fin
            <input aria-label="Fin" type="date" value={draft.end ? toDateInput(draft.end) : ""}
              onChange={(e) => { if (e.target.value) set("end", fromDateInput(e.target.value)); }} style={{ display: "block" }} />
          </label>
        </>
      ) : (
        <>
          <label>Début
            <input aria-label="Début" type="datetime-local" value={draft.start ? toLocalInput(draft.start) : ""}
              onChange={(e) => { if (e.target.value) set("start", fromLocalInput(e.target.value)); }} style={{ display: "block" }} />
          </label>
          <label>Fin
            <input aria-label="Fin" type="datetime-local" value={draft.end ? toLocalInput(draft.end) : ""}
              onChange={(e) => { if (e.target.value) set("end", fromLocalInput(e.target.value)); }} style={{ display: "block" }} />
          </label>
        </>
      )}

      <label>Lieu
        <input aria-label="Lieu" value={draft.location} onChange={(e) => set("location", e.target.value)}
          style={{ display: "block", width: "100%" }} />
      </label>

      <label>Récurrence
        <select aria-label="Récurrence" value={draft.recurrence ?? ""}
          onChange={(e) => set("recurrence", e.target.value === "" ? null : e.target.value)} style={{ display: "block" }}>
          {EVENT_RECUR_PRESETS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
      </label>

      <label>Rappel
        <select aria-label="Rappel" value={reminderValue}
          onChange={(e) => set("reminderOffsets", Number(e.target.value) < 0 ? [] : [Number(e.target.value)])} style={{ display: "block" }}>
          {EVENT_REMINDER_PRESETS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
      </label>

      <label>Notes
        <textarea aria-label="Notes" value={draft.notes} onChange={(e) => set("notes", e.target.value)}
          style={{ display: "block", width: "100%" }} />
      </label>

      {contacts.length > 0 && (
        <fieldset style={{ border: `1px solid ${tokens.color.line}` }}>
          <legend>Contacts liés</legend>
          {contacts.map((c) => (
            <label key={c.id} style={{ display: "block" }}>
              <input type="checkbox" aria-label={c.displayName} checked={draft.contactIds.includes(c.id)}
                onChange={(e) =>
                  set("contactIds", e.target.checked
                    ? [...draft.contactIds, c.id]
                    : draft.contactIds.filter((id) => id !== c.id))} />
              {" "}{c.displayName}
            </label>
          ))}
        </fieldset>
      )}

      {error && <p role="alert" style={{ color: "#a8431f" }}>{error}</p>}
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
