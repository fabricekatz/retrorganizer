import { tokens } from "@retrorganizer/ui";
import type { Subtask } from "@retrorganizer/core";

export interface SubtaskFieldProps {
  rows: Subtask[];
  onChange(rows: Subtask[]): void;
}

export function SubtaskField({ rows, onChange }: SubtaskFieldProps) {
  function update(i: number, patch: Partial<Subtask>) {
    onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  }
  function add() { onChange([...rows, { title: "", done: false }]); }
  function removeAt(i: number) { onChange(rows.filter((_, j) => j !== i)); }

  return (
    <fieldset style={{ border: `1px solid ${tokens.color.line}`, marginBottom: tokens.space.sm }}>
      <legend>Sous-étapes</legend>
      {rows.map((r, i) => (
        <div key={i} style={{ display: "flex", gap: tokens.space.xs, marginBottom: tokens.space.xs }}>
          <input type="checkbox" aria-label={`Sous-étape faite ${i + 1}`} checked={r.done}
            onChange={(e) => update(i, { done: e.target.checked })} />
          <input aria-label={`Sous-étape titre ${i + 1}`} value={r.title} placeholder="sous-étape"
            onChange={(e) => update(i, { title: e.target.value })} style={{ flex: 1 }} />
          <button type="button" aria-label={`Supprimer sous-étape ${i + 1}`} onClick={() => removeAt(i)}>×</button>
        </div>
      ))}
      <button type="button" onClick={add}>+ Sous-étape</button>
    </fieldset>
  );
}
