import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AgendaView } from "./AgendaView";
import type { Occurrence, Event } from "@retrorganizer/core";

function occ(year: number, month: number, day: number, hour: number, title: string): Occurrence {
  const start = new Date(year, month, day, hour).getTime();
  return { event: { id: title, title, start, end: start + 3600000 } as Event, start, end: start + 3600000 };
}

describe("AgendaView", () => {
  it("lists occurrences and fires onSelectOccurrence", () => {
    const onSelect = vi.fn();
    const a = occ(2026, 0, 5, 9, "Standup");
    render(<AgendaView occurrences={[a]} onSelectOccurrence={onSelect} />);
    fireEvent.click(screen.getByRole("button", { name: /Standup/ }));
    expect(onSelect).toHaveBeenCalledWith(a);
  });

  it("shows an empty message when there are no occurrences", () => {
    render(<AgendaView occurrences={[]} onSelectOccurrence={() => {}} />);
    expect(screen.getByText("Aucun événement")).toBeInTheDocument();
  });
});
