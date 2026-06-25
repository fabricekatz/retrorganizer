import MiniSearch from "minisearch";
import type { Contact } from "../domain/contact";
import type { Event } from "../domain/event";
import type { Task } from "../domain/task";
import type { Note } from "../domain/note";

export function tiptapToText(body: unknown): string {
  const out: string[] = [];
  function walk(node: unknown): void {
    if (!node || typeof node !== "object") return;
    const n = node as { text?: unknown; content?: unknown };
    if (typeof n.text === "string") out.push(n.text);
    if (Array.isArray(n.content)) n.content.forEach(walk);
  }
  walk(body);
  return out.join(" ");
}

export type SearchType = "contact" | "event" | "task" | "note";

export interface SearchDoc {
  id: string;
  type: SearchType;
  entityId: string;
  title: string;
  text: string;
  path: string;
}

export interface SearchData {
  contacts: Contact[];
  events: Event[];
  tasks: Task[];
  notes: Note[];
}

export interface SearchResult {
  id: string;
  type: SearchType;
  entityId: string;
  title: string;
  path: string;
}

export function buildSearchDocs(data: SearchData): SearchDoc[] {
  const docs: SearchDoc[] = [];
  for (const c of data.contacts) {
    docs.push({
      id: `contact:${c.id}`, type: "contact", entityId: c.id, title: c.displayName, path: "/address",
      text: [c.organization ?? "", ...c.emails.map((e) => e.value), ...c.phones.map((p) => p.value), c.notes ?? ""].join(" "),
    });
  }
  for (const e of data.events) {
    docs.push({ id: `event:${e.id}`, type: "event", entityId: e.id, title: e.title, path: "/diary", text: `${e.location} ${e.notes}` });
  }
  for (const t of data.tasks) {
    docs.push({ id: `task:${t.id}`, type: "task", entityId: t.id, title: t.title, path: "/todo", text: t.description });
  }
  for (const n of data.notes) {
    docs.push({ id: `note:${n.id}`, type: "note", entityId: n.id, title: n.title || "(sans titre)", path: "/notepad", text: tiptapToText(n.body) });
  }
  return docs;
}

export function buildSearchIndex(docs: SearchDoc[]): MiniSearch<SearchDoc> {
  const index = new MiniSearch<SearchDoc>({
    fields: ["title", "text"],
    storeFields: ["type", "entityId", "title", "path"],
    searchOptions: { prefix: true, fuzzy: 0.2, boost: { title: 2 } },
  });
  index.addAll(docs);
  return index;
}

export function runSearch(index: MiniSearch<SearchDoc>, query: string): SearchResult[] {
  if (query.trim() === "") return [];
  return index.search(query).map((r) => ({
    id: String(r.id),
    type: r["type"] as SearchType,
    entityId: r["entityId"] as string,
    title: r["title"] as string,
    path: r["path"] as string,
  }));
}
