import type { Call } from "./call";

export function filterCalls(cs: Call[], q: string): Call[] {
  const needle = q.trim().toLowerCase();
  if (needle === "") return cs;
  return cs.filter((c) =>
    c.contactName.toLowerCase().includes(needle) ||
    c.phoneNumber.toLowerCase().includes(needle) ||
    c.notes.toLowerCase().includes(needle),
  );
}

export function sortCalls(cs: Call[]): Call[] {
  return [...cs].sort((a, b) => b.occurredAt - a.occurredAt);
}
