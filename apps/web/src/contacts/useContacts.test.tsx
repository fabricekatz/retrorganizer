import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useContacts } from "./useContacts";

const listByOwner = vi.fn();
const create = vi.fn();
const softDelete = vi.fn();
vi.mock("@retrorganizer/core", () => ({
  contactsRepo: {
    listByOwner: (...a: unknown[]) => listByOwner(...a),
    create: (...a: unknown[]) => create(...a),
    update: vi.fn(),
    softDelete: (...a: unknown[]) => softDelete(...a),
  },
}));

let mockUser: { uid: string; email: string } | null = { uid: "u1", email: "a@x.io" };
vi.mock("../auth/AuthProvider", () => ({ useAuth: () => ({ user: mockUser }) }));

beforeEach(() => {
  mockUser = { uid: "u1", email: "a@x.io" };
  listByOwner.mockReset().mockResolvedValue([
    { id: "c1", ownerId: "u1", displayName: "Ada", phones: [], emails: [], addresses: [], webLinks: [], importantDates: [], customFields: [], categoryId: null, tags: [], firstName: "", lastName: "", createdAt: 1, updatedAt: 1, deletedAt: null },
  ]);
  create.mockReset().mockResolvedValue(undefined);
  softDelete.mockReset().mockResolvedValue(undefined);
});

describe("useContacts", () => {
  it("loads contacts for the current user on mount", async () => {
    const { result } = renderHook(() => useContacts());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(listByOwner).toHaveBeenCalledWith("u1");
    expect(result.current.contacts.map((c) => c.id)).toEqual(["c1"]);
  });

  it("create calls repo then reloads", async () => {
    const { result } = renderHook(() => useContacts());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.create({ displayName: "Grace" } as never); });
    expect(create).toHaveBeenCalledWith("u1", { displayName: "Grace" });
    expect(listByOwner).toHaveBeenCalledTimes(2);
  });

  it("returns empty contacts without loading when user is null", async () => {
    mockUser = null;
    const { result } = renderHook(() => useContacts());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.contacts).toEqual([]);
    expect(listByOwner).not.toHaveBeenCalled();
  });

  it("sets error state when listByOwner rejects", async () => {
    listByOwner.mockRejectedValue(new Error("boom"));
    const { result } = renderHook(() => useContacts());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe("boom");
    expect(result.current.contacts).toEqual([]);
  });

  it("surfaces a load error (not a save error) when reload fails after a successful create", async () => {
    // first load ok, create ok, reload (2nd listByOwner) rejects
    listByOwner.mockReset()
      .mockResolvedValueOnce([])
      .mockRejectedValueOnce(new Error("load failed"));
    create.mockReset().mockResolvedValue(undefined);
    const { result } = renderHook(() => useContacts());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.create({ displayName: "Z" } as never); });
    expect(create).toHaveBeenCalled();
    expect(result.current.error).toBe("load failed");
  });
});
