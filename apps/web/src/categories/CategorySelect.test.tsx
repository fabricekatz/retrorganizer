import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CategorySelect } from "./CategorySelect";

const createCategory = vi.fn();
vi.mock("./useCategories", () => ({
  useCategories: () => ({
    categories: [{ id: "cat1", ownerId: "u1", name: "Travail", color: "#ff0000", createdAt: 1, updatedAt: 1, deletedAt: null }],
    loading: false, error: null, createCategory, updateCategory: vi.fn(), removeCategory: vi.fn(), reload: vi.fn(),
  }),
}));

beforeEach(() => { createCategory.mockReset().mockResolvedValue("cat2"); });

describe("CategorySelect", () => {
  it("selecting a category fires onChange with its id", () => {
    const onChange = vi.fn();
    render(<CategorySelect value={null} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("Catégorie"), { target: { value: "cat1" } });
    expect(onChange).toHaveBeenCalledWith("cat1");
  });

  it("choosing 'Aucune' fires onChange with null", () => {
    const onChange = vi.fn();
    render(<CategorySelect value="cat1" onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("Catégorie"), { target: { value: "" } });
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("inline-creates a category and selects it", async () => {
    const onChange = vi.fn();
    vi.spyOn(window, "prompt").mockReturnValue("Perso");
    render(<CategorySelect value={null} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "+ Catégorie" }));
    await vi.waitFor(() => expect(createCategory).toHaveBeenCalled());
    expect(createCategory.mock.calls[0]![0]).toMatchObject({ name: "Perso" });
    await vi.waitFor(() => expect(onChange).toHaveBeenCalledWith("cat2"));
  });
});
