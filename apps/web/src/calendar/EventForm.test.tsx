import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { EventForm } from "./EventForm";
import type { EventDraft } from "@retrorganizer/core";

vi.mock("../contacts/useContacts", () => ({
  useContacts: () => ({ contacts: [{ id: "c1", displayName: "Ada Lovelace" }], loading: false }),
}));
vi.mock("../categories/useCategories", () => ({
  useCategories: () => ({ categories: [], loading: false, error: null, createCategory: vi.fn(), updateCategory: vi.fn(), removeCategory: vi.fn(), reload: vi.fn() }),
}));

describe("EventForm", () => {
  it("submits a draft with title, times and a weekly recurrence", () => {
    const onSubmit = vi.fn();
    render(<EventForm onSubmit={onSubmit} onCancel={() => {}} />);
    fireEvent.change(screen.getByLabelText("Titre"), { target: { value: "Réunion" } });
    fireEvent.change(screen.getByLabelText("Début"), { target: { value: "2026-01-05T09:00" } });
    fireEvent.change(screen.getByLabelText("Fin"), { target: { value: "2026-01-05T10:00" } });
    fireEvent.change(screen.getByLabelText("Récurrence"), { target: { value: "FREQ=WEEKLY" } });
    fireEvent.change(screen.getByLabelText("Ajouter un tag"), { target: { value: "réu" } });
    fireEvent.keyDown(screen.getByLabelText("Ajouter un tag"), { key: "Enter" });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const d = onSubmit.mock.calls[0]![0] as EventDraft;
    expect(d.title).toBe("Réunion");
    expect(d.recurrence).toBe("FREQ=WEEKLY");
    expect(d.start).toBe(new Date("2026-01-05T09:00").getTime());
    expect(d.end).toBe(new Date("2026-01-05T10:00").getTime());
    expect(d.tags).toEqual(["réu"]);
  });

  it("blocks submit and shows an error when end is before start", () => {
    const onSubmit = vi.fn();
    render(<EventForm onSubmit={onSubmit} onCancel={() => {}} />);
    fireEvent.change(screen.getByLabelText("Titre"), { target: { value: "X" } });
    fireEvent.change(screen.getByLabelText("Début"), { target: { value: "2026-01-05T10:00" } });
    fireEvent.change(screen.getByLabelText("Fin"), { target: { value: "2026-01-05T09:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(/fin/i);
  });

  it("ignores an empty-string clear on Début and keeps previous start value", () => {
    const onSubmit = vi.fn();
    render(<EventForm onSubmit={onSubmit} onCancel={() => {}} />);
    // Set a valid start
    fireEvent.change(screen.getByLabelText("Début"), { target: { value: "2026-01-05T09:00" } });
    // Simulate clearing the field (value becomes "")
    fireEvent.change(screen.getByLabelText("Début"), { target: { value: "" } });
    // Set end and title, then submit
    fireEvent.change(screen.getByLabelText("Fin"), { target: { value: "2026-01-05T10:00" } });
    fireEvent.change(screen.getByLabelText("Titre"), { target: { value: "X" } });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const draft = onSubmit.mock.calls[0]![0] as import("@retrorganizer/core").EventDraft;
    expect(Number.isFinite(draft.start)).toBe(true);
  });

  it("toggles a contact link", () => {
    const onSubmit = vi.fn();
    render(<EventForm onSubmit={onSubmit} onCancel={() => {}} />);
    fireEvent.change(screen.getByLabelText("Titre"), { target: { value: "X" } });
    fireEvent.change(screen.getByLabelText("Début"), { target: { value: "2026-01-05T09:00" } });
    fireEvent.change(screen.getByLabelText("Fin"), { target: { value: "2026-01-05T10:00" } });
    fireEvent.click(screen.getByLabelText("Ada Lovelace"));
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    const d = onSubmit.mock.calls[0]![0] as EventDraft;
    expect(d.contactIds).toEqual(["c1"]);
  });
});
