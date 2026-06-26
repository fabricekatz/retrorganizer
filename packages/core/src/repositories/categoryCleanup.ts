import { contactsRepo } from "./contacts";
import { tasksRepo } from "./tasks";
import { eventsRepo } from "./events";

// Null categoryId on every contact, task, and event that references the given
// category. Call before soft-deleting a category so nothing keeps a dangling
// reference. Notes have no categoryId and are not touched.
export async function clearCategoryReferences(ownerId: string, categoryId: string): Promise<void> {
  const [contacts, tasks, events] = await Promise.all([
    contactsRepo.listByOwner(ownerId),
    tasksRepo.listByOwner(ownerId),
    eventsRepo.listByOwner(ownerId),
  ]);
  await Promise.all([
    ...contacts.filter((c) => c.categoryId === categoryId).map((c) => contactsRepo.update(c.id, { categoryId: null })),
    ...tasks.filter((t) => t.categoryId === categoryId).map((t) => tasksRepo.update(t.id, { categoryId: null })),
    ...events.filter((e) => e.categoryId === categoryId).map((e) => eventsRepo.update(e.id, { categoryId: null })),
  ]);
}
