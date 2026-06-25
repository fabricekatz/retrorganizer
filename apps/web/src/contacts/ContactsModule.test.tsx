import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ContactsModule } from "./ContactsModule";

const listByOwner = vi.fn();
const create = vi.fn();
vi.mock("@retrorganizer/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@retrorganizer/core")>();
  return {
    ...actual,
    contactsRepo: {
      listByOwner: (...a: unknown[]) => listByOwner(...a),
      create: (...a: unknown[]) => create(...a),
      update: vi.fn(),
      softDelete: vi.fn(),
    },
  };
});
vi.mock("../auth/AuthProvider", () => ({ useAuth: () => ({ user: { uid: "u1", email: "a@x.io" } }) }));

beforeEach(() => {
  listByOwner.mockReset().mockResolvedValue([]);
  create.mockReset().mockResolvedValue(undefined);
});

describe("ContactsModule", () => {
  it("creates a contact through the new-contact flow", async () => {
    render(<ContactsModule />);
    await waitFor(() => expect(screen.getByRole("button", { name: "+ Nouveau" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "+ Nouveau" }));
    fireEvent.change(screen.getByLabelText("Prénom"), { target: { value: "Ada" } });
    fireEvent.change(screen.getByLabelText("Nom"), { target: { value: "Lovelace" } });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
    expect(create.mock.calls[0]![0]).toBe("u1");
    expect(create.mock.calls[0]![1].displayName).toBe("Ada Lovelace");
  });
});
