import { useState } from "react";
import { startOfDay, addDays, draftFromEvent, emptyEventDraft, type EventDraft, type Occurrence } from "@retrorganizer/core";
import { useEvents } from "./useEvents";
import { EventForm } from "./EventForm";
import { DiaryWeek } from "./DiaryWeek";
import { DiaryDay } from "./DiaryDay";

type View = "week" | "day";

export function Diary() {
  const { events, create, update, remove } = useEvents();
  const [view, setView] = useState<View>("week");
  const [day, setDay] = useState(() => startOfDay(Date.now()));
  const [editing, setEditing] = useState<{ draft: EventDraft; id: string | null } | null>(null);

  function openNew(startMs: number) {
    setEditing({ draft: { ...emptyEventDraft(), start: startMs, end: startMs + 3600000 }, id: null });
  }
  function openEdit(o: Occurrence) {
    setEditing({ draft: draftFromEvent(o.event), id: o.event.id });
  }
  async function onSubmit(d: EventDraft) {
    if (editing?.id) await update(editing.id, d);
    else await create(d);
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

  const seg = (v: View, label: string) => (
    <button
      type="button"
      onClick={() => setView(v)}
      className={`px-3 py-1 font-label-sm text-label-sm uppercase ${view === v ? "bg-primary text-on-primary" : "bg-surface-container text-on-surface-variant"}`}
    >
      {label}
    </button>
  );

  return (
    <div className="flex flex-col min-h-full">
      <div className="shrink-0 flex items-center gap-2 mb-3">
        <div className="flex border border-outline-variant retro-outset">{seg("week", "Semaine")}{seg("day", "Jour")}</div>
        {view === "day" && (
          <div className="flex items-center gap-1 ml-auto">
            <button type="button" aria-label="Jour précédent" onClick={() => setDay((d) => addDays(d, -1))} className="text-on-surface-variant">
              <span className="material-symbols-outlined" aria-hidden>chevron_left</span>
            </button>
            <button type="button" onClick={() => setDay(startOfDay(Date.now()))} className="font-label-sm text-label-sm uppercase text-on-surface-variant">
              Aujourd'hui
            </button>
            <button type="button" aria-label="Jour suivant" onClick={() => setDay((d) => addDays(d, 1))} className="text-on-surface-variant">
              <span className="material-symbols-outlined" aria-hidden>chevron_right</span>
            </button>
          </div>
        )}
      </div>

      {view === "week" ? (
        <DiaryWeek events={events} onOpenDay={(d) => { setDay(d); setView("day"); }} onOpenEdit={openEdit} />
      ) : (
        <DiaryDay day={day} events={events} onOpenNew={openNew} onOpenEdit={openEdit} />
      )}
    </div>
  );
}
