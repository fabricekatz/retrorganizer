import { tokens } from "@retrorganizer/ui";

export interface LabeledRow { label: string; value: string; }

export interface MultiValueFieldProps {
  legend: string;        // e.g. "Téléphone"
  valueLabel: string;    // placeholder for the value input
  valueType?: "text" | "date";
  rows: LabeledRow[];
  onChange(rows: LabeledRow[]): void;
}

export function MultiValueField({ legend, valueLabel, valueType = "text", rows, onChange }: MultiValueFieldProps) {
  function update(i: number, patch: Partial<LabeledRow>) {
    onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  }
  function add() { onChange([...rows, { label: "", value: "" }]); }
  function removeAt(i: number) { onChange(rows.filter((_, j) => j !== i)); }

  return (
    <fieldset style={{ border: `1px solid ${tokens.color.line}`, marginBottom: tokens.space.sm }}>
      <legend>{legend}</legend>
      {rows.map((r, i) => (
        <div key={i} style={{ display: "flex", gap: tokens.space.xs, marginBottom: tokens.space.xs }}>
          <input
            aria-label={`${legend} libellé ${i + 1}`}
            placeholder="libellé"
            value={r.label}
            onChange={(e) => update(i, { label: e.target.value })}
          />
          <input
            aria-label={`${legend} valeur ${i + 1}`}
            type={valueType}
            placeholder={valueLabel}
            value={r.value}
            onChange={(e) => update(i, { value: e.target.value })}
          />
          <button type="button" aria-label={`Supprimer ${legend} ${i + 1}`} onClick={() => removeAt(i)}>×</button>
        </div>
      ))}
      <button type="button" onClick={add}>+ {legend}</button>
    </fieldset>
  );
}
