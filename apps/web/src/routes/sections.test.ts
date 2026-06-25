import { describe, it, expect } from "vitest";
import { SECTIONS } from "./sections";

describe("SECTIONS", () => {
  it("defines all 8 organizer sections", () => {
    expect(SECTIONS).toHaveLength(8);
    expect(SECTIONS.map((s) => s.id)).toEqual([
      "diary", "todo", "address", "notepad",
      "planner", "anniversary", "web", "calls",
    ]);
  });

  it("marks the 4 MVP sections", () => {
    const mvp = SECTIONS.filter((s) => s.mvp).map((s) => s.id);
    expect(mvp).toEqual(["diary", "todo", "address", "notepad"]);
  });
});
