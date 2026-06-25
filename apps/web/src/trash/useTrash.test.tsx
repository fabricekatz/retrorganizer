import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

const contactsListDeletedByOwner = vi.fn().mockResolvedValue([]);
const contactsRestore = vi.fn().mockResolvedValue(undefined);
const contactsHardDelete = vi.fn().mockResolvedValue(undefined);

const eventsListDeletedByOwner = vi.fn().mockResolvedValue([]);
const eventsRestore = vi.fn().mockResolvedValue(undefined);
const eventsHardDelete = vi.fn().mockResolvedValue(undefined);

const tasksListDeletedByOwner = vi.fn().mockResolvedValue([]);
const tasksRestore = vi.fn().mockResolvedValue(undefined);
const tasksHardDelete = vi.fn().mockResolvedValue(undefined);

const notesListDeletedByOwner = vi.fn().mockResolvedValue([]);
const notesRestore = vi.fn().mockResolvedValue(undefined);
const notesHardDelete = vi.fn().mockResolvedValue(undefined);

const categoriesListDeletedByOwner = vi.fn().mockResolvedValue([]);
const categoriesRestore = vi.fn().mockResolvedValue(undefined);
const categoriesHardDelete = vi.fn().mockResolvedValue(undefined);

vi.mock("@retrorganizer/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@retrorganizer/core")>();
  return {
    ...actual,
    contactsRepo: { listDeletedByOwner: (...a: unknown[]) => contactsListDeletedByOwner(...a), restore: (...a: unknown[]) => contactsRestore(...a), hardDelete: (...a: unknown[]) => contactsHardDelete(...a) },
    eventsRepo: { listDeletedByOwner: (...a: unknown[]) => eventsListDeletedByOwner(...a), restore: (...a: unknown[]) => eventsRestore(...a), hardDelete: (...a: unknown[]) => eventsHardDelete(...a) },
    tasksRepo: { listDeletedByOwner: (...a: unknown[]) => tasksListDeletedByOwner(...a), restore: (...a: unknown[]) => tasksRestore(...a), hardDelete: (...a: unknown[]) => tasksHardDelete(...a) },
    notesRepo: { listDeletedByOwner: (...a: unknown[]) => notesListDeletedByOwner(...a), restore: (...a: unknown[]) => notesRestore(...a), hardDelete: (...a: unknown[]) => notesHardDelete(...a) },
    categoriesRepo: { listDeletedByOwner: (...a: unknown[]) => categoriesListDeletedByOwner(...a), restore: (...a: unknown[]) => categoriesRestore(...a), hardDelete: (...a: unknown[]) => categoriesHardDelete(...a) },
  };
});

let mockUser: { uid: string } | null = { uid: "u1" };
vi.mock("../auth/AuthProvider", () => ({ useAuth: () => ({ user: mockUser }) }));

import { useTrash } from "./useTrash";

const base = { ownerId: "u1", createdAt: 1, updatedAt: 1, deletedAt: 9 };

beforeEach(() => {
  mockUser = { uid: "u1" };
  contactsListDeletedByOwner.mockReset().mockResolvedValue([]);
  contactsRestore.mockReset().mockResolvedValue(undefined);
  contactsHardDelete.mockReset().mockResolvedValue(undefined);
  eventsListDeletedByOwner.mockReset().mockResolvedValue([]);
  eventsRestore.mockReset().mockResolvedValue(undefined);
  eventsHardDelete.mockReset().mockResolvedValue(undefined);
  tasksListDeletedByOwner.mockReset().mockResolvedValue([]);
  tasksRestore.mockReset().mockResolvedValue(undefined);
  tasksHardDelete.mockReset().mockResolvedValue(undefined);
  notesListDeletedByOwner.mockReset().mockResolvedValue([]);
  notesRestore.mockReset().mockResolvedValue(undefined);
  notesHardDelete.mockReset().mockResolvedValue(undefined);
  categoriesListDeletedByOwner.mockReset().mockResolvedValue([]);
  categoriesRestore.mockReset().mockResolvedValue(undefined);
  categoriesHardDelete.mockReset().mockResolvedValue(undefined);

  contactsListDeletedByOwner.mockResolvedValue([{ id: "c1", ...base, displayName: "Ada", firstName: "", lastName: "", organization: "", emails: [], phones: [], addresses: [], webLinks: [], importantDates: [], customFields: [], categoryId: null, tags: [] }]);
  tasksListDeletedByOwner.mockResolvedValue([{ id: "t1", ...base, title: "Vieille tâche", description: "", priority: "normal", dueDate: null, status: "todo", completedAt: null, subtasks: [], recurrence: null, contactIds: [], eventId: null, categoryId: null, tags: [] }]);
});

describe("useTrash", () => {
  it("aggregates deleted items across collections", async () => {
    const { result } = renderHook(() => useTrash());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.items).toEqual(expect.arrayContaining([
      { type: "contact", id: "c1", title: "Ada" },
      { type: "task", id: "t1", title: "Vieille tâche" },
    ]));
  });

  it("restore dispatches to the right repo then reloads", async () => {
    const { result } = renderHook(() => useTrash());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.restore({ type: "contact", id: "c1", title: "Ada" }); });
    expect(contactsRestore).toHaveBeenCalledWith("c1");
    expect(contactsListDeletedByOwner).toHaveBeenCalledTimes(2);
  });

  it("purge dispatches hardDelete to the right repo", async () => {
    const { result } = renderHook(() => useTrash());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.purge({ type: "task", id: "t1", title: "Vieille tâche" }); });
    expect(tasksHardDelete).toHaveBeenCalledWith("t1");
  });

  it("returns empty/not-loading with no user", async () => {
    mockUser = null;
    const { result } = renderHook(() => useTrash());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.items).toEqual([]);
    expect(contactsListDeletedByOwner).not.toHaveBeenCalled();
  });
});
