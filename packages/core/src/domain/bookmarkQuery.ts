import type { Bookmark } from "./bookmark";

export function filterBookmarks(bs: Bookmark[], q: string): Bookmark[] {
  const needle = q.trim().toLowerCase();
  if (needle === "") return bs;
  return bs.filter((b) =>
    b.title.toLowerCase().includes(needle) ||
    b.url.toLowerCase().includes(needle) ||
    b.description.toLowerCase().includes(needle),
  );
}

export function sortBookmarks(bs: Bookmark[]): Bookmark[] {
  return [...bs].sort((a, b) => a.title.toLowerCase().localeCompare(b.title.toLowerCase()));
}
