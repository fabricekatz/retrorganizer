import { tokens } from "@retrorganizer/ui";
import { useCategories } from "./useCategories";

export interface CategoryManagerProps {
  onClose(): void;
}

export function CategoryManager({ onClose }: CategoryManagerProps) {
  const { categories, loading, error, updateCategory, removeCategory } = useCategories();

  function rename(id: string, current: string) {
    const name = window.prompt("Nouveau nom ?", current);
    if (name !== null && name.trim() !== "" && name.trim() !== current) {
      void updateCategory(id, { name: name.trim() });
    }
  }

  return (
    <div style={{ position: "absolute", top: 36, right: tokens.space.md, width: 360, zIndex: 20,
      background: tokens.color.surface, border: `1px solid ${tokens.color.line}`, font: `13px ${tokens.font.body}`,
      maxHeight: "70vh", overflow: "auto", boxShadow: "0 4px 16px rgba(0,0,0,0.15)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: tokens.space.sm, borderBottom: `1px solid ${tokens.color.line}` }}>
        <strong>Catégories</strong>
        <button type="button" onClick={onClose}>Fermer</button>
      </div>
      {error && <p role="alert" style={{ color: "#a8431f", padding: tokens.space.sm }}>{error}</p>}
      {loading ? (
        <p style={{ padding: tokens.space.md, color: tokens.color.muted }}>Chargement…</p>
      ) : categories.length === 0 ? (
        <p style={{ padding: tokens.space.md, color: tokens.color.muted }}>Aucune catégorie</p>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {categories.map((c) => (
            <li key={c.id} style={{ display: "flex", alignItems: "center", gap: tokens.space.xs,
              borderBottom: `1px solid ${tokens.color.line}`, padding: tokens.space.xs }}>
              <input type="color" aria-label={`Couleur ${c.name}`} value={c.color}
                onChange={(e) => void updateCategory(c.id, { color: e.target.value })}
                style={{ width: 24, height: 24, padding: 0, border: "none", background: "none" }} />
              <span style={{ flex: 1 }}>{c.name}</span>
              <button type="button" onClick={() => rename(c.id, c.name)}>Renommer</button>
              <button type="button" onClick={() => { if (window.confirm(`Supprimer la catégorie « ${c.name} » ?`)) void removeCategory(c.id); }}>
                Supprimer
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
