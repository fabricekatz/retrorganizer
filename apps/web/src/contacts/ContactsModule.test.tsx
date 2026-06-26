import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
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
    render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><ContactsModule /></MemoryRouter>);
    await waitFor(() => expect(screen.getByRole("button", { name: "+ Nouveau" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "+ Nouveau" }));
    fireEvent.change(screen.getByLabelText("Prénom"), { target: { value: "Ada" } });
    fireEvent.change(screen.getByLabelText("Nom"), { target: { value: "Lovelace" } });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
    expect(create.mock.calls[0]![0]).toBe("u1");
    expect(create.mock.calls[0]![1].displayName).toBe("Ada Lovelace");
  });

  it("opens the focused contact from the ?focus param", async () => {
    listByOwner.mockResolvedValue([
      { id: "c9", ownerId: "u1", createdAt: 1, updatedAt: 1, deletedAt: null, firstName: "Grace", lastName: "Hopper",
        displayName: "Grace Hopper", organization: "", phones: [], emails: [], addresses: [], webLinks: [],
        importantDates: [], customFields: [], categoryId: null, tags: [] },
    ]);
    render(
      <MemoryRouter initialEntries={["/address?focus=c9"]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ContactsModule />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByDisplayValue("Grace")).toBeInTheDocument());
  });
});
