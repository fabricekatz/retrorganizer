import { describe, it, expect } from "vitest";
import { upcomingAnniversaries } from "./anniversary";
import { parseContact } from "./contact";

function contact(id: string, name: string, dates: { label: string; date: string }[]) {
  return parseContact({
    id, ownerId: "u1", createdAt: 1, updatedAt: 1, deletedAt: null,
    displayName: name, importantDates: dates,
  });
}

describe("upcomingAnniversaries", () => {
  const today = new Date(2026, 5, 15).getTime(); // 2026-06-15

  it("returns one entry per important date, sorted by soonest", () => {
    const cs = [
      contact("c1", "Ada", [{ label: "Anniversaire", date: "1990-12-10" }]),
      contact("c2", "Grace", [{ label: "Anniversaire", date: "2000-06-20" }]),
    ];
    const r = upcomingAnniversaries(cs, today);
    expect(r.map((a) => a.contactName)).toEqual(["Grace", "Ada"]); // Jun 20 before Dec 10
    expect(r[0]!.daysUntil).toBe(5);
  });

  it("rolls a passed date to next year and computes age", () => {
    const cs = [contact("c1", "Ada", [{ label: "Anniversaire", date: "1990-01-01" }])];
    const r = upcomingAnniversaries(cs, today);
    expect(new Date(r[0]!.nextOccurrence).getFullYear()).toBe(2027);
    expect(r[0]!.age).toBe(37); // 2027 - 1990
  });

  it("keeps a same-day anniversary as today (0 days)", () => {
    const cs = [contact("c1", "Ada", [{ label: "Naissance", date: "1990-06-15" }])];
    const r = upcomingAnniversaries(cs, today);
    expect(r[0]!.daysUntil).toBe(0);
    expect(r[0]!.age).toBe(36);
  });

  it("ignores contacts without important dates", () => {
    expect(upcomingAnniversaries([contact("c1", "Ada", [])], today)).toEqual([]);
  });
});
