import { z } from "zod";

export const categorySchema = z.object({
  id: z.string(),
  ownerId: z.string().min(1),
  createdAt: z.number(),
  updatedAt: z.number(),
  deletedAt: z.number().nullable(),
  name: z.string().min(1),
  color: z.string().default("#7a766a"),
});

export type Category = z.infer<typeof categorySchema>;

export function parseCategory(input: unknown): Category {
  return categorySchema.parse(input);
}

export interface CategoryDraft {
  name: string;
  color: string;
}

export function emptyCategoryDraft(): CategoryDraft {
  return { name: "", color: "#7a766a" };
}

export function categoryById(categories: Category[], id: string | null): Category | undefined {
  if (id === null) return undefined;
  return categories.find((c) => c.id === id);
}
