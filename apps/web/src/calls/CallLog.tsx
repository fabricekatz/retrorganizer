import { useMemo, useState } from "react";
import { filterCalls, sortCalls, draftFromCall, type Call, type CallDraft } from "@retrorganizer/core";
import { useCalls } from "./useCalls";
import { CallForm } from "./CallForm";

const DIR_ICON: Record<Call["direction"], string> = {
  incoming: "call_received",
  outgoing: "call_made",
  missed: "call_missed",
};
const MONTHS = ["JAN", "FÉV", "MAR", "AVR", "MAI", "JUI", "JUL", "AOÛ", "SEP", "OCT", "NOV", "DÉC"];
function dateLabel(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getDate()).padStart(2, "0")}-${MONTHS[d.getMonth()]}-${d.getFullYear()}`;
}

export function CallLog() {
  const { calls, create, update, remove } = useCalls();
  const [editing, setEditing] = useState<{ draft: CallDraft | undefined; id: string | null } | null>(null);
  const [query, setQuery] = useState("");

  const visible = useMemo(() => sortCalls(filterCalls(calls, query)), [calls, query]);

  async function onSubmit(draft: CallDraft) {
    if (editing?.id) await update(editing.id, draft);
    else await create(draft);
    setEditing(null);
  }

  if (editing) {
    return (
      <div className="legacy-content">
        <CallForm initial={editing.draft} onSubmit={onSubmit} onCancel={() => setEditing(null)} />
        {editing.id && (
          <button type="button" style={{ margin: 12 }} onClick={async () => { await remove(editing.id!); setEditing(null); }}>
            Supprimer
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-full font-body-md text-on-surface">
      <div className="flex items-center justify-between border-b-2 border-primary pb-2 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="material-symbols-outlined text-primary" aria-hidden>call</span>
          <h1 className="font-headline-lg text-headline-lg text-on-surface truncate">Journal d'appels</h1>
        </div>
        <span className="font-mono-data text-mono-data text-outline shrink-0">SEC: CALLS_01</span>
      </div>

      <div className="flex items-center gap-2 mb-3">
        <div className="relative flex-1 min-w-0">
          <span className="material-symbols-outlined text-outline text-base absolute left-1 top-1/2 -translate-y-1/2" aria-hidden>search</span>
          <input aria-label="Rechercher un appel" value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher…" className="w-full pl-7 pr-2 py-1 bg-transparent border-b border-outline italic focus:outline-none" />
        </div>
        <button type="button" aria-label="Nouvel appel" onClick={() => setEditing({ draft: undefined, id: null })}
          className="flex items-center gap-1 px-2 py-1 border border-outline bg-primary text-on-primary retro-outset active:retro-inset font-label-sm text-label-sm">
          <span className="material-symbols-outlined text-[18px]" aria-hidden>add_call</span>
        </button>
      </div>

      {visible.length === 0 ? (
        <p className="py-6 text-center text-on-surface-variant italic">Aucun appel</p>
      ) : (
        <div className="flex flex-col">
          {visible.map((c) => (
            <button key={c.id} type="button" onClick={() => setEditing({ draft: draftFromCall(c), id: c.id })}
              className="flex items-center gap-3 py-2 border-b border-outline-variant text-left hover:bg-primary/5">
              <span className={`material-symbols-outlined shrink-0 ${c.direction === "missed" ? "text-error" : "text-primary"}`} aria-hidden>{DIR_ICON[c.direction]}</span>
              <div className="flex-1 min-w-0">
                <div className="text-body-md truncate">{c.contactName || c.phoneNumber || "Inconnu"}</div>
                <div className="font-mono-data text-mono-data text-on-surface-variant truncate">
                  {dateLabel(c.occurredAt)}{c.durationMin > 0 ? ` · ${c.durationMin} min` : ""}{c.notes ? ` · ${c.notes}` : ""}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
