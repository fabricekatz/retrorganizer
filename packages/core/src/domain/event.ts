import { z } from "zod";

export const eventSchema = z
  .object({
    id: z.string(),
    ownerId: z.string().min(1),
    createdAt: z.number(),
    updatedAt: z.number(),
    deletedAt: z.number().nullable(),
    title: z.string().min(1),
    start: z.number(),
    end: z.number(),
    allDay: z.boolean().default(false),
    location: z.string().default(""),
    notes: z.string().default(""),
    recurrence: z.string().nullable().default(null),
    recurrenceExceptions: z.array(z.number()).default([]),
    reminderOffsets: z.array(z.number()).default([]),
    contactIds: z.array(z.string()).default([]),
    taskIds: z.array(z.string()).default([]),
    categoryId: z.string().nullable().default(null),
    color: z.string().default(""),
    tags: z.array(z.string()).default([]),
  })
  .refine((e) => e.end >= e.start, { message: "end must be >= start", path: ["end"] });

export type Event = z.infer<typeof eventSchema>;

export function parseEvent(input: unknown): Event {
  return eventSchema.parse(input);
}

export interface EventDraft {
  title: string;
  start: number;
  end: number;
  allDay: boolean;
  location: string;
  notes: string;
  /** Bare RRULE value, e.g. "FREQ=WEEKLY;BYDAY=MO" — NOT prefixed with "RRULE:" and not a whole VEVENT. null = no recurrence. */
  recurrence: string | null;
  recurrenceExceptions: number[];
  reminderOffsets: number[];
  contactIds: string[];
  taskIds: string[];
  categoryId: string | null;
  color: string;
  tags: string[];
}

export function emptyEventDraft(): EventDraft {
  return {
    title: "", start: 0, end: 0, allDay: false, location: "", notes: "",
    recurrence: null, recurrenceExceptions: [], reminderOffsets: [],
    contactIds: [], taskIds: [], categoryId: null, color: "", tags: [],
  };
}

export function draftFromEvent(e: Event): EventDraft {
  return {
    title: e.title, start: e.start, end: e.end, allDay: e.allDay,
    location: e.location, notes: e.notes, recurrence: e.recurrence,
    recurrenceExceptions: [...e.recurrenceExceptions],
    reminderOffsets: [...e.reminderOffsets],
    contactIds: [...e.contactIds], taskIds: [...e.taskIds],
    categoryId: e.categoryId, color: e.color, tags: [...e.tags],
  };
}
