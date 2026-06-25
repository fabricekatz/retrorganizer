import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useEvents } from "./useEvents";

const listByOwner = vi.fn();
const create = vi.fn();
vi.mock("@retrorganizer/core", () => ({
  eventsRepo: {
    listByOwner: (...a: unknown[]) => listByOwner(...a),
    create: (...a: unknown[]) => create(...a),
    update: vi.fn(),
    softDelete: vi.fn(),
  },
}));
let mockUser: { uid: string; email: string } | null = { uid: "u1", email: "a@x.io" };
vi.mock("../auth/AuthProvider", () => ({ useAuth: () => ({ user: mockUser }) }));

beforeEach(() => {
  mockUser = { uid: "u1", email: "a@x.io" };
  listByOwner.mockReset().mockResolvedValue([
    { id: "e1", ownerId: "u1", title: "X", start: 1, end: 2, allDay: false, location: "", notes: "", recurrence: null, recurrenceExceptions: [], reminderOffsets: [], contactIds: [], taskIds: [], categoryId: null, color: "", tags: [], createdAt: 1, updatedAt: 1, deletedAt: null },
  ]);
  create.mockReset().mockResolvedValue(undefined);
});

describe("useEvents", () => {
  it("loads events for the current user on mount", async () => {
    const { result } = renderHook(() => useEvents());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(listByOwner).toHaveBeenCalledWith("u1");
    expect(result.current.events.map((e) => e.id)).toEqual(["e1"]);
  });

  it("create calls repo then reloads", async () => {
    const { result } = renderHook(() => useEvents());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.create({ title: "New" } as never); });
    expect(create).toHaveBeenCalledWith("u1", { title: "New" });
    expect(listByOwner).toHaveBeenCalledTimes(2);
  });

  it("returns empty and not-loading when no user", async () => {
    mockUser = null;
    const { result } = renderHook(() => useEvents());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.events).toEqual([]);
    expect(listByOwner).not.toHaveBeenCalled();
  });

  it("sets error when create rejects", async () => {
    create.mockRejectedValue(new Error("boom"));
    const { result } = renderHook(() => useEvents());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.create({ title: "Bad" } as never); });
    expect(result.current.error).toBe("boom");
  });
});
