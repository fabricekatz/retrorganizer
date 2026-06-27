import { useMemo } from "react";
import { expandEvents, startOfDay, addDays, type Event, type Occurrence } from "@retrorganizer/core";
import { isoWeek } from "./diaryUtil";

export interface DiaryDayProps {
  day: number;
  events: Event[];
  onOpenNew(startMs: number): void;
  onOpenEdit(o: Occurrence): void;
}

function NowLine() {
  return (
    <div className="relative h-0.5 bg-error my-1 ml-12 z-10">
      <div className="absolute left-0 -top-[3px] w-2 h-2 -ml-1 rounded-full bg-error" />
    </div>
  );
}

export function DiaryDay({ day, events, onOpenNew, onOpenEdit }: DiaryDayProps) {
  const start = startOfDay(day);
  const end = addDays(start, 1);
  const occs = useMemo(
    () => expandEvents(events, start, end).sort((a, b) => a.start - b.start),
    [events, start, end],
  );
  const now = Date.now();
  const isToday = startOfDay(now) === start;
  const nowIndex = isToday ? occs.findIndex((o) => o.start > now) : -1;

  const d = new Date(start);
  const monthLabel = d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" }).toUpperCase();
  const dayLabel = d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric" });
  const timeLabel = (ms: number) => new Date(ms).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="flex-1 min-h-0 flex flex-col font-body-md text-on-surface">
      <div className="shrink-0 flex justify-between items-end border-b-2 border-primary mb-4 pb-1">
        <div>
          <p className="font-label-sm text-label-sm text-primary uppercase">{monthLabel}</p>
          <h2 className="font-headline-lg text-headline-lg text-on-surface -mt-1 capitalize">{dayLabel}</h2>
        </div>
        <div className="flex items-center gap-2 self-center">
          <span className="font-mono-data text-mono-data text-on-surface-variant bg-secondary-fixed px-1 border border-outline">WEEK {isoWeek(start)}</span>
          <button
            type="button"
            aria-label="Ajouter un événement"
            onClick={() => onOpenNew(start + 9 * 3600000)}
            className="w-7 h-7 flex items-center justify-center border border-outline bg-surface-container-low retro-outset active:retro-inset"
          >
            <span className="material-symbols-outlined text-base" aria-hidden>add</span>
          </button>
        </div>
      </div>

      <div className="flex-1 relative">
        <div className="absolute left-[52px] top-0 bottom-0 w-px bg-outline-variant/50" />
        {occs.length === 0 && (
          <p className="italic text-on-surface-variant ml-16 py-4">Aucun événement. Touchez ＋ pour en ajouter.</p>
        )}
        {occs.map((o, i) => {
          const ongoing = isToday && o.start <= now && o.end > now;
          return (
            <div key={`${o.event.id}-${o.start}`}>
              {i === nowIndex && <NowLine />}
              <button
                type="button"
                onClick={() => onOpenEdit(o)}
                className={`w-full flex gap-4 items-start py-2 text-left hover:bg-primary/5 transition-colors ${ongoing ? "bg-tertiary-fixed/30 border-y border-tertiary-fixed-dim/50" : ""}`}
              >
                <div className="w-12 text-right shrink-0">
                  <span className={`font-mono-data text-mono-data ${ongoing ? "text-tertiary font-bold" : "text-outline"}`}>
                    {o.event.allDay ? "Jour" : timeLabel(o.start)}
                  </span>
                </div>
                <div className="flex-1 flex items-start gap-3 min-w-0">
                  <span className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background: o.event.color || "#c3c6d2" }} />
                  <div className="flex-1 min-w-0">
                    <p className={`font-body-md text-body-md ${ongoing ? "text-on-surface font-bold" : "text-on-surface-variant"}`}>{o.event.title}</p>
                    {o.event.location && <p className="font-label-sm text-label-sm italic text-on-surface-variant truncate">{o.event.location}</p>}
                  </div>
                </div>
              </button>
            </div>
          );
        })}
        {isToday && nowIndex === -1 && occs.length > 0 && <NowLine />}
      </div>
    </div>
  );
}
