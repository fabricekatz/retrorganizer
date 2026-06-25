import { tokens } from "@retrorganizer/ui";
import { reminderKey } from "@retrorganizer/core";
import { useReminders } from "./useReminders";

export function ReminderHost() {
  const { due, dismiss } = useReminders();
  if (due.length === 0) return null;
  return (
    <div style={{ position: "fixed", bottom: tokens.space.md, right: tokens.space.md, zIndex: 50,
      display: "flex", flexDirection: "column", gap: tokens.space.xs, width: 280 }}>
      {due.map((item) => (
        <div key={reminderKey(item)} role="status"
          style={{ background: tokens.color.surface, border: `1px solid ${tokens.color.line}`,
            borderLeft: `4px solid ${tokens.color.ink}`, borderRadius: tokens.radius.sm,
            padding: tokens.space.sm, font: `13px ${tokens.font.body}`, boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
            display: "flex", justifyContent: "space-between", alignItems: "center", gap: tokens.space.sm }}>
          <span><strong>Rappel</strong> — <span>{item.title}</span></span>
          <button type="button" aria-label="Fermer le rappel" onClick={() => dismiss(reminderKey(item))}>×</button>
        </div>
      ))}
    </div>
  );
}
