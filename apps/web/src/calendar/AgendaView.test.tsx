import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AgendaView } from "./AgendaView";
import type { Occurrence, Event, Category } from "@retrorganizer/core";

function occ(year: number, month: number, day: number, hour: number, title: string): Occurrence {
  const start = new Date(year, month, day, hour).getTime();
  return { event: { id: title, title, start, end: start + 3600000 } as Event, start, end: start + 3600000 };
}

const categories: Category[] = [
  { id: "c1", ownerId: "u1", createdAt: 1, updatedAt: 1, deletedAt: null, name: "Travail", color: "#2f6f4f" },
];

describe("AgendaView", () => {
  it("lists occurrences and fires onSelectOccurrence", () => {
    const onSelect = vi.fn();
    const a = occ(2026, 0, 5, 9, "Standup");
    render(<AgendaView occurrences={[a]} categories={categories} onSelectOccurrence={onSelect} />);
    fireEvent.click(screen.getByRole("button", { name: /Standup/ }));
    expect(onSelect).toHaveBeenCalledWith(a);
  });

  it("shows an empty message when there are no occurrences", () => {
    render(<AgendaView occurrences={[]} categories={categories} onSelectOccurrence={() => {}} />);
    expect(screen.getByText("Aucun événement")).toBeInTheDocument();
  });

  it("shows category and tag badges on an occurrence", () => {
    const start = new Date(2026, 0, 5, 10).getTime();
    const o: Occurrence = {
      event: { id: "e1", title: "Sprint review", start, end: start + 3600000, categoryId: "c1", tags: ["réunion"] } as Event,
      start,
      end: start + 3600000,
    };
    render(<AgendaView occurrences={[o]} categories={categories} onSelectOccurrence={() => {}} />);
    expect(screen.getByText("Travail")).toBeInTheDocument();
    expect(screen.getByText("réunion")).toBeInTheDocument();
  });
});
