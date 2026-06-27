import { useMemo } from "react";
import { upcomingAnniversaries, type AnniversaryEntry } from "@retrorganizer/core";
import { useContacts } from "../contacts/useContacts";

const MONTHS_SHORT = ["JANV", "FÉVR", "MARS", "AVR", "MAI", "JUIN", "JUIL", "AOÛT", "SEPT", "OCT", "NOV", "DÉC"];

function whenLabel(a: AnniversaryEntry): string {
  if (a.daysUntil === 0) return "AUJOURD'HUI";
  if (a.daysUntil === 1) return "DEMAIN";
  return `DANS ${a.daysUntil} JOURS`;
}

export function Anniversary() {
  const { contacts } = useContacts();
  const entries = useMemo(() => upcomingAnniversaries(contacts, Date.now()), [contacts]);

  return (
    <div className="flex flex-col min-h-full font-body-md text-on-surface">
      <div className="flex items-center justify-between border-b-2 border-primary pb-2 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="material-symbols-outlined text-primary" aria-hidden>cake</span>
          <h1 className="font-headline-lg text-headline-lg text-on-surface truncate">Anniversaires</h1>
        </div>
        <span className="font-mono-data text-mono-data text-outline shrink-0">SEC: ANNIV_01</span>
      </div>

      {entries.length === 0 ? (
        <p className="py-6 text-center text-on-surface-variant italic">Aucun anniversaire à venir</p>
      ) : (
        <div className="flex flex-col">
          {entries.map((a) => {
            const d = new Date(a.nextOccurrence);
            return (
              <div key={`${a.contactId}:${a.date}:${a.label}`}
                className={`flex items-center gap-3 py-2 border-b border-outline-variant ${a.daysUntil === 0 ? "bg-tertiary-fixed" : ""}`}>
                <div className="flex flex-col items-center justify-center w-12 shrink-0 border border-outline-variant py-1 bg-white/50">
                  <span className="font-mono-data text-mono-data text-on-surface-variant">{MONTHS_SHORT[d.getMonth()]}</span>
                  <span className="font-headline-md text-headline-md leading-none">{d.getDate()}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-body-md text-body-md truncate">{a.contactName}</div>
                  <div className="font-mono-data text-mono-data text-on-surface-variant">
                    {a.label}{a.age !== null ? ` · ${a.age} ans` : ""}
                  </div>
                </div>
                <span className="font-label-sm text-label-sm uppercase text-primary shrink-0">{whenLabel(a)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
