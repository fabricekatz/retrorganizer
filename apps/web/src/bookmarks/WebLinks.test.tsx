import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const create = vi.fn();
vi.mock("./useBookmarks", () => ({
  useBookmarks: () => ({
    bookmarks: [
      { id: "b1", ownerId: "u1", createdAt: 1, updatedAt: 1, deletedAt: null, title: "Anthropic", url: "https://anthropic.com", description: "AI", categoryId: null, tags: [] },
    ],
    create, update: vi.fn(), remove: vi.fn(),
  }),
}));
// CategorySelect/TagInput pull from contexts; stub them to keep the screen test isolated.
vi.mock("../categories/CategorySelect", () => ({ CategorySelect: () => <div /> }));
vi.mock("../categories/TagInput", () => ({ TagInput: () => <div /> }));

import { WebLinks } from "./WebLinks";

describe("WebLinks", () => {
  it("renders a bookmark with a link to its url", () => {
    render(<WebLinks />);
    const link = screen.getByRole("link", { name: /Anthropic/ });
    expect(link).toHaveAttribute("href", "https://anthropic.com");
  });

  it("opens the form when the new button is clicked", () => {
    render(<WebLinks />);
    fireEvent.click(screen.getByRole("button", { name: /Nouveau lien/ }));
    expect(screen.getByLabelText("Titre")).toBeInTheDocument();
  });
});
