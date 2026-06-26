import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CategoryTagBadges } from "./CategoryTagBadges";
import type { Category } from "@retrorganizer/core";

const cat: Category = {
  id: "c1", ownerId: "u1", createdAt: 1, updatedAt: 1, deletedAt: null,
  name: "Travail", color: "#2f6f4f",
};

describe("CategoryTagBadges", () => {
  it("renders the category name and each tag", () => {
    render(<CategoryTagBadges category={cat} tags={["urgent", "client"]} />);
    expect(screen.getByText("Travail")).toBeInTheDocument();
    expect(screen.getByText("urgent")).toBeInTheDocument();
    expect(screen.getByText("client")).toBeInTheDocument();
  });

  it("renders nothing when there is no category and no tags", () => {
    const { container } = render(<CategoryTagBadges category={undefined} tags={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders tags when category is undefined", () => {
    render(<CategoryTagBadges category={undefined} tags={["perso"]} />);
    expect(screen.getByText("perso")).toBeInTheDocument();
  });
});
