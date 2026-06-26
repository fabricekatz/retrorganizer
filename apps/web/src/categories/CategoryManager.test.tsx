import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CategoryManager } from "./CategoryManager";

const updateCategory = vi.fn();
const removeCategory = vi.fn();
let categories = [
  { id: "c1", ownerId: "u1", createdAt: 1, updatedAt: 1, deletedAt: null, name: "Travail", color: "#2f6f4f" },
];

vi.mock("./useCategories", () => ({
  useCategories: () => ({
    categories, loading: false, error: null,
    createCategory: vi.fn(), updateCategory, removeCategory, reload: vi.fn(),
  }),
}));

beforeEach(() => {
  updateCategory.mockReset();
  removeCategory.mockReset();
  categories = [{ id: "c1", ownerId: "u1", createdAt: 1, updatedAt: 1, deletedAt: null, name: "Travail", color: "#2f6f4f" }];
});

describe("CategoryManager", () => {
  it("lists categories and recolors on blur (not on every change)", () => {
    render(<CategoryManager onClose={() => {}} />);
    expect(screen.getByText("Travail")).toBeInTheDocument();
    const input = screen.getByLabelText("Couleur Travail");
    fireEvent.change(input, { target: { value: "#1f4e79" } });
    fireEvent.blur(input);
    expect(updateCategory).toHaveBeenCalledWith("c1", { color: "#1f4e79" });
  });

  it("does not call updateCategory during drags — only commits once on blur", () => {
    render(<CategoryManager onClose={() => {}} />);
    const input = screen.getByLabelText("Couleur Travail");
    fireEvent.change(input, { target: { value: "#111111" } });
    fireEvent.change(input, { target: { value: "#222222" } });
    expect(updateCategory).not.toHaveBeenCalled();
    fireEvent.blur(input);
    expect(updateCategory).toHaveBeenCalledTimes(1);
    expect(updateCategory).toHaveBeenCalledWith("c1", { color: "#222222" });
  });

  it("does not call updateCategory on blur when color is unchanged", () => {
    render(<CategoryManager onClose={() => {}} />);
    const input = screen.getByLabelText("Couleur Travail");
    fireEvent.blur(input);
    expect(updateCategory).not.toHaveBeenCalled();
  });

  it("renames via prompt", () => {
    vi.stubGlobal("prompt", vi.fn(() => "Boulot"));
    render(<CategoryManager onClose={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Renommer" }));
    expect(updateCategory).toHaveBeenCalledWith("c1", { name: "Boulot" });
    vi.unstubAllGlobals();
  });

  it("does not rename when prompt is cancelled", () => {
    vi.stubGlobal("prompt", vi.fn(() => null));
    render(<CategoryManager onClose={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Renommer" }));
    expect(updateCategory).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("does not rename when the name is unchanged", () => {
    vi.stubGlobal("prompt", vi.fn(() => "Travail"));
    render(<CategoryManager onClose={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Renommer" }));
    expect(updateCategory).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("deletes after confirmation", () => {
    vi.stubGlobal("confirm", vi.fn(() => true));
    render(<CategoryManager onClose={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Supprimer" }));
    expect(removeCategory).toHaveBeenCalledWith("c1");
    vi.unstubAllGlobals();
  });

  it("shows an empty state when there are no categories", () => {
    categories = [];
    render(<CategoryManager onClose={() => {}} />);
    expect(screen.getByText("Aucune catégorie")).toBeInTheDocument();
  });
});
