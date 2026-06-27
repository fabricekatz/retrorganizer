import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("./useCalls", () => ({
  useCalls: () => ({
    calls: [
      { id: "c1", ownerId: "u1", createdAt: 1, updatedAt: 1, deletedAt: null, contactId: null,
        contactName: "Ada", phoneNumber: "+33 1", direction: "incoming", occurredAt: new Date(2026, 0, 2).getTime(),
        durationMin: 5, notes: "ok", categoryId: null, tags: [] },
    ],
    create: vi.fn(), update: vi.fn(), remove: vi.fn(),
  }),
}));
vi.mock("../contacts/useContacts", () => ({ useContacts: () => ({ contacts: [] }) }));
vi.mock("../categories/CategorySelect", () => ({ CategorySelect: () => <div /> }));
vi.mock("../categories/TagInput", () => ({ TagInput: () => <div /> }));

import { CallLog } from "./CallLog";

describe("CallLog", () => {
  it("renders a call entry with its contact name", () => {
    render(<CallLog />);
    expect(screen.getByText("Ada")).toBeInTheDocument();
  });
  it("opens the form on the new button", () => {
    render(<CallLog />);
    fireEvent.click(screen.getByRole("button", { name: /Nouvel appel/ }));
    expect(screen.getByLabelText("Nom / contact")).toBeInTheDocument();
  });
});
