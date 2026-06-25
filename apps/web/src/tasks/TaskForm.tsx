import { useState } from "react";
import { tokens } from "@retrorganizer/ui";
import { emptyTaskDraft, type TaskDraft } from "@retrorganizer/core";
import { useContacts } from "../contacts/useContacts";
import { useEvents } from "../calendar/useEvents";
import { toDateInput, fromDateInput } from "../calendar/datetime";
import { SubtaskField } from "./SubtaskField";

const PRIORITIES: { label: string; value: TaskDraft["priority"] }[] = [
  { label: "Basse", value: "low" }, { label: "Normale", value: "normal" }, { label: "Haute", value: "high" },
];
const STATUSES: { label: string; value: TaskDraft["status"] }[] = [
  { label: "À faire", value: "todo" }, { label: "En cours", value: "in_progress" }, { label: "Terminé", value: "done" },
];
const RECUR: { label: string; value: string }[] = [
  { label: "Aucune", value: "" }, { label: "Tous les jours", value: "FREQ=DAILY" },
  { label: "Toutes les semaines", value: "FREQ=WEEKLY" }, { label: "Tous les mois", value: "FREQ=MONTHLY" },
];

export interface TaskFormProps {
  initial?: TaskDraft;
  onSubmit(draft: TaskDraft): void;
  onCancel(): void;
}

export function TaskForm({ initial, onSubmit, onCancel }: TaskFormProps) {
  const [draft, setDraft] = useState<TaskDraft>(initial ?? emptyTaskDraft());
  const { contacts } = useContacts();
  const { events } = useEvents();

  function set<K extends keyof TaskDraft>(key: K, value: TaskDraft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }
  function submit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit(draft);
  }

  return (
    <form onSubmit={submit} style={{ padding: tokens.space.md, font: `13px ${tokens.font.body}`, display: "grid", gap: tokens.space.sm }}>
      <label>Titre
        <input aria-label="Titre" value={draft.title} onChange={(e) => set("title", e.target.value)}
          style={{ display: "block", width: "100%" }} />
      </label>
      <label>Description
        <textarea aria-label="Description" value={draft.description} onChange={(e) => set("description", e.target.value)}
          style={{ display: "block", width: "100%" }} />
      </label>
      <label>Priorité
        <select aria-label="Priorité" value={draft.priority} onChange={(e) => set("priority", e.target.value as TaskDraft["priority"])} style={{ display: "block" }}>
          {PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
      </label>
      <label>Échéance
        <input aria-label="Échéance" type="date" value={draft.dueDate ? toDateInput(draft.dueDate) : ""}
          onChange={(e) => set("dueDate", e.target.value ? fromDateInput(e.target.value) : null)} style={{ display: "block" }} />
      </label>
      <label>Statut
        <select aria-label="Statut" value={draft.status} onChange={(e) => set("status", e.target.value as TaskDraft["status"])} style={{ display: "block" }}>
          {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </label>
      <SubtaskField rows={draft.subtasks} onChange={(rows) => set("subtasks", rows)} />
      <label>Récurrence
        <select aria-label="Récurrence" value={draft.recurrence ?? ""} onChange={(e) => set("recurrence", e.target.value === "" ? null : e.target.value)} style={{ display: "block" }}>
          {RECUR.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
      </label>
      <label>Événement lié
        <select aria-label="Événement lié" value={draft.eventId ?? ""} onChange={(e) => set("eventId", e.target.value === "" ? null : e.target.value)} style={{ display: "block" }}>
          <option value="">Aucun</option>
          {events.map((ev) => <option key={ev.id} value={ev.id}>{ev.title}</option>)}
        </select>
      </label>
      {contacts.length > 0 && (
        <fieldset style={{ border: `1px solid ${tokens.color.line}` }}>
          <legend>Contacts liés</legend>
          {contacts.map((c) => (
            <label key={c.id} style={{ display: "block" }}>
              <input type="checkbox" aria-label={c.displayName} checked={draft.contactIds.includes(c.id)}
                onChange={(e) => set("contactIds", e.target.checked
                  ? [...draft.contactIds, c.id]
                  : draft.contactIds.filter((id) => id !== c.id))} />
              {" "}{c.displayName}
            </label>
          ))}
        </fieldset>
      )}
      <div style={{ display: "flex", gap: tokens.space.sm }}>
        <button type="submit">Enregistrer</button>
        <button type="button" onClick={onCancel}>Annuler</button>
      </div>
    </form>
  );
}
