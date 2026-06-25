import { tokens } from "@retrorganizer/ui";
import { monthMatrix, sameDay, type Occurrence } from "@retrorganizer/core";

const WEEKDAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

export interface MonthViewProps {
  year: number;
  month: number; // 0-11
  occurrences: Occurrence[];
  onSelectDay(dayStartMs: number): void;
  onSelectOccurrence(occ: Occurrence): void;
}

export function MonthView({ year, month, occurrences, onSelectDay, onSelectOccurrence }: MonthViewProps) {
  const cells = monthMatrix(year, month);
  return (
    <div style={{ font: `12px ${tokens.font.body}` }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", borderBottom: `1px solid ${tokens.color.line}` }}>
        {WEEKDAYS.map((w) => (
          <div key={w} style={{ padding: tokens.space.xs, textAlign: "center", color: tokens.color.muted }}>{w}</div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
        {cells.map((cell) => {
          const inMonth = new Date(cell).getMonth() === month;
          const dayOccs = occurrences.filter((o) => sameDay(o.start, cell));
          return (
            <div key={cell} data-testid="month-cell" onClick={() => onSelectDay(cell)}
              style={{ minHeight: 72, border: `1px solid ${tokens.color.line}`, padding: tokens.space.xs,
                background: tokens.color.surface, cursor: "pointer",
                color: inMonth ? tokens.color.ink : tokens.color.muted }}>
              <div style={{ textAlign: "right" }}>{new Date(cell).getDate()}</div>
              {dayOccs.map((o, i) => (
                <button key={i} type="button"
                  onClick={(e) => { e.stopPropagation(); onSelectOccurrence(o); }}
                  style={{ display: "block", width: "100%", textAlign: "left", border: "none",
                    borderRadius: tokens.radius.sm, marginTop: 2, padding: "1px 4px", cursor: "pointer",
                    background: o.event.color || tokens.color.paper, color: tokens.color.ink,
                    overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                  {o.event.title}
                </button>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
