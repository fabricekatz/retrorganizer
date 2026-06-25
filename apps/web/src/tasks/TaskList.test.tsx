import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TaskList } from "./TaskList";
import { parseTask, type Task } from "@retrorganizer/core";

function mk(id: string, extra: Partial<Task> = {}): Task {
  return parseTask({ id, ownerId: "u1", createdAt: 1, updatedAt: 1, deletedAt: null, title: id, ...extra });
}

const base = {
  onSelect: () => {}, onNew: () => {}, onToggleComplete: () => {},
  statusFilter: "all" as const, onStatusFilterChange: () => {},
  search: "", onSearchChange: () => {},
  sortKey: "priority" as const, onSortKeyChange: () => {},
};

describe("TaskList", () => {
  it("renders a row per task and fires onSelect", () => {
    const onSelect = vi.fn();
    const tasks = [mk("Acheter pain"), mk("Payer facture")];
    render(<TaskList {...base} tasks={tasks} onSelect={onSelect} />);
    fireEvent.click(screen.getByText("Acheter pain"));
    expect(onSelect).toHaveBeenCalledWith(tasks[0]);
  });

  it("fires onToggleComplete from the checkbox without selecting", () => {
    const onSelect = vi.fn();
    const onToggleComplete = vi.fn();
    const tasks = [mk("Acheter pain")];
    render(<TaskList {...base} tasks={tasks} onSelect={onSelect} onToggleComplete={onToggleComplete} />);
    fireEvent.click(screen.getByLabelText("Terminer Acheter pain"));
    expect(onToggleComplete).toHaveBeenCalledWith(tasks[0]);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("shows subtask progress", () => {
    const tasks = [mk("X", { subtasks: [{ title: "a", done: true }, { title: "b", done: false }] })];
    render(<TaskList {...base} tasks={tasks} />);
    expect(screen.getByText("1/2")).toBeInTheDocument();
  });

  it("typing in search calls onSearchChange", () => {
    const onSearchChange = vi.fn();
    render(<TaskList {...base} tasks={[]} onSearchChange={onSearchChange} />);
    fireEvent.change(screen.getByLabelText("Rechercher"), { target: { value: "pain" } });
    expect(onSearchChange).toHaveBeenCalledWith("pain");
  });
});
