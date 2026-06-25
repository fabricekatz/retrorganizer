import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TagInput } from "./TagInput";

describe("TagInput", () => {
  it("adds a tag on Enter", () => {
    const onChange = vi.fn();
    render(<TagInput value={[]} onChange={onChange} />);
    const input = screen.getByLabelText("Ajouter un tag");
    fireEvent.change(input, { target: { value: "urgent" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith(["urgent"]);
  });

  it("does not add a duplicate or empty tag", () => {
    const onChange = vi.fn();
    render(<TagInput value={["urgent"]} onChange={onChange} />);
    const input = screen.getByLabelText("Ajouter un tag");
    fireEvent.change(input, { target: { value: "urgent" } });
    fireEvent.keyDown(input, { key: "Enter" });
    fireEvent.change(input, { target: { value: "  " } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("removes a tag", () => {
    const onChange = vi.fn();
    render(<TagInput value={["urgent", "perso"]} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Supprimer le tag urgent" }));
    expect(onChange).toHaveBeenCalledWith(["perso"]);
  });
});
