import { tokens } from "@retrorganizer/ui";
import { sameDay, categoryById, type Occurrence, type Category } from "@retrorganizer/core";
import { CategoryTagBadges } from "../categories/CategoryTagBadges";

export interface AgendaViewProps {
  occurrences: Occurrence[];
  categories: Category[];
  onSelectOccurrence(occ: Occurrence): void;
}

function dayLabel(ms: number): string {
  return new Date(ms).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

function timeLabel(ms: number): string {
  return new Date(ms).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

export function AgendaView({ occurrences, categories, onSelectOccurrence }: AgendaViewProps) {
  if (occurrences.length === 0) {
    return <p style={{ padding: tokens.space.lg, color: tokens.color.muted }}>Aucun événement</p>;
  }
  return (
    <div style={{ font: `13px ${tokens.font.body}` }}>
      {occurrences.map((o, i) => {
        const newDay = i === 0 || !sameDay(o.start, occurrences[i - 1]!.start);
        return (
          <div key={`${o.event.id}-${o.start}`}>
            {newDay && (
              <div style={{ padding: tokens.space.xs, fontWeight: "bold", color: tokens.color.ink,
                background: tokens.color.paper, borderBottom: `1px solid ${tokens.color.line}` }}>
                {dayLabel(o.start)}
              </div>
            )}
            <button type="button" onClick={() => onSelectOccurrence(o)}
              style={{ display: "flex", gap: tokens.space.sm, width: "100%", textAlign: "left",
                border: "none", borderBottom: `1px solid ${tokens.color.line}`, background: "transparent",
                padding: tokens.space.xs, cursor: "pointer", color: tokens.color.ink }}>
              <span style={{ color: tokens.color.muted, minWidth: 48 }}>{o.event.allDay ? "Jour" : timeLabel(o.start)}</span>
              <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span>{o.event.title}</span>
                <CategoryTagBadges category={categoryById(categories, o.event.categoryId)} tags={o.event.tags ?? []} />
              </span>
            </button>
          </div>
        );
      })}
    </div>
  );
}
