import { useMemo, useState } from "react";
import { tokens } from "@retrorganizer/ui";
import {
  expandEvents, monthMatrix, weekDays, startOfDay, addDays,
  draftFromEvent, emptyEventDraft, eventsToICS, icsToEventDrafts,
  type Event, type EventDraft, type Occurrence,
} from "@retrorganizer/core";
import { useEvents } from "./useEvents";
import { MonthView } from "./MonthView";
import { AgendaView } from "./AgendaView";
import { TimeGridView } from "./TimeGridView";
import { EventForm } from "./EventForm";

type View = "month" | "week" | "day" | "agenda";

function range(view: View, anchor: number): [number, number] {
  if (view === "month") {
    const cells = monthMatrix(new Date(anchor).getFullYear(), new Date(anchor).getMonth());
    return [cells[0]!, addDays(cells[41]!, 1)];
  }
  if (view === "week") {
    const days = weekDays(anchor);
    return [days[0]!, addDays(days[6]!, 1)];
  }
  if (view === "day") {
    const sod = startOfDay(anchor);
    return [sod, addDays(sod, 1)];
  }
  const sod = startOfDay(anchor);
  return [sod, addDays(sod, 30)];
}

function shift(view: View, anchor: number, dir: number): number {
  if (view === "month") {
    const d = new Date(anchor);
    d.setMonth(d.getMonth() + dir);
    return d.getTime();
  }
  if (view === "week") return addDays(anchor, 7 * dir);
  if (view === "agenda") return addDays(anchor, 30 * dir);
  return addDays(anchor, dir);
}

export interface CalendarModuleProps {
  initialAnchor?: number;
}

export function CalendarModule({ initialAnchor }: CalendarModuleProps) {
  const { events, loading, error, create, update, remove } = useEvents();
  const [view, setView] = useState<View>("month");
  const [anchor, setAnchor] = useState<number>(initialAnchor ?? startOfDay(Date.now()));
  const [editing, setEditing] = useState<{ draft: EventDraft; id: string | null } | null>(null);

  const [rangeStart, rangeEnd] = range(view, anchor);
  const occurrences = useMemo(
    () => expandEvents(events, rangeStart, rangeEnd),
    [events, rangeStart, rangeEnd],
  );

  function newOnDay(dayStartMs: number) {
    const start = dayStartMs + 9 * 3600000;
    setEditing({ draft: { ...emptyEventDraft(), start, end: start + 3600000 }, id: null });
  }
  function openOccurrence(occ: Occurrence) {
    setEditing({ draft: draftFromEvent(occ.event), id: occ.event.id });
  }
  async function onSubmit(draft: EventDraft) {
    if (editing?.id) await update(editing.id, draft);
    else await create(draft);
    setEditing(null);
  }
  async function onImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const drafts = icsToEventDrafts(await file.text());
    for (const d of drafts) await create(d);
    e.target.value = "";
  }
  function exportICS() {
    const blob = new Blob([eventsToICS(events)], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "retrorganizer.ics"; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  const btn = (v: View, label: string) => (
    <button type="button" onClick={() => setView(v)}
      style={{ fontWeight: view === v ? "bold" : "normal" }}>{label}</button>
  );

  if (editing) {
    return (
      <div>
        <EventForm initial={editing.draft} onSubmit={onSubmit} onCancel={() => setEditing(null)} />
        {editing.id && (
          <button type="button" style={{ margin: tokens.space.md }}
            onClick={async () => { await remove(editing.id!); setEditing(null); }}>Supprimer</button>
        )}
      </div>
    );
  }

  return (
    <div style={{ font: `13px ${tokens.font.body}` }}>
      <div style={{ display: "flex", gap: tokens.space.sm, alignItems: "center", flexWrap: "wrap",
        padding: tokens.space.sm, borderBottom: `1px solid ${tokens.color.line}` }}>
        {btn("month", "Mois")}{btn("week", "Semaine")}{btn("day", "Jour")}{btn("agenda", "Agenda")}
        <span style={{ width: tokens.space.md }} />
        <button type="button" onClick={() => setAnchor(shift(view, anchor, -1))}>‹</button>
        <button type="button" onClick={() => setAnchor(initialAnchor ?? startOfDay(Date.now()))}>Aujourd'hui</button>
        <button type="button" onClick={() => setAnchor(shift(view, anchor, 1))}>›</button>
        <span style={{ flex: 1 }} />
        <button type="button" onClick={() => newOnDay(startOfDay(anchor))}>+ Nouvel événement</button>
        <button type="button" onClick={exportICS}>Exporter ICS</button>
        <label style={{ cursor: "pointer" }}>Importer ICS
          <input type="file" accept=".ics,text/calendar" aria-label="Importer ICS" onChange={onImport} style={{ display: "none" }} />
        </label>
      </div>

      {error && <p role="alert" style={{ color: "#a8431f", padding: tokens.space.sm }}>{error}</p>}
      {loading ? <p style={{ padding: tokens.space.lg }}>Chargement…</p> : (
        view === "month" ? (
          <MonthView year={new Date(anchor).getFullYear()} month={new Date(anchor).getMonth()}
            occurrences={occurrences} onSelectDay={newOnDay} onSelectOccurrence={openOccurrence} />
        ) : view === "agenda" ? (
          <AgendaView occurrences={occurrences} onSelectOccurrence={openOccurrence} />
        ) : (
          <TimeGridView days={view === "day" ? [startOfDay(anchor)] : weekDays(anchor)}
            occurrences={occurrences} onSelectOccurrence={openOccurrence} />
        )
      )}
    </div>
  );
}
