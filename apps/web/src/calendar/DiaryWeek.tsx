import { useMemo } from "react";
import { expandEvents, weekDays, startOfDay, addDays, sameDay, type Event, type Occurrence } from "@retrorganizer/core";
import { DOW, isoWeek } from "./diaryUtil";

export interface DiaryWeekProps {
  events: Event[];
  onOpenDay(dayMs: number): void;
  onOpenEdit(o: Occurrence): void;
}

export function DiaryWeek({ events, onOpenDay, onOpenEdit }: DiaryWeekProps) {
  const days = useMemo(() => weekDays(Date.now()), []);
  const weekStart = days[0]!;
  const weekEndExclusive = addDays(days[6]!, 1);
  const occurrences = useMemo(
    () => expandEvents(events, weekStart, weekEndExclusive),
    [events, weekStart, weekEndExclusive],
  );
  const today = startOfDay(Date.now());

  function dayOccs(dayMs: number): Occurrence[] {
    return occurrences.filter((o) => sameDay(o.start, dayMs)).sort((a, b) => a.start - b.start);
  }

  const monthLabel = new Date(weekStart).toLocaleDateString("fr-FR", { month: "long", year: "numeric" }).toUpperCase();
  const range = `${new Date(weekStart).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} – ${new Date(days[6]!).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}`;

  function Day({ dayMs, small, grow }: { dayMs: number; small?: boolean; grow?: boolean }) {
    const occs = dayOccs(dayMs);
    const isToday = dayMs === today;
    const d = new Date(dayMs);
    const label = `${DOW[(d.getDay() + 6) % 7]} ${d.getDate()}`;
    return (
      <div
        className={[
          grow ? "flex-1 min-h-0 flex flex-col" : "",
          isToday
            ? "relative bg-tertiary-fixed/30 border border-tertiary-fixed-dim/60 p-2 rounded-sm"
            : "border-b border-outline-variant pb-2",
        ].join(" ")}
      >
        {isToday && (
          <div className="absolute left-[-8px] right-1 top-8 h-0.5 bg-error z-10">
            <div className="w-2 h-2 -mt-[3px] -ml-1 rounded-full bg-error" />
          </div>
        )}
        <button
          type="button"
          onClick={() => onOpenDay(dayMs)}
          title="Ouvrir le jour"
          className={`block font-label-sm text-label-sm uppercase mb-1 ${isToday ? "text-tertiary font-bold" : "text-primary"}`}
        >
          {label}{isToday ? " (Today)" : ""}
        </button>
        {occs.length === 0 && small ? (
          <p className="text-[10px] italic text-outline-variant">—</p>
        ) : (
          <ul className="space-y-1">
            {occs.map((o, i) => (
              <li key={`${o.event.id}-${o.start}`}>
                <button
                  type="button"
                  onClick={() => onOpenEdit(o)}
                  className={`flex items-center gap-2 text-body-md text-left w-full ${isToday && i === 0 ? "font-bold" : ""}`}
                >
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: o.event.color || "#c3c6d2" }} />
                  <span className="truncate">{o.event.title}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col font-body-md text-on-surface">
      <div className="shrink-0 flex justify-between items-end border-b-2 border-primary mb-4 pb-1">
        <div>
          <p className="font-label-sm text-label-sm text-primary uppercase">{monthLabel}</p>
          <h2 className="font-headline-lg text-headline-lg text-on-surface -mt-1">{range}</h2>
        </div>
        <span className="font-mono-data text-mono-data text-on-surface-variant bg-secondary-fixed px-1 border border-outline whitespace-nowrap self-center">
          WEEK {isoWeek(weekStart)}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4 flex-1 min-h-0">
        <div className="flex flex-col gap-3">
          <Day dayMs={days[0]!} grow />
          <Day dayMs={days[1]!} grow />
          <Day dayMs={days[2]!} grow />
        </div>
        <div className="flex flex-col gap-3">
          <Day dayMs={days[3]!} grow />
          <Day dayMs={days[4]!} grow />
          <div className="grid grid-cols-2 gap-2 flex-1 min-h-0">
            <Day dayMs={days[5]!} small grow />
            <Day dayMs={days[6]!} small grow />
          </div>
        </div>
      </div>
    </div>
  );
}
