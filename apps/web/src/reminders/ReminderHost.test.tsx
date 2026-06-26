import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ReminderHost } from "./ReminderHost";

const dismiss = vi.fn();
let due: { type: string; entityId: string; title: string; fireAt: number; occurrenceStart: number }[] = [];
vi.mock("./useReminders", () => ({ useReminders: () => ({ due, dismiss }) }));

beforeEach(() => { dismiss.mockReset(); due = []; });

describe("ReminderHost", () => {
  it("renders nothing when there are no due reminders", () => {
    const { container } = render(<ReminderHost />);
    expect(container.firstChild).toBeNull();
  });

  it("renders a toast per due reminder and dismisses it", () => {
    due = [{ type: "event", entityId: "e1", title: "Réunion budget", fireAt: 100, occurrenceStart: 700 }];
    render(<ReminderHost />);
    expect(screen.getByText("Réunion budget")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Fermer le rappel" }));
    expect(dismiss).toHaveBeenCalledWith("e1:700:100");
  });

  it("shows 'Rappel de tâche' label for task reminders", () => {
    due = [{ type: "task", entityId: "t1", title: "Finir rapport", fireAt: 200, occurrenceStart: 800 }];
    render(<ReminderHost />);
    expect(screen.getByText("Rappel de tâche")).toBeInTheDocument();
    expect(screen.getByText("Finir rapport")).toBeInTheDocument();
  });
});
