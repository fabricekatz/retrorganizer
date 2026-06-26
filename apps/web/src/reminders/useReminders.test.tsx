import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useReminders } from "./useReminders";

const T0 = Date.UTC(2026, 0, 5, 9, 0, 0);
const MIN = 60000;

// An event whose 10-min reminder fires 30s after T0 (inside the first 60s tick window).
const event = {
  id: "e1", ownerId: "u1", createdAt: 1, updatedAt: 1, deletedAt: null,
  title: "Réunion", start: T0 + 10 * MIN + 30000, end: T0 + 70 * MIN,
  allDay: false, location: "", notes: "", recurrence: null, recurrenceExceptions: [],
  reminderOffsets: [10], contactIds: [], taskIds: [], categoryId: null, color: "", tags: [],
};

// A task whose 0-min reminder fires 30s after T0 (dueDate falls inside the first 60s tick).
const taskFixture = {
  id: "t1", ownerId: "u1", createdAt: 1, updatedAt: 1, deletedAt: null,
  title: "Finir rapport", description: "", priority: "normal" as const,
  dueDate: T0 + 30000, status: "todo" as const, completedAt: null,
  subtasks: [], recurrence: null, contactIds: [], eventId: null,
  categoryId: null, tags: [], reminderOffsets: [0],
};

// Mutable so individual tests can inject tasks (or leave empty).
let mockTasks: typeof taskFixture[] = [];

vi.mock("../calendar/useEvents", () => ({ useEvents: () => ({ events: [event] }) }));
vi.mock("../tasks/useTasks", () => ({ useTasks: () => ({ tasks: mockTasks }) }));

const notifCtor = vi.fn();
class MockNotification {
  static permission = "granted";
  static requestPermission = vi.fn().mockResolvedValue("granted");
  constructor(title: string, opts?: unknown) { notifCtor(title, opts); }
}

beforeEach(() => {
  mockTasks = []; // default: no tasks, so existing event tests are unaffected
  vi.useFakeTimers();
  vi.setSystemTime(T0);
  notifCtor.mockReset();
  vi.stubGlobal("Notification", MockNotification);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("useReminders", () => {
  it("fires a due reminder on the interval tick (in-app + Notification)", () => {
    const { result } = renderHook(() => useReminders());
    expect(result.current.due).toEqual([]);
    act(() => { vi.advanceTimersByTime(60 * 1000); }); // now = T0 + 60s
    expect(result.current.due).toHaveLength(1);
    expect(result.current.due[0]!.entityId).toBe("e1");
    expect(notifCtor).toHaveBeenCalledTimes(1);
    expect(notifCtor.mock.calls[0]![0]).toBe("Réunion");
  });

  it("dismiss removes a due reminder", () => {
    const { result } = renderHook(() => useReminders());
    act(() => { vi.advanceTimersByTime(60 * 1000); });
    const key = `${result.current.due[0]!.entityId}:${result.current.due[0]!.occurrenceStart}:${result.current.due[0]!.fireAt}`;
    act(() => { result.current.dismiss(key); });
    expect(result.current.due).toEqual([]);
  });

  it("fires a due task reminder on the interval tick (in-app + Notification)", () => {
    mockTasks = [taskFixture];
    const { result } = renderHook(() => useReminders());
    expect(result.current.due).toEqual([]);
    act(() => { vi.advanceTimersByTime(60 * 1000); }); // now = T0 + 60s
    const taskHit = result.current.due.find((h) => h.entityId === "t1");
    expect(taskHit).toBeDefined();
    expect(taskHit!.type).toBe("task");
    expect(notifCtor).toHaveBeenCalledWith("Finir rapport", { body: "Rappel de tâche" });
  });
});
