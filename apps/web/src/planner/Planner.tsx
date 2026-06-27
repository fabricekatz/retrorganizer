// apps/web/src/planner/Planner.tsx
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { yearMonthBuckets } from "@retrorganizer/core";
import { useEvents } from "../calendar/useEvents";
import { useTasks } from "../tasks/useTasks";

const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const MONTHS_ABBR = ["JANV", "FÉVR", "MARS", "AVR", "MAI", "JUIN", "JUIL", "AOÛT", "SEPT", "OCT", "NOV", "DÉC"];

export function Planner() {
  const { events } = useEvents();
  const { tasks } = useTasks();
  const navigate = useNavigate();
  const [year, setYear] = useState(() => new Date().getFullYear());

  const buckets = useMemo(() => yearMonthBuckets(year, events, tasks), [year, events, tasks]);
  const totalEvents = buckets.reduce((n, b) => n + b.eventCount, 0);
  const totalTasks = buckets.reduce((n, b) => n + b.taskCount, 0);

  return (
    <div className="flex flex-col min-h-full font-body-md text-on-surface">
      {/* Header */}
      <div className="flex items-center justify-between border-b-2 border-primary pb-2 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="material-symbols-outlined text-primary" aria-hidden>calendar_month</span>
          <h1 className="font-headline-lg text-headline-lg text-on-surface truncate">Planner {year}</h1>
        </div>
        <span className="font-mono-data text-mono-data text-outline shrink-0">SEC: PLANNER_01</span>
      </div>

      {/* Year navigation */}
      <div className="flex items-center justify-center gap-4 mb-4 font-label-sm text-label-sm">
        <button type="button" aria-label="Année précédente" onClick={() => setYear((y) => y - 1)}
          className="px-2 py-1 border border-outline retro-outset active:retro-inset">‹</button>
        <span className="font-headline-md text-headline-md">{year}</span>
        <button type="button" aria-label="Année suivante" onClick={() => setYear((y) => y + 1)}
          className="px-2 py-1 border border-outline retro-outset active:retro-inset">›</button>
      </div>

      {/* 12-month grid */}
      <div className="grid grid-cols-3 gap-2 flex-1">
        {buckets.map((b) => {
          const empty = b.eventCount === 0 && b.taskCount === 0;
          return (
            <button
              key={b.month}
              type="button"
              aria-label={`${MONTHS[b.month]} ${year}`}
              onClick={() => navigate("/diary")}
              className={`flex flex-col items-start p-2 border border-outline-variant text-left hover:bg-primary/5 ${empty ? "bg-surface-container/40" : "bg-white/50"}`}
            >
              <span className="font-label-sm text-label-sm uppercase text-on-surface-variant">{MONTHS_ABBR[b.month]}</span>
              <span className="font-mono-data text-mono-data text-on-surface-variant mt-1">
                {b.eventCount} évén.
              </span>
              <span className="font-mono-data text-mono-data text-on-surface-variant">
                {b.taskCount} tâche{b.taskCount > 1 ? "s" : ""}
              </span>
            </button>
          );
        })}
      </div>

      {/* Footer summary */}
      <p className="mt-3 text-center font-mono-data text-mono-data text-outline">
        {totalEvents} événement{totalEvents > 1 ? "s" : ""} · {totalTasks} tâche{totalTasks > 1 ? "s" : ""} en {year}
      </p>
    </div>
  );
}
