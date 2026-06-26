import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { CalendarModule } from "./CalendarModule";
import { EventsProvider } from "./useEvents";

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
    render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><EventsProvider><CalendarModule initialAnchor={ANCHOR} /></EventsProvider></MemoryRouter>);
    await waitFor(() => expect(screen.getByRole("button", { name: "Mois" })).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Semaine" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Jour" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Agenda" })).toBeInTheDocument();
    expect(screen.getAllByTestId("month-cell")).toHaveLength(42);
  });

  it("creates an event through the new-event flow", async () => {
    render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><EventsProvider><CalendarModule initialAnchor={ANCHOR} /></EventsProvider></MemoryRouter>);
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
    render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><EventsProvider><CalendarModule initialAnchor={ANCHOR} /></EventsProvider></MemoryRouter>);
    await waitFor(() => expect(screen.getByRole("button", { name: "Agenda" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Agenda" }));
    expect(screen.getByText("Aucun événement")).toBeInTheDocument();
  });

  it("opens the editor for a focused event from the URL ?focus param", async () => {
    const start = new Date(2026, 0, 15, 9, 0).getTime();
    const end = new Date(2026, 0, 15, 10, 0).getTime();
    const event = {
      id: "e9",
      ownerId: "u1",
      createdAt: start,
      updatedAt: start,
      deletedAt: null,
      title: "Launch",
      start,
      end,
      allDay: false,
      location: "",
      notes: "",
      recurrence: null,
      recurrenceExceptions: [],
      reminderOffsets: [],
      contactIds: [],
      taskIds: [],
      categoryId: null,
      color: "",
      tags: [],
    };
    listByOwner.mockResolvedValue([event]);
    render(
      <MemoryRouter
        initialEntries={["/diary?focus=e9"]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <EventsProvider><CalendarModule initialAnchor={ANCHOR} /></EventsProvider>
      </MemoryRouter>,
    );
    // EventForm renders the title in an input; assert the editor opened
    await waitFor(() => expect(screen.getByDisplayValue("Launch")).toBeInTheDocument());
  });
});
