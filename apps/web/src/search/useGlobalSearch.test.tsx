import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useGlobalSearch } from "./useGlobalSearch";

const lists = {
  contacts: vi.fn(), events: vi.fn(), tasks: vi.fn(), notes: vi.fn(),
};
vi.mock("@retrorganizer/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@retrorganizer/core")>();
  return {
    ...actual,
    contactsRepo: { listByOwner: (...a: unknown[]) => lists.contacts(...a) },
    eventsRepo: { listByOwner: (...a: unknown[]) => lists.events(...a) },
    tasksRepo: { listByOwner: (...a: unknown[]) => lists.tasks(...a) },
    notesRepo: { listByOwner: (...a: unknown[]) => lists.notes(...a) },
  };
});
vi.mock("../auth/AuthProvider", () => ({ useAuth: () => ({ user: { uid: "u1" } }) }));

const base = { ownerId: "u1", createdAt: 1, updatedAt: 1, deletedAt: null };

beforeEach(() => {
  lists.contacts.mockReset().mockResolvedValue([{ id: "c1", ...base, displayName: "Ada Lovelace", organization: "", emails: [], phones: [], addresses: [], webLinks: [], importantDates: [], customFields: [], categoryId: null, tags: [], firstName: "", lastName: "" }]);
  lists.events.mockReset().mockResolvedValue([]);
  lists.tasks.mockReset().mockResolvedValue([]);
  lists.notes.mockReset().mockResolvedValue([]);
});

describe("useGlobalSearch", () => {
  it("loads all collections and searches the in-memory index", async () => {
    const { result } = renderHook(() => useGlobalSearch());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(lists.contacts).toHaveBeenCalledWith("u1");
    act(() => result.current.setQuery("lovelace"));
    await waitFor(() => expect(result.current.results.map((r) => r.entityId)).toContain("c1"));
  });

  it("returns no results for an empty query", async () => {
    const { result } = renderHook(() => useGlobalSearch());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.results).toEqual([]);
  });
});
