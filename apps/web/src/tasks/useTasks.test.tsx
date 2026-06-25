import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useTasks } from "./useTasks";

const listByOwner = vi.fn();
const create = vi.fn();
const update = vi.fn();
vi.mock("@retrorganizer/core", () => ({
  tasksRepo: {
    listByOwner: (...a: unknown[]) => listByOwner(...a),
    create: (...a: unknown[]) => create(...a),
    update: (...a: unknown[]) => update(...a),
    softDelete: vi.fn(),
  },
}));
let mockUser: { uid: string; email: string } | null = { uid: "u1", email: "a@x.io" };
vi.mock("../auth/AuthProvider", () => ({ useAuth: () => ({ user: mockUser }) }));

beforeEach(() => {
  mockUser = { uid: "u1", email: "a@x.io" };
  listByOwner.mockReset().mockResolvedValue([
    { id: "t1", ownerId: "u1", title: "X", description: "", priority: "normal", dueDate: null, status: "todo", completedAt: null, subtasks: [], recurrence: null, contactIds: [], eventId: null, categoryId: null, tags: [], createdAt: 1, updatedAt: 1, deletedAt: null },
  ]);
  create.mockReset().mockResolvedValue(undefined);
  update.mockReset().mockResolvedValue(undefined);
});

describe("useTasks", () => {
  it("loads tasks on mount", async () => {
    const { result } = renderHook(() => useTasks());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(listByOwner).toHaveBeenCalledWith("u1");
    expect(result.current.tasks.map((t) => t.id)).toEqual(["t1"]);
  });

  it("update patches then reloads", async () => {
    const { result } = renderHook(() => useTasks());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.update("t1", { status: "done" }); });
    expect(update).toHaveBeenCalledWith("t1", { status: "done" });
    expect(listByOwner).toHaveBeenCalledTimes(2);
  });

  it("returns empty/not-loading with no user", async () => {
    mockUser = null;
    const { result } = renderHook(() => useTasks());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.tasks).toEqual([]);
    expect(listByOwner).not.toHaveBeenCalled();
  });
});
