import { useState } from "react";
import { tokens } from "@retrorganizer/ui";
import { emptyBookmarkDraft, type BookmarkDraft } from "@retrorganizer/core";
import { CategorySelect } from "../categories/CategorySelect";
import { TagInput } from "../categories/TagInput";

export interface BookmarkFormProps {
  initial?: BookmarkDraft;
  onSubmit(draft: BookmarkDraft): void;
  onCancel(): void;
}

export function BookmarkForm({ initial, onSubmit, onCancel }: BookmarkFormProps) {
  const [draft, setDraft] = useState<BookmarkDraft>(initial ?? emptyBookmarkDraft());
  function set<K extends keyof BookmarkDraft>(key: K, value: BookmarkDraft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }
  function submit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit(draft);
  }
  return (
    <form onSubmit={submit} style={{ padding: tokens.space.md, font: `13px ${tokens.font.body}`, display: "grid", gap: tokens.space.sm }}>
      <label>Titre
        <input aria-label="Titre" value={draft.title} onChange={(e) => set("title", e.target.value)} style={{ display: "block", width: "100%" }} />
      </label>
      <label>URL
        <input aria-label="URL" value={draft.url} onChange={(e) => set("url", e.target.value)} style={{ display: "block", width: "100%" }} />
      </label>
      <label>Description
        <textarea aria-label="Description" value={draft.description} onChange={(e) => set("description", e.target.value)} style={{ display: "block", width: "100%" }} />
      </label>
      <label>Catégorie
        <CategorySelect value={draft.categoryId} onChange={(id) => set("categoryId", id)} />
      </label>
      <label>Tags
        <TagInput value={draft.tags} onChange={(tags) => set("tags", tags)} />
      </label>
      <div style={{ display: "flex", gap: tokens.space.sm }}>
        <button type="submit">Enregistrer</button>
        <button type="button" onClick={onCancel}>Annuler</button>
      </div>
    </form>
  );
}
