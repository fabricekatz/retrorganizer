import { useState } from "react";
import { tokens } from "@retrorganizer/ui";

export interface TagInputProps {
  value: string[];
  onChange(tags: string[]): void;
}

export function TagInput({ value, onChange }: TagInputProps) {
  const [text, setText] = useState("");

  function add() {
    const tag = text.trim();
    if (tag === "" || value.includes(tag)) { setText(""); return; }
    onChange([...value, tag]);
    setText("");
  }

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: tokens.space.xs, alignItems: "center" }}>
      {value.map((tag) => (
        <span key={tag} style={{ display: "inline-flex", alignItems: "center", gap: 2,
          background: tokens.color.paper, border: `1px solid ${tokens.color.line}`,
          borderRadius: tokens.radius.sm, padding: "0 4px", font: `12px ${tokens.font.body}` }}>
          {tag}
          <button type="button" aria-label={`Supprimer le tag ${tag}`}
            onClick={() => onChange(value.filter((t) => t !== tag))}
            style={{ border: "none", background: "transparent", cursor: "pointer" }}>×</button>
        </span>
      ))}
      <input aria-label="Ajouter un tag" value={text} placeholder="tag…"
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} />
    </div>
  );
}
