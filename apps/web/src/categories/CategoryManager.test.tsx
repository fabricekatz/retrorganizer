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
  it("lists categories and recolors via the color input", () => {
    render(<CategoryManager onClose={() => {}} />);
    expect(screen.getByText("Travail")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Couleur Travail"), { target: { value: "#1f4e79" } });
    expect(updateCategory).toHaveBeenCalledWith("c1", { color: "#1f4e79" });
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
