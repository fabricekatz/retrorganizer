import { useState, useEffect } from "react";
import { tokens } from "@retrorganizer/ui";
import type { Category } from "@retrorganizer/core";
import { useCategories } from "./useCategories";

export interface CategoryManagerProps {
  onClose(): void;
}

function CategoryRow({ category, onRecolor, onRename, onDelete }: {
  category: Category;
  onRecolor(id: string, color: string): void;
  onRename(id: string, current: string): void;
  onDelete(category: Category): void;
}) {
  const [color, setColor] = useState(category.color);
  useEffect(() => { setColor(category.color); }, [category.color]);
  return (
    <li style={{ display: "flex", alignItems: "center", gap: tokens.space.xs,
      borderBottom: `1px solid ${tokens.color.line}`, padding: tokens.space.xs }}>
      <input type="color" aria-label={`Couleur ${category.name}`} value={color}
        onChange={(e) => setColor(e.target.value)}
        onBlur={(e) => { if (e.target.value !== category.color) onRecolor(category.id, e.target.value); }}
        style={{ width: 24, height: 24, padding: 0, border: "none", background: "none" }} />
      <span style={{ flex: 1 }}>{category.name}</span>
      <button type="button" onClick={() => onRename(category.id, category.name)}>Renommer</button>
      <button type="button" onClick={() => onDelete(category)}>Supprimer</button>
    </li>
  );
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
            <CategoryRow key={c.id} category={c}
              onRecolor={(id, col) => void updateCategory(id, { color: col })}
              onRename={rename}
              onDelete={(cat) => { if (window.confirm(`Supprimer la catégorie « ${cat.name} » ?`)) void removeCategory(cat.id); }} />
          ))}
        </ul>
      )}
    </div>
  );
}
