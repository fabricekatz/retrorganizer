import { z } from "zod";

const labeledValue = z.object({ label: z.string(), value: z.string() });
const postalAddress = z.object({
  label: z.string(),
  street: z.string(),
  city: z.string(),
  postalCode: z.string(),
  country: z.string(),
});
const labeledDate = z.object({ label: z.string(), date: z.string() });
const keyValue = z.object({ key: z.string(), value: z.string() });

export const contactSchema = z.object({
  id: z.string(),
  ownerId: z.string().min(1),
  createdAt: z.number(),
  updatedAt: z.number(),
  deletedAt: z.number().nullable(),
  firstName: z.string().default(""),
  lastName: z.string().default(""),
  displayName: z.string().min(1),
  organization: z.string().optional(),
  title: z.string().optional(),
  photoUrl: z.string().optional(), // small resized thumbnail (data URL) or external URL
  phones: z.array(labeledValue).default([]),
  emails: z.array(labeledValue).default([]),
  addresses: z.array(postalAddress).default([]),
  webLinks: z.array(labeledValue).default([]),
  importantDates: z.array(labeledDate).default([]),
  notes: z.string().optional(),
  customFields: z.array(keyValue).default([]),
  categoryId: z.string().nullable().default(null),
  tags: z.array(z.string()).default([]),
});

export type Contact = z.infer<typeof contactSchema>;

export function parseContact(input: unknown): Contact {
  return contactSchema.parse(input);
}
