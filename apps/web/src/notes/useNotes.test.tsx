import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useNotes } from "./useNotes";

const sectionsList = vi.fn();
const notesList = vi.fn();
const createNote = vi.fn();
vi.mock("@retrorganizer/core", () => ({
  noteSectionsRepo: { listByOwner: (...a: unknown[]) => sectionsList(...a), create: vi.fn(), softDelete: vi.fn() },
  notesRepo: { listByOwner: (...a: unknown[]) => notesList(...a), create: (...a: unknown[]) => createNote(...a), update: vi.fn(), softDelete: vi.fn() },
}));
let mockUser: { uid: string } | null = { uid: "u1" };
vi.mock("../auth/AuthProvider", () => ({ useAuth: () => ({ user: mockUser }) }));

beforeEach(() => {
  mockUser = { uid: "u1" };
  sectionsList.mockReset().mockResolvedValue([{ id: "s1", ownerId: "u1", name: "Travail", order: 0, createdAt: 1, updatedAt: 1, deletedAt: null }]);
  notesList.mockReset().mockResolvedValue([{ id: "n1", ownerId: "u1", sectionId: "s1", title: "Note A", body: { type: "doc", content: [] }, linkedEntities: [], tags: [], createdAt: 1, updatedAt: 1, deletedAt: null }]);
  createNote.mockReset().mockResolvedValue(undefined);
});

describe("useNotes", () => {
  it("loads sections and notes on mount", async () => {
    const { result } = renderHook(() => useNotes());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.sections.map((s) => s.id)).toEqual(["s1"]);
    expect(result.current.notes.map((n) => n.id)).toEqual(["n1"]);
  });

  it("createNote calls repo then reloads", async () => {
    const { result } = renderHook(() => useNotes());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.createNote({ sectionId: "s1", title: "B", body: { type: "doc", content: [] }, linkedEntities: [], tags: [] }); });
    expect(createNote).toHaveBeenCalledWith("u1", expect.objectContaining({ sectionId: "s1", title: "B" }));
    expect(notesList).toHaveBeenCalledTimes(2);
  });

  it("returns empty/not-loading with no user", async () => {
    mockUser = null;
    const { result } = renderHook(() => useNotes());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.sections).toEqual([]);
    expect(result.current.notes).toEqual([]);
    expect(sectionsList).not.toHaveBeenCalled();
  });
});
