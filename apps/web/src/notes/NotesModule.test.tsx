import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { NotesModule } from "./NotesModule";

const createNote = vi.fn();
const updateNote = vi.fn();
let state: { sections: unknown[]; notes: unknown[] };
vi.mock("./useNotes", () => ({
  useNotes: () => ({
    sections: state.sections, notes: state.notes, loading: false, error: null,
    createSection: vi.fn(), removeSection: vi.fn(),
    createNote: (...a: unknown[]) => createNote(...a),
    updateNote: (...a: unknown[]) => updateNote(...a),
    removeNote: vi.fn(), reload: vi.fn(),
  }),
}));
vi.mock("./NoteEditor", () => ({
  NoteEditor: ({ value }: { value: unknown }) => <div data-testid="note-editor">{JSON.stringify(value)}</div>,
}));

const note = (id: string, sectionId: string, title: string) => ({
  id, ownerId: "u1", sectionId, title, body: { type: "doc", content: [] }, linkedEntities: [], tags: [], createdAt: 1, updatedAt: 1, deletedAt: null,
});

beforeEach(() => {
  createNote.mockReset().mockResolvedValue(undefined);
  updateNote.mockReset().mockResolvedValue(undefined);
  state = {
    sections: [{ id: "s1", ownerId: "u1", name: "Travail", order: 0, createdAt: 1, updatedAt: 1, deletedAt: null }],
    notes: [note("n1", "s1", "Note A")],
  };
});

describe("NotesModule", () => {
  it("lists sections and the notes of the selected section", async () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <NotesModule />
      </MemoryRouter>
    );
    await waitFor(() => expect(screen.getByText("Travail")).toBeInTheDocument());
    // first section auto-selected → its note shows
    expect(screen.getByRole("button", { name: /Note A/ })).toBeInTheDocument();
  });

  it("opens a note in the editor and saves edits", async () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <NotesModule />
      </MemoryRouter>
    );
    await waitFor(() => expect(screen.getByRole("button", { name: /Note A/ })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /Note A/ }));
    expect(screen.getByTestId("note-editor")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Titre de la note"), { target: { value: "Note A modifiée" } });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    await waitFor(() => expect(updateNote).toHaveBeenCalledTimes(1));
    expect(updateNote.mock.calls[0]![0]).toBe("n1");
    expect((updateNote.mock.calls[0]![1] as { title: string }).title).toBe("Note A modifiée");
  });

  it("opens focused note from ?focus= deep-link", async () => {
    state = {
      sections: [{ id: "s1", ownerId: "u1", name: "Travail", order: 0, createdAt: 1, updatedAt: 1, deletedAt: null }],
      notes: [
        note("n1", "s1", "Note A"),
        note("n9", "s1", "Roadmap"),
      ],
    };
    render(
      <MemoryRouter initialEntries={["/notepad?focus=n9"]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <NotesModule />
      </MemoryRouter>
    );
    await waitFor(() => expect(screen.getByDisplayValue("Roadmap")).toBeInTheDocument());
  });
});
