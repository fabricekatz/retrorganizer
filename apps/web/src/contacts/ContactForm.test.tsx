import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { emptyDraft } from "@retrorganizer/core";
import type { ContactDraft } from "@retrorganizer/core";
import { ContactForm } from "./ContactForm";

describe("ContactForm", () => {
  it("submits a draft with names, a phone, and an address", () => {
    const onSubmit = vi.fn();
    render(<ContactForm onSubmit={onSubmit} onCancel={() => {}} />);
    fireEvent.change(screen.getByLabelText("Prénom"), { target: { value: "Ada" } });
    fireEvent.change(screen.getByLabelText("Nom"), { target: { value: "Lovelace" } });
    fireEvent.click(screen.getByRole("button", { name: "+ Téléphone" }));
    fireEvent.change(screen.getByLabelText("Téléphone libellé 1"), { target: { value: "mobile" } });
    fireEvent.change(screen.getByLabelText("Téléphone valeur 1"), { target: { value: "+33 1" } });
    fireEvent.click(screen.getByRole("button", { name: "+ Adresse" }));
    fireEvent.change(screen.getByLabelText("Adresse ville 1"), { target: { value: "Paris" } });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const draft = onSubmit.mock.calls[0]![0] as ContactDraft;
    expect(draft.firstName).toBe("Ada");
    expect(draft.displayName).toBe("Ada Lovelace"); // filled by withDisplayName
    expect(draft.phones).toEqual([{ label: "mobile", value: "+33 1" }]);
    expect(draft.addresses).toEqual([{ label: "", street: "", city: "Paris", postalCode: "", country: "" }]);
  });

  it("pre-fills from initial draft", () => {
    render(<ContactForm initial={{ ...emptyDraft(), displayName: "Grace Hopper" }} onSubmit={() => {}} onCancel={() => {}} />);
    expect(screen.getByLabelText("Nom affiché")).toHaveValue("Grace Hopper");
  });
});
