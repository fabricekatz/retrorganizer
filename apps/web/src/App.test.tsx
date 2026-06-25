import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { App } from "./App";

vi.mock("./auth/AuthProvider", () => ({
  useAuth: () => ({ user: { uid: "u1", email: "ada@x.io" }, loading: false, signOut: vi.fn() }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("./calendar/CalendarModule", () => ({
  CalendarModule: () => <div data-testid="calendar-module" />,
}));

vi.mock("./search/GlobalSearchBar", () => ({
  GlobalSearchBar: () => <div data-testid="global-search" />,
}));

vi.mock("./reminders/ReminderHost", () => ({
  ReminderHost: () => <div data-testid="reminder-host" />,
}));

describe("App", () => {
  it("renders the 8 section tabs for an authenticated user", () => {
    render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={["/diary"]}><App /></MemoryRouter>);
    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(8);
    expect(screen.getByRole("tab", { name: "Address" })).toBeInTheDocument();
  });

  it("shows the Retrorganizer wordmark in the menu bar", () => {
    render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={["/diary"]}><App /></MemoryRouter>);
    expect(screen.getByText("Retrorganizer")).toBeInTheDocument();
  });

  it("shows the trash button in the header", () => {
    render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={["/diary"]}><App /></MemoryRouter>);
    expect(screen.getByRole("button", { name: "Corbeille" })).toBeInTheDocument();
  });
});
