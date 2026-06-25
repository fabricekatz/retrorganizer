import { describe, it, expect } from "vitest";
import { startOfDay, addDays, startOfWeek, sameDay, monthMatrix, weekDays, minutesIntoDay } from "./calendarGrid";

describe("calendarGrid", () => {
  it("startOfDay zeroes the time of day (local)", () => {
    const noon = new Date(2026, 0, 15, 12, 30).getTime();
    const sod = startOfDay(noon);
    expect(new Date(sod).getHours()).toBe(0);
    expect(new Date(sod).getMinutes()).toBe(0);
    expect(sameDay(sod, noon)).toBe(true);
  });

  it("addDays advances by whole days", () => {
    const d = new Date(2026, 0, 31).getTime();
    expect(new Date(addDays(d, 1)).getDate()).toBe(1); // Feb 1
    expect(new Date(addDays(d, 1)).getMonth()).toBe(1);
  });

  it("startOfWeek returns the Monday 00:00", () => {
    // 2026-01-15 is a Thursday
    const ws = startOfWeek(new Date(2026, 0, 15, 9).getTime());
    expect(new Date(ws).getDay()).toBe(1); // Monday
    expect(new Date(ws).getHours()).toBe(0);
    expect(new Date(ws).getDate()).toBe(12); // Mon 2026-01-12
  });

  it("monthMatrix returns 42 consecutive day-starts beginning on a Monday", () => {
    const cells = monthMatrix(2026, 0); // January 2026
    expect(cells).toHaveLength(42);
    expect(new Date(cells[0]!).getDay()).toBe(1); // Monday
    for (let i = 1; i < cells.length; i++) {
      expect(cells[i]).toBe(addDays(cells[i - 1]!, 1));
    }
  });

  it("weekDays returns 7 day-starts Mon..Sun", () => {
    const days = weekDays(new Date(2026, 0, 15).getTime());
    expect(days).toHaveLength(7);
    expect(new Date(days[0]!).getDay()).toBe(1);
    expect(new Date(days[6]!).getDay()).toBe(0); // Sunday
  });

  it("minutesIntoDay measures local minutes since midnight", () => {
    const t = startOfDay(new Date(2026, 0, 15).getTime()) + 90 * 60000;
    expect(minutesIntoDay(t)).toBe(90);
  });
});
