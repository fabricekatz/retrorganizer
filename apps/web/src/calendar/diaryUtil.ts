import { startOfDay } from "@retrorganizer/core";

/** ISO week number for the week containing `ms`. */
export function isoWeek(ms: number): number {
  const d = new Date(startOfDay(ms));
  const target = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNr = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNr + 3);
  const firstThursday = Date.UTC(target.getUTCFullYear(), 0, 4);
  const ftDayNr = (new Date(firstThursday).getUTCDay() + 6) % 7;
  const week1Monday = firstThursday - ftDayNr * 86400000;
  return 1 + Math.round((target.getTime() - week1Monday) / (7 * 86400000));
}

export const DOW = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
