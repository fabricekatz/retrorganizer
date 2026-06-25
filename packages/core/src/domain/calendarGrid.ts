export function startOfDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function addDays(ms: number, n: number): number {
  const d = new Date(ms);
  d.setDate(d.getDate() + n);
  return d.getTime();
}

export function startOfWeek(ms: number): number {
  const sod = startOfDay(ms);
  const dow = (new Date(sod).getDay() + 6) % 7; // 0 = Monday
  return addDays(sod, -dow);
}

export function sameDay(a: number, b: number): boolean {
  return startOfDay(a) === startOfDay(b);
}

export function monthMatrix(year: number, month: number): number[] {
  const first = startOfDay(new Date(year, month, 1).getTime());
  const gridStart = startOfWeek(first);
  return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
}

export function weekDays(ms: number): number[] {
  const ws = startOfWeek(ms);
  return Array.from({ length: 7 }, (_, i) => addDays(ws, i));
}

export function minutesIntoDay(ms: number): number {
  return (ms - startOfDay(ms)) / 60000;
}
