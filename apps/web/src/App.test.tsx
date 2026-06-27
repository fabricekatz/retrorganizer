import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { App } from "./App";

vi.mock("./auth/AuthProvider", () => ({
  useAuth: () => ({ user: { uid: "u1", email: "ada@x.io" }, loading: false, signOut: vi.fn() }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("./calendar/Diary", () => ({
  Diary: () => <div data-testid="diary" />,
}));

vi.mock("./search/GlobalSearchBar", () => ({
  GlobalSearchBar: () => <div data-testid="global-search" />,
}));

vi.mock("./reminders/ReminderHost", () => ({
  ReminderHost: () => <div data-testid="reminder-host" />,
}));

vi.mock("./notifications/PushOptIn", () => ({ PushOptIn: () => null }));

vi.mock("./calendar/useEvents", () => ({
  EventsProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useEvents: () => ({ events: [], loading: false, error: null, create: vi.fn(), update: vi.fn(), remove: vi.fn(), reload: vi.fn() }),
}));

function renderApp() {
  return render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={["/diary"]}>
      <App />
    </MemoryRouter>,
  );
}

describe("App", () => {
  it("renders the 8 section tabs for an authenticated user", async () => {
    renderApp();
    expect(screen.getAllByRole("tab")).toHaveLength(8);
    expect(screen.getByRole("tab", { name: "Address" })).toBeInTheDocument();
    await screen.findByTestId("diary");
  });

  it("shows the active section title in the app bar", async () => {
    renderApp();
    expect(screen.getByRole("heading", { name: "Agenda" })).toBeInTheDocument();
    await screen.findByTestId("diary");
  });

  it("exposes the bottom command nav and a menu with Corbeille", async () => {
    renderApp();
    expect(screen.getByRole("button", { name: "Imprimer" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Menu" }));
    expect(screen.getByRole("button", { name: "Corbeille" })).toBeInTheDocument();
    await screen.findByTestId("diary");
  });
});
