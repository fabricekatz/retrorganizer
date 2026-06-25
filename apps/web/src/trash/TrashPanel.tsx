import { tokens } from "@retrorganizer/ui";
import { useTrash, type TrashType } from "./useTrash";

const TYPE_LABEL: Record<TrashType, string> = {
  contact: "Contact", event: "Événement", task: "Tâche", note: "Note", category: "Catégorie",
};

export interface TrashPanelProps {
  onClose(): void;
}

export function TrashPanel({ onClose }: TrashPanelProps) {
  const { items, loading, error, restore, purge } = useTrash();

  return (
    <div style={{ position: "absolute", top: 36, right: tokens.space.md, width: 360, zIndex: 20,
      background: tokens.color.surface, border: `1px solid ${tokens.color.line}`, font: `13px ${tokens.font.body}`,
      maxHeight: "70vh", overflow: "auto", boxShadow: "0 4px 16px rgba(0,0,0,0.15)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: tokens.space.sm, borderBottom: `1px solid ${tokens.color.line}` }}>
        <strong>Corbeille</strong>
        <button type="button" onClick={onClose}>Fermer</button>
      </div>
      {error && <p role="alert" style={{ color: "#a8431f", padding: tokens.space.sm }}>{error}</p>}
      {loading ? (
        <p style={{ padding: tokens.space.md, color: tokens.color.muted }}>Chargement…</p>
      ) : items.length === 0 ? (
        <p style={{ padding: tokens.space.md, color: tokens.color.muted }}>Corbeille vide</p>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {items.map((item) => (
            <li key={`${item.type}:${item.id}`} style={{ display: "flex", alignItems: "center", gap: tokens.space.xs,
              borderBottom: `1px solid ${tokens.color.line}`, padding: tokens.space.xs }}>
              <span style={{ color: tokens.color.muted, minWidth: 72, fontSize: 11 }}>{TYPE_LABEL[item.type]}</span>
              <span style={{ flex: 1 }}>{item.title}</span>
              <button type="button" onClick={() => restore(item)}>Restaurer</button>
              <button type="button" onClick={() => { if (window.confirm("Supprimer définitivement ?")) purge(item); }}>
                Supprimer définitivement
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
