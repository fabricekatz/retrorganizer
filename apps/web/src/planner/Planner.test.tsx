// apps/web/src/planner/Planner.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const navigate = vi.fn();
vi.mock("react-router-dom", () => ({ useNavigate: () => navigate }));
vi.mock("../calendar/useEvents", () => ({
  useEvents: () => ({
    events: [{
      id: "e1", ownerId: "u1", createdAt: 1, updatedAt: 1, deletedAt: null,
      title: "X", start: new Date(2026, 0, 10, 9).getTime(), end: new Date(2026, 0, 10, 10).getTime(),
      allDay: false, recurrence: null, recurrenceExceptions: [], location: "", description: "",
      contactIds: [], categoryId: null, tags: [], reminderOffsets: [],
    }],
  }),
}));
vi.mock("../tasks/useTasks", () => ({ useTasks: () => ({ tasks: [] }) }));

import { Planner } from "./Planner";

describe("Planner", () => {
  it("shows 12 month cells and a January count for the current year's event", () => {
    // freeze the clock to 2026 so the default year matches the fixture
    vi.setSystemTime(new Date(2026, 5, 1));
    render(<Planner />);
    expect(screen.getByRole("heading", { name: /2026/ })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /^(janv|févr|mars|avr|mai|juin|juil|août|sept|oct|nov|déc)/i }).length).toBe(12);
    // January cell shows "1 évén."
    const janButton = screen.getAllByRole("button", { name: /janv/i })[0]!;
    expect(janButton).toHaveTextContent(/1\s*évén/i);
    vi.useRealTimers();
  });

  it("navigates to the diary when a month is clicked", () => {
    vi.setSystemTime(new Date(2026, 5, 1));
    render(<Planner />);
    fireEvent.click(screen.getAllByRole("button", { name: /janv/i })[0]!);
    expect(navigate).toHaveBeenCalledWith("/diary");
    vi.useRealTimers();
  });
});
