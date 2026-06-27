import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

const listByOwner = vi.fn();
const create = vi.fn();
const update = vi.fn();
const softDelete = vi.fn();
vi.mock("@retrorganizer/core", () => ({
  callsRepo: {
    listByOwner: (...a: unknown[]) => listByOwner(...a),
    create: (...a: unknown[]) => create(...a),
    update: (...a: unknown[]) => update(...a),
    softDelete: (...a: unknown[]) => softDelete(...a),
  },
}));
vi.mock("../auth/AuthProvider", () => ({ useAuth: () => ({ user: { uid: "u1" } }) }));

import { useCalls } from "./useCalls";

beforeEach(() => {
  listByOwner.mockReset().mockResolvedValue([{ id: "c1", contactName: "Ada", occurredAt: 1 }]);
  create.mockReset().mockResolvedValue(undefined);
  update.mockReset().mockResolvedValue(undefined);
  softDelete.mockReset().mockResolvedValue(undefined);
});

describe("useCalls", () => {
  it("loads calls for the current user", async () => {
    const { result } = renderHook(() => useCalls());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(listByOwner).toHaveBeenCalledWith("u1");
    expect(result.current.calls).toHaveLength(1);
  });

  it("removes then reloads", async () => {
    const { result } = renderHook(() => useCalls());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.remove("c1"); });
    expect(softDelete).toHaveBeenCalledWith("c1");
    expect(listByOwner).toHaveBeenCalledTimes(2);
  });
});
