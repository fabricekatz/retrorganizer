import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CalendarModule } from "./CalendarModule";

const listByOwner = vi.fn();
const create = vi.fn();
vi.mock("@retrorganizer/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@retrorganizer/core")>();
  return {
    ...actual,
    eventsRepo: {
      listByOwner: (...a: unknown[]) => listByOwner(...a),
      create: (...a: unknown[]) => create(...a),
      update: vi.fn(),
      softDelete: vi.fn(),
    },
  };
});
vi.mock("../auth/AuthProvider", () => ({ useAuth: () => ({ user: { uid: "u1", email: "a@x.io" } }) }));
vi.mock("../contacts/useContacts", () => ({ useContacts: () => ({ contacts: [], loading: false }) }));

beforeEach(() => {
  listByOwner.mockReset().mockResolvedValue([]);
  create.mockReset().mockResolvedValue(undefined);
});

const ANCHOR = new Date(2026, 0, 15).getTime();

describe("CalendarModule", () => {
  it("renders the month view by default with the four view switches", async () => {
    render(<CalendarModule initialAnchor={ANCHOR} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Mois" })).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Semaine" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Jour" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Agenda" })).toBeInTheDocument();
    expect(screen.getAllByTestId("month-cell")).toHaveLength(42);
  });

  it("creates an event through the new-event flow", async () => {
    render(<CalendarModule initialAnchor={ANCHOR} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "+ Nouvel événement" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "+ Nouvel événement" }));
    fireEvent.change(screen.getByLabelText("Titre"), { target: { value: "Réunion" } });
    fireEvent.change(screen.getByLabelText("Début"), { target: { value: "2026-01-15T09:00" } });
    fireEvent.change(screen.getByLabelText("Fin"), { target: { value: "2026-01-15T10:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
    expect(create.mock.calls[0]![0]).toBe("u1");
    expect((create.mock.calls[0]![1] as { title: string }).title).toBe("Réunion");
  });

  it("switches to the agenda view", async () => {
    render(<CalendarModule initialAnchor={ANCHOR} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Agenda" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Agenda" }));
    expect(screen.getByText("Aucun événement")).toBeInTheDocument();
  });
});
