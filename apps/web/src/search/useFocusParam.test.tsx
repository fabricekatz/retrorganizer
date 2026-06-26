import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, useSearchParams } from "react-router-dom";
import { useFocusParam } from "./useFocusParam";

type Item = { id: string; name: string };

function Harness({ entities, loading, onFocus }: { entities: Item[]; loading: boolean; onFocus: (i: Item) => void }) {
  useFocusParam(entities, loading, onFocus);
  const [params] = useSearchParams();
  return <div data-testid="focus">{params.get("focus") ?? "none"}</div>;
}

function renderAt(path: string, props: { entities: Item[]; loading: boolean; onFocus: (i: Item) => void }) {
  return render(
    <MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Harness {...props} />
    </MemoryRouter>,
  );
}

describe("useFocusParam", () => {
  it("calls onFocus with the matching entity and clears the param", () => {
    const onFocus = vi.fn();
    renderAt("/x?focus=a", { entities: [{ id: "a", name: "Alpha" }], loading: false, onFocus });
    expect(onFocus).toHaveBeenCalledWith({ id: "a", name: "Alpha" });
    expect(screen.getByTestId("focus").textContent).toBe("none");
  });

  it("does nothing while loading", () => {
    const onFocus = vi.fn();
    renderAt("/x?focus=a", { entities: [], loading: true, onFocus });
    expect(onFocus).not.toHaveBeenCalled();
    expect(screen.getByTestId("focus").textContent).toBe("a");
  });

  it("clears the param without calling onFocus when the id matches nothing", () => {
    const onFocus = vi.fn();
    renderAt("/x?focus=ghost", { entities: [{ id: "a", name: "Alpha" }], loading: false, onFocus });
    expect(onFocus).not.toHaveBeenCalled();
    expect(screen.getByTestId("focus").textContent).toBe("none");
  });

  it("does nothing when there is no focus param", () => {
    const onFocus = vi.fn();
    renderAt("/x", { entities: [{ id: "a", name: "Alpha" }], loading: false, onFocus });
    expect(onFocus).not.toHaveBeenCalled();
  });
});
