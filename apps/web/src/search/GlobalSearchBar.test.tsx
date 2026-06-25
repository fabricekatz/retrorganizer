import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { GlobalSearchBar } from "./GlobalSearchBar";

const navigate = vi.fn();
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => navigate };
});

let mockResults: { id: string; type: string; entityId: string; title: string; path: string }[] = [];
const setQuery = vi.fn();
vi.mock("./useGlobalSearch", () => ({
  useGlobalSearch: () => ({ query: mockResults.length ? "ada" : "", setQuery, results: mockResults, loading: false }),
}));

beforeEach(() => { navigate.mockReset(); setQuery.mockReset(); mockResults = []; });

describe("GlobalSearchBar", () => {
  it("typing calls setQuery", () => {
    render(<MemoryRouter><GlobalSearchBar /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText("Recherche globale"), { target: { value: "ada" } });
    expect(setQuery).toHaveBeenCalledWith("ada");
  });

  it("shows results and navigates on click", () => {
    mockResults = [{ id: "contact:c1", type: "contact", entityId: "c1", title: "Ada Lovelace", path: "/address" }];
    render(<MemoryRouter><GlobalSearchBar /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: /Ada Lovelace/ }));
    expect(navigate).toHaveBeenCalledWith("/address");
    expect(setQuery).toHaveBeenCalledWith("");
  });
});
