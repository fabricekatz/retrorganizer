import { describe, it, expect } from "vitest";
import { tiptapToText, buildSearchDocs, buildSearchIndex, runSearch, type SearchData } from "./globalSearch";
import { parseContact } from "../domain/contact";
import { parseEvent } from "../domain/event";
import { parseTask } from "../domain/task";
import { parseNote } from "../domain/note";

const base = { ownerId: "u1", createdAt: 1, updatedAt: 1, deletedAt: null };

const data: SearchData = {
  contacts: [parseContact({ id: "c1", ...base, displayName: "Ada Lovelace", organization: "Analytical Engines" })],
  events: [parseEvent({ id: "e1", ...base, title: "Réunion budget", start: 1, end: 2 })],
  tasks: [parseTask({ id: "t1", ...base, title: "Acheter du pain", description: "boulangerie" })],
  notes: [parseNote({ id: "n1", ...base, sectionId: "s1", title: "Idées projet", body: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "lancer le prototype" }] }] } })],
};

describe("tiptapToText", () => {
  it("flattens a Tiptap doc to plain text", () => {
    expect(tiptapToText(data.notes[0]!.body)).toContain("lancer le prototype");
  });
  it("returns empty string for an empty doc", () => {
    expect(tiptapToText({ type: "doc", content: [] })).toBe("");
  });
});

describe("buildSearchDocs", () => {
  it("builds one doc per entity with the right type and path", () => {
    const docs = buildSearchDocs(data);
    expect(docs).toHaveLength(4);
    expect(docs.find((d) => d.type === "contact")?.path).toBe("/address");
    expect(docs.find((d) => d.type === "event")?.path).toBe("/diary");
    expect(docs.find((d) => d.type === "task")?.path).toBe("/todo");
    expect(docs.find((d) => d.type === "note")?.path).toBe("/notepad");
    expect(docs.find((d) => d.type === "note")?.text).toContain("lancer le prototype");
  });
});

describe("runSearch", () => {
  const index = buildSearchIndex(buildSearchDocs(data));
  it("returns [] for an empty query", () => {
    expect(runSearch(index, "  ")).toEqual([]);
  });
  it("finds a contact by name across types", () => {
    const r = runSearch(index, "lovelace");
    expect(r.map((x) => x.entityId)).toContain("c1");
    expect(r.find((x) => x.entityId === "c1")?.type).toBe("contact");
  });
  it("finds a note by body text", () => {
    expect(runSearch(index, "prototype").map((x) => x.entityId)).toContain("n1");
  });
  it("finds a task by description", () => {
    expect(runSearch(index, "boulangerie").map((x) => x.entityId)).toContain("t1");
  });
});
