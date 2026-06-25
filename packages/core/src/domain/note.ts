import { z } from "zod";

export function emptyDoc(): { type: "doc"; content: [] } {
  return { type: "doc", content: [] };
}

export const noteSectionSchema = z.object({
  id: z.string(),
  ownerId: z.string().min(1),
  createdAt: z.number(),
  updatedAt: z.number(),
  deletedAt: z.number().nullable(),
  name: z.string().min(1),
  order: z.number().default(0),
});
export type NoteSection = z.infer<typeof noteSectionSchema>;
export function parseNoteSection(input: unknown): NoteSection {
  return noteSectionSchema.parse(input);
}

const linkedEntity = z.object({ type: z.string(), id: z.string() });

export const noteSchema = z.object({
  id: z.string(),
  ownerId: z.string().min(1),
  createdAt: z.number(),
  updatedAt: z.number(),
  deletedAt: z.number().nullable(),
  sectionId: z.string(),
  title: z.string().default(""),
  body: z.any().default(() => emptyDoc()),
  linkedEntities: z.array(linkedEntity).default([]),
  tags: z.array(z.string()).default([]),
});
export type Note = z.infer<typeof noteSchema>;
export function parseNote(input: unknown): Note {
  return noteSchema.parse(input);
}

export interface NoteDraft {
  sectionId: string;
  title: string;
  body: unknown;
  linkedEntities: { type: string; id: string }[];
  tags: string[];
}

export function emptyNoteDraft(sectionId: string): NoteDraft {
  return { sectionId, title: "", body: emptyDoc(), linkedEntities: [], tags: [] };
}

export function draftFromNote(n: Note): NoteDraft {
  return {
    sectionId: n.sectionId,
    title: n.title,
    body: n.body,
    linkedEntities: n.linkedEntities.map((l) => ({ ...l })),
    tags: [...n.tags],
  };
}

export interface NoteSectionDraft {
  name: string;
  order: number;
}
export function emptyNoteSectionDraft(): NoteSectionDraft {
  return { name: "", order: 0 };
}
