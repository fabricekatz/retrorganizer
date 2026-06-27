import { useMemo, useState } from "react";
import {
  expandEvents, weekDays, startOfDay, addDays, sameDay,
  draftFromEvent, emptyEventDraft, type EventDraft, type Occurrence,
} from "@retrorganizer/core";
import { useEvents } from "./useEvents";
import { EventForm } from "./EventForm";

const DOW = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

function isoWeek(ms: number): number {
  const d = new Date(startOfDay(ms));
  const target = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNr = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNr + 3);
  const firstThursday = Date.UTC(target.getUTCFullYear(), 0, 4);
  const ftDayNr = (new Date(firstThursday).getUTCDay() + 6) % 7;
  const week1Monday = firstThursday - ftDayNr * 86400000;
  return 1 + Math.round((target.getTime() - week1Monday) / (7 * 86400000));
}

export function DiaryWeek() {
  const { events, create, update, remove } = useEvents();
  const [editing, setEditing] = useState<{ draft: EventDraft; id: string | null } | null>(null);
  const [anchor] = useState(() => Date.now());

  const days = useMemo(() => weekDays(anchor), [anchor]);
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
  function openNew(dayMs: number) {
    const start = dayMs + 9 * 3600000;
    setEditing({ draft: { ...emptyEventDraft(), start, end: start + 3600000 }, id: null });
  }
  function openEdit(o: Occurrence) {
    setEditing({ draft: draftFromEvent(o.event), id: o.event.id });
  }
  async function onSubmit(draft: EventDraft) {
    if (editing?.id) await update(editing.id, draft);
    else await create(draft);
    setEditing(null);
  }

  if (editing) {
    return (
      <div className="legacy-content">
        <EventForm initial={editing.draft} onSubmit={onSubmit} onCancel={() => setEditing(null)} />
        {editing.id && (
          <button type="button" style={{ margin: 12 }} onClick={async () => { await remove(editing.id!); setEditing(null); }}>
            Supprimer
          </button>
        )}
      </div>
    );
  }

  const monthLabel = new Date(weekStart).toLocaleDateString("fr-FR", { month: "long", year: "numeric" }).toUpperCase();
  const range = `${new Date(weekStart).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} – ${new Date(days[6]!).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}`;

  function Day({ dayMs, small }: { dayMs: number; small?: boolean }) {
    const occs = dayOccs(dayMs);
    const isToday = dayMs === today;
    const d = new Date(dayMs);
    const label = `${DOW[(d.getDay() + 6) % 7]} ${d.getDate()}`;
    return (
      <div className={isToday ? "relative bg-tertiary-fixed/30 border border-tertiary-fixed-dim/60 p-2 rounded-sm" : "border-b border-outline-variant pb-2"}>
        {isToday && (
          <div className="absolute left-[-8px] right-1 top-8 h-0.5 bg-error z-10">
            <div className="w-2 h-2 -mt-[3px] -ml-1 rounded-full bg-error" />
          </div>
        )}
        <button
          type="button"
          onClick={() => openNew(dayMs)}
          title="Ajouter un événement"
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
                  onClick={() => openEdit(o)}
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
    <div className="font-body-md text-on-surface">
      <div className="flex justify-between items-end border-b-2 border-primary mb-4 pb-1">
        <div>
          <p className="font-label-sm text-label-sm text-primary uppercase">{monthLabel}</p>
          <h2 className="font-headline-lg text-headline-lg text-on-surface -mt-1">{range}</h2>
        </div>
        <span className="font-mono-data text-mono-data text-on-surface-variant bg-secondary-fixed px-1 border border-outline whitespace-nowrap self-center">
          WEEK {isoWeek(weekStart)}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-4">
          <Day dayMs={days[0]!} />
          <Day dayMs={days[1]!} />
          <Day dayMs={days[2]!} />
        </div>
        <div className="space-y-4">
          <Day dayMs={days[3]!} />
          <Day dayMs={days[4]!} />
          <div className="grid grid-cols-2 gap-2">
            <Day dayMs={days[5]!} small />
            <Day dayMs={days[6]!} small />
          </div>
        </div>
      </div>
    </div>
  );
}
