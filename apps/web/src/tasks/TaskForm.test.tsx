import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TaskForm } from "./TaskForm";
import type { TaskDraft } from "@retrorganizer/core";

vi.mock("../contacts/useContacts", () => ({
  useContacts: () => ({ contacts: [{ id: "c1", displayName: "Ada Lovelace" }], loading: false }),
}));
vi.mock("../calendar/useEvents", () => ({
  useEvents: () => ({ events: [{ id: "e1", title: "Réunion" }], loading: false }),
}));
vi.mock("../categories/useCategories", () => ({
  useCategories: () => ({ categories: [], loading: false, error: null, createCategory: vi.fn(), updateCategory: vi.fn(), removeCategory: vi.fn(), reload: vi.fn() }),
}));

describe("TaskForm", () => {
  it("submits a draft with priority, due date, a subtask, and an event link", () => {
    const onSubmit = vi.fn();
    render(<TaskForm onSubmit={onSubmit} onCancel={() => {}} />);
    fireEvent.change(screen.getByLabelText("Titre"), { target: { value: "Préparer le slide" } });
    fireEvent.change(screen.getByLabelText("Priorité"), { target: { value: "high" } });
    fireEvent.change(screen.getByLabelText("Échéance"), { target: { value: "2026-01-10" } });
    fireEvent.click(screen.getByRole("button", { name: "+ Sous-étape" }));
    fireEvent.change(screen.getByLabelText("Sous-étape titre 1"), { target: { value: "Plan" } });
    fireEvent.change(screen.getByLabelText("Événement lié"), { target: { value: "e1" } });
    fireEvent.click(screen.getByLabelText("Ada Lovelace"));
    fireEvent.change(screen.getByLabelText("Ajouter un tag"), { target: { value: "courses" } });
    fireEvent.keyDown(screen.getByLabelText("Ajouter un tag"), { key: "Enter" });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const d = onSubmit.mock.calls[0]![0] as TaskDraft;
    expect(d.title).toBe("Préparer le slide");
    expect(d.priority).toBe("high");
    expect(d.dueDate).toBe(new Date(2026, 0, 10).getTime());
    expect(d.subtasks).toEqual([{ title: "Plan", done: false }]);
    expect(d.eventId).toBe("e1");
    expect(d.contactIds).toEqual(["c1"]);
    expect(d.tags).toEqual(["courses"]);
  });

  it("clearing the due date sets dueDate to null", () => {
    const onSubmit = vi.fn();
    render(<TaskForm onSubmit={onSubmit} onCancel={() => {}} />);
    fireEvent.change(screen.getByLabelText("Titre"), { target: { value: "X" } });
    fireEvent.change(screen.getByLabelText("Échéance"), { target: { value: "2026-01-10" } });
    fireEvent.change(screen.getByLabelText("Échéance"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    const d = onSubmit.mock.calls[0]![0] as import("@retrorganizer/core").TaskDraft;
    expect(d.dueDate).toBeNull();
  });
});
