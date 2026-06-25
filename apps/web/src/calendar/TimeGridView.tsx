import { tokens } from "@retrorganizer/ui";
import { sameDay, minutesIntoDay, type Occurrence } from "@retrorganizer/core";

const HOUR_PX = 36;
const HOURS = Array.from({ length: 24 }, (_, h) => h);

export interface TimeGridViewProps {
  days: number[]; // local day-start ms, 1 (day) or 7 (week)
  occurrences: Occurrence[];
  onSelectOccurrence(occ: Occurrence): void;
}

export function TimeGridView({ days, occurrences, onSelectOccurrence }: TimeGridViewProps) {
  return (
    <div style={{ display: "flex", font: `11px ${tokens.font.body}`, overflow: "auto" }}>
      <div style={{ width: 40, flexShrink: 0 }}>
        <div style={{ height: 20 }} />
        {HOURS.map((h) => (
          <div key={h} style={{ height: HOUR_PX, color: tokens.color.muted, textAlign: "right", paddingRight: 4 }}>
            {String(h).padStart(2, "0")}:00
          </div>
        ))}
      </div>
      {days.map((day) => {
        const dayOccs = occurrences.filter((o) => sameDay(o.start, day));
        const allDay = dayOccs.filter((o) => o.event.allDay);
        const timed = dayOccs.filter((o) => !o.event.allDay);
        return (
          <div key={day} data-testid="day-column"
            style={{ flex: 1, minWidth: 80, borderLeft: `1px solid ${tokens.color.line}` }}>
            <div style={{ height: 20, borderBottom: `1px solid ${tokens.color.line}`, overflow: "hidden" }}>
              {allDay.map((o) => (
                <button key={`${o.event.id}-${o.start}`} type="button" onClick={() => onSelectOccurrence(o)}
                  style={{ border: "none", background: o.event.color || tokens.color.paper, cursor: "pointer", fontSize: 10 }}>
                  {o.event.title}
                </button>
              ))}
            </div>
            <div style={{ position: "relative", height: 24 * HOUR_PX, background: tokens.color.surface }}>
              {HOURS.map((h) => (
                <div key={h} style={{ position: "absolute", top: h * HOUR_PX, left: 0, right: 0,
                  borderTop: `1px solid ${tokens.color.line}` }} />
              ))}
              {timed.map((o) => (
                <button key={`${o.event.id}-${o.start}`} type="button" onClick={() => onSelectOccurrence(o)}
                  style={{ position: "absolute", left: 2, right: 2,
                    top: (minutesIntoDay(o.start) / 60) * HOUR_PX,
                    height: Math.max(16, ((o.end - o.start) / 3600000) * HOUR_PX),
                    border: `1px solid ${tokens.color.line}`, borderRadius: tokens.radius.sm,
                    background: o.event.color || tokens.color.paper, color: tokens.color.ink,
                    textAlign: "left", padding: "1px 3px", cursor: "pointer", overflow: "hidden" }}>
                  {o.event.title}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
