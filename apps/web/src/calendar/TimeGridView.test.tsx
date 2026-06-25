import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TimeGridView } from "./TimeGridView";
import { startOfDay, type Occurrence, type Event } from "@retrorganizer/core";

const DAY = new Date(2026, 0, 5).getTime();

function timed(hour: number, title: string): Occurrence {
  const start = new Date(2026, 0, 5, hour).getTime();
  return { event: { id: title, title, start, end: start + 3600000, allDay: false } as Event, start, end: start + 3600000 };
}

describe("TimeGridView", () => {
  it("renders a day column and positions a timed occurrence block", () => {
    const onSelect = vi.fn();
    render(<TimeGridView days={[startOfDay(DAY)]} occurrences={[timed(9, "Réunion")]} onSelectOccurrence={onSelect} />);
    const block = screen.getByRole("button", { name: /Réunion/ });
    fireEvent.click(block);
    expect(onSelect).toHaveBeenCalledTimes(1);
    // 09:00 -> top = 9*36 = 324px
    expect(block.style.top).toBe("324px");
  });

  it("renders 7 day columns for a week", () => {
    const days = Array.from({ length: 7 }, (_, i) => startOfDay(new Date(2026, 0, 5 + i).getTime()));
    render(<TimeGridView days={days} occurrences={[]} onSelectOccurrence={() => {}} />);
    expect(screen.getAllByTestId("day-column")).toHaveLength(7);
  });
});
