import { z } from "zod";

export type CallDirection = "incoming" | "outgoing" | "missed";

export const callSchema = z.object({
  id: z.string(),
  ownerId: z.string().min(1),
  createdAt: z.number(),
  updatedAt: z.number(),
  deletedAt: z.number().nullable(),
  contactId: z.string().nullable().default(null),
  contactName: z.string().default(""),
  phoneNumber: z.string().default(""),
  direction: z.enum(["incoming", "outgoing", "missed"]).default("outgoing"),
  occurredAt: z.number(),
  durationMin: z.number().default(0),
  notes: z.string().default(""),
  categoryId: z.string().nullable().default(null),
  tags: z.array(z.string()).default([]),
});

export type Call = z.infer<typeof callSchema>;

export function parseCall(input: unknown): Call {
  return callSchema.parse(input);
}

export interface CallDraft {
  contactId: string | null;
  contactName: string;
  phoneNumber: string;
  direction: CallDirection;
  occurredAt: number;
  durationMin: number;
  notes: string;
  categoryId: string | null;
  tags: string[];
}

export function emptyCallDraft(): CallDraft {
  return {
    contactId: null, contactName: "", phoneNumber: "", direction: "outgoing",
    occurredAt: 0, durationMin: 0, notes: "", categoryId: null, tags: [],
  };
}

export function draftFromCall(c: Call): CallDraft {
  return {
    contactId: c.contactId, contactName: c.contactName, phoneNumber: c.phoneNumber,
    direction: c.direction, occurredAt: c.occurredAt, durationMin: c.durationMin,
    notes: c.notes, categoryId: c.categoryId, tags: [...c.tags],
  };
}
