import type { Contact } from "./contact";
import { startOfDay } from "./calendarGrid";

export interface AnniversaryEntry {
  contactId: string;
  contactName: string;
  label: string;
  date: string;
  nextOccurrence: number;
  daysUntil: number;
  age: number | null;
}

const DAY_MS = 86400000;

/** Flattens contacts' importantDates into upcoming yearly anniversaries, soonest first. */
export function upcomingAnniversaries(contacts: Contact[], todayMs: number): AnniversaryEntry[] {
  const today = startOfDay(todayMs);
  const todayYear = new Date(today).getFullYear();
  const out: AnniversaryEntry[] = [];

  for (const c of contacts) {
    for (const d of c.importantDates) {
      const parts = d.date.split("-");
      if (parts.length !== 3) continue;
      const origYear = Number(parts[0]);
      const month = Number(parts[1]) - 1;
      const day = Number(parts[2]);
      if (Number.isNaN(month) || Number.isNaN(day)) continue;

      let next = startOfDay(new Date(todayYear, month, day).getTime());
      if (next < today) next = startOfDay(new Date(todayYear + 1, month, day).getTime());

      const occYear = new Date(next).getFullYear();
      const age = Number.isNaN(origYear) || origYear <= 0 || origYear > occYear ? null : occYear - origYear;

      out.push({
        contactId: c.id,
        contactName: c.displayName,
        label: d.label,
        date: d.date,
        nextOccurrence: next,
        daysUntil: Math.round((next - today) / DAY_MS),
        age,
      });
    }
  }
  return out.sort((a, b) => a.daysUntil - b.daysUntil);
}
