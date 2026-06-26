import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ContactList } from "./ContactList";
import type { Contact, Category } from "@retrorganizer/core";

function mk(id: string, name: string, org = "", categoryId: string | null = null, tags: string[] = []): Contact {
  return { id, ownerId: "u1", createdAt: 1, updatedAt: 1, deletedAt: null, firstName: "", lastName: "", displayName: name, organization: org, phones: [], emails: [], addresses: [], webLinks: [], importantDates: [], customFields: [], categoryId, tags };
}

const categories: Category[] = [
  { id: "c1", ownerId: "u1", createdAt: 1, updatedAt: 1, deletedAt: null, name: "Travail", color: "#2f6f4f" },
];

describe("ContactList", () => {
  const contacts = [mk("1", "Ada Lovelace", "Engines"), mk("2", "Grace Hopper", "Navy")];

  it("renders one entry per contact and fires onSelect", () => {
    const onSelect = vi.fn();
    render(<ContactList contacts={contacts} categories={categories} onSelect={onSelect} onNew={() => {}}
      query="" onQueryChange={() => {}} sortKey="name" onSortKeyChange={() => {}} />);
    expect(screen.getByRole("button", { name: /Ada Lovelace/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Grace Hopper/ }));
    expect(onSelect).toHaveBeenCalledWith(contacts[1]!);
  });

  it("typing in search calls onQueryChange", () => {
    const onQueryChange = vi.fn();
    render(<ContactList contacts={contacts} categories={categories} onSelect={() => {}} onNew={() => {}}
      query="" onQueryChange={onQueryChange} sortKey="name" onSortKeyChange={() => {}} />);
    fireEvent.change(screen.getByLabelText("Rechercher"), { target: { value: "ada" } });
    expect(onQueryChange).toHaveBeenCalledWith("ada");
  });

  it("shows the category name and tags for a contact", () => {
    const tagged = [mk("3", "Alan Turing", "", "c1", ["math"])];
    render(<ContactList contacts={tagged} categories={categories} onSelect={() => {}} onNew={() => {}}
      query="" onQueryChange={() => {}} sortKey="name" onSortKeyChange={() => {}} />);
    expect(screen.getByText("Travail")).toBeInTheDocument();
    expect(screen.getByText("math")).toBeInTheDocument();
  });
});
