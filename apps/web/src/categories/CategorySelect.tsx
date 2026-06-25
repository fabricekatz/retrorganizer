import { tokens } from "@retrorganizer/ui";
import { categoryById } from "@retrorganizer/core";
import { useCategories } from "./useCategories";

const CATEGORY_PALETTE = ["#2f6f4f", "#a8431f", "#1f4e79", "#b8860b", "#5b3a8c", "#9c2b4e", "#0f6e6e", "#6b6b1f"];

export interface CategorySelectProps {
  value: string | null;
  onChange(id: string | null): void;
}

export function CategorySelect({ value, onChange }: CategorySelectProps) {
  const { categories, createCategory } = useCategories();
  const selected = categoryById(categories, value);

  async function addCategory() {
    const name = window.prompt("Nom de la catégorie ?");
    if (!name || name.trim() === "") return;
    const color = CATEGORY_PALETTE[categories.length % CATEGORY_PALETTE.length]!;
    const id = await createCategory({ name: name.trim(), color });
    if (id) onChange(id);
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: tokens.space.xs }}>
      <span aria-hidden style={{ width: 10, height: 10, borderRadius: "50%",
        background: selected?.color ?? "transparent", border: `1px solid ${tokens.color.line}` }} />
      <select aria-label="Catégorie" value={value ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? null : e.target.value)}>
        <option value="">Aucune</option>
        {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      <button type="button" onClick={addCategory}>+ Catégorie</button>
    </div>
  );
}
