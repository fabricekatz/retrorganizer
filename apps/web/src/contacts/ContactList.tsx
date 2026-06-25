import { tokens } from "@retrorganizer/ui";
import type { Contact } from "@retrorganizer/core";

export type SortKey = "name" | "organization";

export interface ContactListProps {
  contacts: Contact[];
  onSelect(c: Contact): void;
  onNew(): void;
  query: string;
  onQueryChange(q: string): void;
  sortKey: SortKey;
  onSortKeyChange(k: SortKey): void;
}

export function ContactList({ contacts, onSelect, onNew, query, onQueryChange, sortKey, onSortKeyChange }: ContactListProps) {
  return (
    <div style={{ padding: tokens.space.sm, font: `13px ${tokens.font.body}` }}>
      <div style={{ display: "flex", gap: tokens.space.sm, marginBottom: tokens.space.sm }}>
        <input aria-label="Rechercher" placeholder="Rechercher" value={query}
          onChange={(e) => onQueryChange(e.target.value)} />
        <select aria-label="Trier par" value={sortKey}
          onChange={(e) => onSortKeyChange(e.target.value as SortKey)}>
          <option value="name">Nom</option>
          <option value="organization">Organisation</option>
        </select>
        <button type="button" onClick={onNew}>+ Nouveau</button>
      </div>
      <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {contacts.map((c) => (
          <li key={c.id}>
            <button type="button" onClick={() => onSelect(c)}
              style={{ display: "block", width: "100%", textAlign: "left", border: "none",
                borderBottom: `1px solid ${tokens.color.line}`, background: "transparent",
                padding: tokens.space.xs, cursor: "pointer", color: tokens.color.ink }}>
              {c.displayName}{c.organization ? ` — ${c.organization}` : ""}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
