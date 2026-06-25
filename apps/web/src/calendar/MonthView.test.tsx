import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MonthView } from "./MonthView";
import { startOfDay, type Occurrence, type Event } from "@retrorganizer/core";

function occOn(year: number, month: number, day: number, title: string): Occurrence {
  const start = new Date(year, month, day, 9, 0).getTime();
  const event = { id: "e" + day, title, start, end: start + 3600000 } as Event;
  return { event, start, end: start + 3600000 };
}

describe("MonthView", () => {
  it("renders a chip for an occurrence on its day and fires onSelectOccurrence", () => {
    const onSelectOccurrence = vi.fn();
    const occ = occOn(2026, 0, 15, "Réunion");
    render(<MonthView year={2026} month={0} occurrences={[occ]}
      onSelectDay={() => {}} onSelectOccurrence={onSelectOccurrence} />);
    const chip = screen.getByRole("button", { name: /Réunion/ });
    fireEvent.click(chip);
    expect(onSelectOccurrence).toHaveBeenCalledWith(occ);
  });

  it("renders 42 day cells", () => {
    render(<MonthView year={2026} month={0} occurrences={[]}
      onSelectDay={() => {}} onSelectOccurrence={() => {}} />);
    expect(screen.getAllByTestId("month-cell")).toHaveLength(42);
  });

  it("calls onSelectDay with the day start when a cell is clicked", () => {
    const onSelectDay = vi.fn();
    render(<MonthView year={2026} month={0} occurrences={[]}
      onSelectDay={onSelectDay} onSelectOccurrence={() => {}} />);
    fireEvent.click(screen.getAllByTestId("month-cell")[10]!);
    expect(onSelectDay).toHaveBeenCalledTimes(1);
    expect(typeof onSelectDay.mock.calls[0]![0]).toBe("number");
    expect(onSelectDay.mock.calls[0]![0]).toBe(startOfDay(onSelectDay.mock.calls[0]![0] as number));
  });
});
