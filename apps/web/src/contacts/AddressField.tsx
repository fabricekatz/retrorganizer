import { tokens } from "@retrorganizer/ui";
import type { PostalAddress } from "@retrorganizer/core";

export interface AddressFieldProps {
  rows: PostalAddress[];
  onChange(rows: PostalAddress[]): void;
}

const FIELDS: { key: keyof PostalAddress; label: string; ph: string }[] = [
  { key: "label", label: "libellé", ph: "libellé" },
  { key: "street", label: "rue", ph: "rue" },
  { key: "city", label: "ville", ph: "ville" },
  { key: "postalCode", label: "code postal", ph: "code postal" },
  { key: "country", label: "pays", ph: "pays" },
];

export function AddressField({ rows, onChange }: AddressFieldProps) {
  function update(i: number, patch: Partial<PostalAddress>) {
    onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  }
  function add() { onChange([...rows, { label: "", street: "", city: "", postalCode: "", country: "" }]); }
  function removeAt(i: number) { onChange(rows.filter((_, j) => j !== i)); }

  return (
    <fieldset style={{ border: `1px solid ${tokens.color.line}`, marginBottom: tokens.space.sm }}>
      <legend>Adresse</legend>
      {rows.map((r, i) => (
        <div key={i} style={{ display: "flex", flexWrap: "wrap", gap: tokens.space.xs, marginBottom: tokens.space.xs }}>
          {FIELDS.map((f) => (
            <input
              key={f.key}
              aria-label={`Adresse ${f.label} ${i + 1}`}
              placeholder={f.ph}
              value={r[f.key]}
              onChange={(e) => update(i, { [f.key]: e.target.value })}
            />
          ))}
          <button type="button" aria-label={`Supprimer Adresse ${i + 1}`} onClick={() => removeAt(i)}>×</button>
        </div>
      ))}
      <button type="button" onClick={add}>+ Adresse</button>
    </fieldset>
  );
}
