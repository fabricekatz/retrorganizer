import { z } from "zod";

export const subtaskSchema = z.object({ title: z.string(), done: z.boolean() });
export type Subtask = z.infer<typeof subtaskSchema>;

export type TaskPriority = "low" | "normal" | "high";
export type TaskStatus = "todo" | "in_progress" | "done";

export const taskSchema = z.object({
  id: z.string(),
  ownerId: z.string().min(1),
  createdAt: z.number(),
  updatedAt: z.number(),
  deletedAt: z.number().nullable(),
  title: z.string().min(1),
  description: z.string().default(""),
  priority: z.enum(["low", "normal", "high"]).default("normal"),
  dueDate: z.number().nullable().default(null),
  status: z.enum(["todo", "in_progress", "done"]).default("todo"),
  completedAt: z.number().nullable().default(null),
  subtasks: z.array(subtaskSchema).default([]),
  recurrence: z.string().nullable().default(null),
  contactIds: z.array(z.string()).default([]),
  eventId: z.string().nullable().default(null),
  categoryId: z.string().nullable().default(null),
  tags: z.array(z.string()).default([]),
  reminderOffsets: z.array(z.number()).default([]),
});

export type Task = z.infer<typeof taskSchema>;

export function parseTask(input: unknown): Task {
  return taskSchema.parse(input);
}

export interface TaskDraft {
  title: string;
  description: string;
  priority: TaskPriority;
  dueDate: number | null;
  status: TaskStatus;
  completedAt: number | null;
  subtasks: Subtask[];
  recurrence: string | null;
  contactIds: string[];
  eventId: string | null;
  categoryId: string | null;
  tags: string[];
  reminderOffsets: number[];
}

export function emptyTaskDraft(): TaskDraft {
  return {
    title: "", description: "", priority: "normal", dueDate: null, status: "todo",
    completedAt: null, subtasks: [], recurrence: null, contactIds: [], eventId: null,
    categoryId: null, tags: [], reminderOffsets: [],
  };
}

export function draftFromTask(t: Task): TaskDraft {
  return {
    title: t.title, description: t.description, priority: t.priority, dueDate: t.dueDate,
    status: t.status, completedAt: t.completedAt,
    subtasks: t.subtasks.map((s) => ({ ...s })),
    recurrence: t.recurrence, contactIds: [...t.contactIds], eventId: t.eventId,
    categoryId: t.categoryId, tags: [...t.tags], reminderOffsets: [...t.reminderOffsets],
  };
}
