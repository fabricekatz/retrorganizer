import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

const listByOwner = vi.fn();
const create = vi.fn();
const update = vi.fn();
const softDelete = vi.fn();
vi.mock("@retrorganizer/core", () => ({
  bookmarksRepo: {
    listByOwner: (...a: unknown[]) => listByOwner(...a),
    create: (...a: unknown[]) => create(...a),
    update: (...a: unknown[]) => update(...a),
    softDelete: (...a: unknown[]) => softDelete(...a),
  },
}));
vi.mock("../auth/AuthProvider", () => ({ useAuth: () => ({ user: { uid: "u1" } }) }));

import { useBookmarks } from "./useBookmarks";

beforeEach(() => {
  listByOwner.mockReset().mockResolvedValue([{ id: "b1", title: "X", url: "u" }]);
  create.mockReset().mockResolvedValue(undefined);
  update.mockReset().mockResolvedValue(undefined);
  softDelete.mockReset().mockResolvedValue(undefined);
});

describe("useBookmarks", () => {
  it("loads bookmarks for the current user", async () => {
    const { result } = renderHook(() => useBookmarks());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(listByOwner).toHaveBeenCalledWith("u1");
    expect(result.current.bookmarks).toHaveLength(1);
  });

  it("creates then reloads", async () => {
    const { result } = renderHook(() => useBookmarks());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.create({ title: "Y", url: "v", description: "", categoryId: null, tags: [] }); });
    expect(create).toHaveBeenCalledWith("u1", { title: "Y", url: "v", description: "", categoryId: null, tags: [] });
    expect(listByOwner).toHaveBeenCalledTimes(2);
  });
});
