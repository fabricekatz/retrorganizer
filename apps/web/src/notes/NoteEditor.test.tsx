import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { NoteEditor } from "./NoteEditor";

const DOC = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Bonjour" }] }] };

describe("NoteEditor", () => {
  it("renders the formatting toolbar", () => {
    render(<NoteEditor value={DOC} onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Gras" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Italique" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Liste à puces" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Liste numérotée" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Titre" })).toBeInTheDocument();
  });

  it("mounts an editable region with the initial content", async () => {
    const { container } = render(<NoteEditor value={DOC} onChange={vi.fn()} />);
    await waitFor(() => expect(container.querySelector('[contenteditable="true"]')).toBeTruthy());
    expect(container.textContent).toContain("Bonjour");
  });
});
