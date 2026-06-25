import { useNavigate } from "react-router-dom";
import { tokens } from "@retrorganizer/ui";
import type { SearchType } from "@retrorganizer/core";
import { useGlobalSearch } from "./useGlobalSearch";

const TYPE_LABEL: Record<SearchType, string> = {
  contact: "Contact", event: "Événement", task: "Tâche", note: "Note",
};

export function GlobalSearchBar() {
  const { query, setQuery, results } = useGlobalSearch();
  const navigate = useNavigate();

  function pick(path: string) {
    navigate(path);
    setQuery("");
  }

  return (
    <div style={{ position: "relative", flex: 1, maxWidth: 360, margin: `0 ${tokens.space.md}px` }}>
      <input
        aria-label="Recherche globale"
        placeholder="Rechercher partout…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        style={{ width: "100%", font: `13px ${tokens.font.body}` }}
      />
      {query.trim() !== "" && results.length > 0 && (
        <ul style={{ position: "absolute", left: 0, right: 0, top: "100%", zIndex: 10, listStyle: "none",
          margin: 0, padding: 0, background: tokens.color.surface, border: `1px solid ${tokens.color.line}`,
          maxHeight: 280, overflow: "auto" }}>
          {results.slice(0, 20).map((r) => (
            <li key={r.id}>
              <button type="button" onClick={() => pick(r.path)}
                style={{ display: "flex", gap: tokens.space.sm, width: "100%", textAlign: "left", border: "none",
                  borderBottom: `1px solid ${tokens.color.line}`, background: "transparent", cursor: "pointer",
                  padding: tokens.space.xs, color: tokens.color.ink, font: `12px ${tokens.font.body}` }}>
                <span style={{ color: tokens.color.muted, minWidth: 72 }}>{TYPE_LABEL[r.type]}</span>
                <span>{r.title}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
