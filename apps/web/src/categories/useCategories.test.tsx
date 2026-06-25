import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useCategories } from "./useCategories";

const listByOwner = vi.fn();
const create = vi.fn();
vi.mock("@retrorganizer/core", () => ({
  categoriesRepo: {
    listByOwner: (...a: unknown[]) => listByOwner(...a),
    create: (...a: unknown[]) => create(...a),
    update: vi.fn(),
    softDelete: vi.fn(),
  },
}));
let mockUser: { uid: string } | null = { uid: "u1" };
vi.mock("../auth/AuthProvider", () => ({ useAuth: () => ({ user: mockUser }) }));

beforeEach(() => {
  mockUser = { uid: "u1" };
  listByOwner.mockReset().mockResolvedValue([{ id: "cat1", ownerId: "u1", name: "Travail", color: "#f00", createdAt: 1, updatedAt: 1, deletedAt: null }]);
  create.mockReset().mockResolvedValue({ id: "cat2", ownerId: "u1", name: "Perso", color: "#0f0", createdAt: 1, updatedAt: 1, deletedAt: null });
});

describe("useCategories", () => {
  it("loads categories on mount", async () => {
    const { result } = renderHook(() => useCategories());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.categories.map((c) => c.id)).toEqual(["cat1"]);
  });

  it("createCategory returns the new id and reloads", async () => {
    const { result } = renderHook(() => useCategories());
    await waitFor(() => expect(result.current.loading).toBe(false));
    let newId: string | null = null;
    await act(async () => { newId = await result.current.createCategory({ name: "Perso", color: "#0f0" }); });
    expect(newId).toBe("cat2");
    expect(create).toHaveBeenCalledWith("u1", { name: "Perso", color: "#0f0" });
    expect(listByOwner).toHaveBeenCalledTimes(2);
  });

  it("returns empty/not-loading with no user", async () => {
    mockUser = null;
    const { result } = renderHook(() => useCategories());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.categories).toEqual([]);
    expect(listByOwner).not.toHaveBeenCalled();
  });
});
