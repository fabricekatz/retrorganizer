import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

let mockContacts: unknown[] = [];
vi.mock("../contacts/useContacts", () => ({ useContacts: () => ({ contacts: mockContacts }) }));

import { Anniversary } from "./Anniversary";

const ada = {
  id: "c1", ownerId: "u1", createdAt: 1, updatedAt: 1, deletedAt: null, firstName: "", lastName: "",
  displayName: "Ada Lovelace", phones: [], emails: [], addresses: [], webLinks: [],
  importantDates: [{ label: "Anniversaire", date: "1990-12-10" }], customFields: [], categoryId: null, tags: [],
};

beforeEach(() => { vi.useRealTimers(); mockContacts = []; });

describe("Anniversary", () => {
  it("lists upcoming anniversaries with contact name and label", () => {
    vi.setSystemTime(new Date(2026, 5, 15));
    mockContacts = [ada];
    render(<Anniversary />);
    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByText(/Anniversaire/, { selector: "div" })).toBeInTheDocument();
  });

  it("shows an empty state when there are no anniversaries", () => {
    mockContacts = [];
    render(<Anniversary />);
    expect(screen.getByText(/Aucun anniversaire/)).toBeInTheDocument();
  });
});
