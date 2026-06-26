import { tokens } from "@retrorganizer/ui";
import type { Category } from "@retrorganizer/core";

export interface CategoryTagBadgesProps {
  category: Category | undefined;
  tags: string[];
}

export function CategoryTagBadges({ category, tags }: CategoryTagBadgesProps) {
  if (!category && tags.length === 0) return null;
  return (
    <span style={{ display: "inline-flex", flexWrap: "wrap", alignItems: "center", gap: tokens.space.xs }}>
      {category && (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, color: tokens.color.muted }}>
          <span aria-hidden style={{ width: 8, height: 8, borderRadius: "50%",
            background: category.color, border: `1px solid ${tokens.color.line}` }} />
          {category.name}
        </span>
      )}
      {tags.map((t) => (
        <span key={t} style={{ fontSize: 11, color: tokens.color.muted,
          border: `1px solid ${tokens.color.line}`, borderRadius: 3, padding: "0 4px" }}>
          {t}
        </span>
      ))}
    </span>
  );
}
