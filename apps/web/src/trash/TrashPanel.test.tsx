import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TrashPanel } from "./TrashPanel";

const restore = vi.fn();
const purge = vi.fn();
let items: { type: string; id: string; title: string }[] = [];
vi.mock("./useTrash", () => ({
  useTrash: () => ({ items, loading: false, error: null, restore, purge, reload: vi.fn() }),
}));

beforeEach(() => { restore.mockReset(); purge.mockReset(); items = []; });

describe("TrashPanel", () => {
  it("shows the empty message when trash is empty", () => {
    render(<TrashPanel onClose={() => {}} />);
    expect(screen.getByText("Corbeille vide")).toBeInTheDocument();
  });

  it("restores an item", () => {
    items = [{ type: "contact", id: "c1", title: "Ada" }];
    render(<TrashPanel onClose={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Restaurer" }));
    expect(restore).toHaveBeenCalledWith(items[0]);
  });

  it("purges an item after confirmation", () => {
    items = [{ type: "task", id: "t1", title: "Vieille tâche" }];
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<TrashPanel onClose={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Supprimer définitivement" }));
    expect(purge).toHaveBeenCalledWith(items[0]);
  });

  it("does not purge when confirmation is cancelled", () => {
    items = [{ type: "task", id: "t1", title: "Vieille tâche" }];
    vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<TrashPanel onClose={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Supprimer définitivement" }));
    expect(purge).not.toHaveBeenCalled();
  });

  it("calls onClose from the Fermer button", () => {
    const onClose = vi.fn();
    render(<TrashPanel onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "Fermer" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
