import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ChunkErrorBoundary } from "./ChunkErrorBoundary";

function Boom(): never { throw new Error("chunk load failed"); }

describe("ChunkErrorBoundary", () => {
  afterEach(() => vi.restoreAllMocks());

  it("renders children when there is no error", () => {
    render(<ChunkErrorBoundary><div data-testid="ok" /></ChunkErrorBoundary>);
    expect(screen.getByTestId("ok")).toBeInTheDocument();
  });

  it("shows a reload fallback when a child throws", () => {
    vi.spyOn(console, "error").mockImplementation(() => {}); // suppress React's boundary error log
    render(<ChunkErrorBoundary><Boom /></ChunkErrorBoundary>);
    expect(screen.getByRole("alert")).toHaveTextContent("Échec du chargement");
    expect(screen.getByRole("button", { name: "Recharger" })).toBeInTheDocument();
  });
});
