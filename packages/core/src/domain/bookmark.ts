import { z } from "zod";

export const bookmarkSchema = z.object({
  id: z.string(),
  ownerId: z.string().min(1),
  createdAt: z.number(),
  updatedAt: z.number(),
  deletedAt: z.number().nullable(),
  title: z.string().min(1),
  url: z.string().min(1),
  description: z.string().default(""),
  categoryId: z.string().nullable().default(null),
  tags: z.array(z.string()).default([]),
});

export type Bookmark = z.infer<typeof bookmarkSchema>;

export function parseBookmark(input: unknown): Bookmark {
  return bookmarkSchema.parse(input);
}

export interface BookmarkDraft {
  title: string;
  url: string;
  description: string;
  categoryId: string | null;
  tags: string[];
}

export function emptyBookmarkDraft(): BookmarkDraft {
  return { title: "", url: "", description: "", categoryId: null, tags: [] };
}

export function draftFromBookmark(b: Bookmark): BookmarkDraft {
  return { title: b.title, url: b.url, description: b.description, categoryId: b.categoryId, tags: [...b.tags] };
}
