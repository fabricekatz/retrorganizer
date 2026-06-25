import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Tab } from "./Tab";

describe("Tab", () => {
  it("renders its label and marks active state", () => {
    render(<Tab label="Diary" active accentColor="#2f6f4f" onClick={() => {}} />);
    const btn = screen.getByRole("tab", { name: "Diary" });
    expect(btn).toHaveAttribute("aria-selected", "true");
  });

  it("calls onClick when pressed", () => {
    const onClick = vi.fn();
    render(<Tab label="ToDo" active={false} accentColor="#a8431f" onClick={onClick} />);
    screen.getByRole("tab", { name: "ToDo" }).click();
    expect(onClick).toHaveBeenCalledOnce();
  });
});
