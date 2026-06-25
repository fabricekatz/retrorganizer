import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ContactList } from "./ContactList";
import type { Contact } from "@retrorganizer/core";

function mk(id: string, name: string, org = ""): Contact {
  return { id, ownerId: "u1", createdAt: 1, updatedAt: 1, deletedAt: null, firstName: "", lastName: "", displayName: name, organization: org, phones: [], emails: [], addresses: [], webLinks: [], importantDates: [], customFields: [], categoryId: null, tags: [] };
}

describe("ContactList", () => {
  const contacts = [mk("1", "Ada Lovelace", "Engines"), mk("2", "Grace Hopper", "Navy")];

  it("renders one entry per contact and fires onSelect", () => {
    const onSelect = vi.fn();
    render(<ContactList contacts={contacts} onSelect={onSelect} onNew={() => {}}
      query="" onQueryChange={() => {}} sortKey="name" onSortKeyChange={() => {}} />);
    expect(screen.getByRole("button", { name: /Ada Lovelace/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Grace Hopper/ }));
    expect(onSelect).toHaveBeenCalledWith(contacts[1]);
  });

  it("typing in search calls onQueryChange", () => {
    const onQueryChange = vi.fn();
    render(<ContactList contacts={contacts} onSelect={() => {}} onNew={() => {}}
      query="" onQueryChange={onQueryChange} sortKey="name" onSortKeyChange={() => {}} />);
    fireEvent.change(screen.getByLabelText("Rechercher"), { target: { value: "ada" } });
    expect(onQueryChange).toHaveBeenCalledWith("ada");
  });
});
