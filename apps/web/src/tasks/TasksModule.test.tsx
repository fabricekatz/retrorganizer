import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { TasksModule } from "./TasksModule";

const listByOwner = vi.fn();
const create = vi.fn();
const update = vi.fn();
vi.mock("@retrorganizer/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@retrorganizer/core")>();
  return {
    ...actual,
    tasksRepo: {
      listByOwner: (...a: unknown[]) => listByOwner(...a),
      create: (...a: unknown[]) => create(...a),
      update: (...a: unknown[]) => update(...a),
      softDelete: vi.fn(),
    },
  };
});
vi.mock("../auth/AuthProvider", () => ({ useAuth: () => ({ user: { uid: "u1", email: "a@x.io" } }) }));
vi.mock("../contacts/useContacts", () => ({ useContacts: () => ({ contacts: [], loading: false }) }));
vi.mock("../calendar/useEvents", () => ({ useEvents: () => ({ events: [], loading: false }) }));

const task = (extra: Record<string, unknown> = {}) => ({
  id: "t1", ownerId: "u1", createdAt: 1, updatedAt: 1, deletedAt: null, title: "Acheter pain",
  description: "", priority: "normal", dueDate: null, status: "todo", completedAt: null,
  subtasks: [], recurrence: null, contactIds: [], eventId: null, categoryId: null, tags: [], ...extra,
});

beforeEach(() => {
  listByOwner.mockReset().mockResolvedValue([task()]);
  create.mockReset().mockResolvedValue(undefined);
  update.mockReset().mockResolvedValue(undefined);
});

describe("TasksModule", () => {
  it("completing a non-recurring task marks it done", async () => {
    render(<TasksModule />);
    await waitFor(() => expect(screen.getByLabelText("Terminer Acheter pain")).toBeInTheDocument());
    fireEvent.click(screen.getByLabelText("Terminer Acheter pain"));
    await waitFor(() => expect(update).toHaveBeenCalledTimes(1));
    expect(update.mock.calls[0]![0]).toBe("t1");
    expect((update.mock.calls[0]![1] as { status: string }).status).toBe("done");
  });

  it("completing a recurring task advances its due date and stays todo", async () => {
    const DUE = Date.UTC(2026, 0, 5, 9);
    listByOwner.mockReset().mockResolvedValue([task({ recurrence: "FREQ=WEEKLY", dueDate: DUE })]);
    render(<TasksModule />);
    await waitFor(() => expect(screen.getByLabelText("Terminer Acheter pain")).toBeInTheDocument());
    fireEvent.click(screen.getByLabelText("Terminer Acheter pain"));
    await waitFor(() => expect(update).toHaveBeenCalledTimes(1));
    const patch = update.mock.calls[0]![1] as { status: string; dueDate: number };
    expect(patch.status).toBe("todo");
    expect(patch.dueDate).toBe(DUE + 7 * 24 * 3600000);
  });

  it("completing a recurring task with an exhausted rule marks it done", async () => {
    const DUE = Date.UTC(2026, 0, 5, 9);
    listByOwner.mockReset().mockResolvedValue([task({ recurrence: "FREQ=DAILY;COUNT=1", dueDate: DUE })]);
    render(<TasksModule />);
    await waitFor(() => expect(screen.getByLabelText("Terminer Acheter pain")).toBeInTheDocument());
    fireEvent.click(screen.getByLabelText("Terminer Acheter pain"));
    await waitFor(() => expect(update).toHaveBeenCalledTimes(1));
    expect((update.mock.calls[0]![1] as { status: string }).status).toBe("done");
  });
});
