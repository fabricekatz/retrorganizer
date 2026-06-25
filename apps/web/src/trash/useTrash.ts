import { useCallback, useEffect, useState } from "react";
import { contactsRepo, eventsRepo, tasksRepo, notesRepo, categoriesRepo } from "@retrorganizer/core";
import { useAuth } from "../auth/AuthProvider";

export type TrashType = "contact" | "event" | "task" | "note" | "category";

export interface TrashItem {
  type: TrashType;
  id: string;
  title: string;
}

const REPOS = {
  contact: contactsRepo, event: eventsRepo, task: tasksRepo, note: notesRepo, category: categoriesRepo,
} as const;

export interface UseTrash {
  items: TrashItem[];
  loading: boolean;
  error: string | null;
  restore(item: TrashItem): Promise<void>;
  purge(item: TrashItem): Promise<void>;
  reload(): Promise<void>;
}

export function useTrash(): UseTrash {
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  const [items, setItems] = useState<TrashItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!uid) { setItems([]); setError(null); setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const [contacts, events, tasks, notes, categories] = await Promise.all([
        contactsRepo.listDeletedByOwner(uid), eventsRepo.listDeletedByOwner(uid),
        tasksRepo.listDeletedByOwner(uid), notesRepo.listDeletedByOwner(uid),
        categoriesRepo.listDeletedByOwner(uid),
      ]);
      setItems([
        ...contacts.map((c) => ({ type: "contact" as const, id: c.id, title: c.displayName })),
        ...events.map((e) => ({ type: "event" as const, id: e.id, title: e.title })),
        ...tasks.map((t) => ({ type: "task" as const, id: t.id, title: t.title })),
        ...notes.map((n) => ({ type: "note" as const, id: n.id, title: n.title || "(sans titre)" })),
        ...categories.map((c) => ({ type: "category" as const, id: c.id, title: c.name })),
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Échec du chargement");
    } finally {
      setLoading(false);
    }
  }, [uid]);

  useEffect(() => { void reload(); }, [reload]);

  const restore = useCallback(async (item: TrashItem) => {
    try { await REPOS[item.type].restore(item.id); }
    catch (e) { setError(e instanceof Error ? e.message : "Échec de la restauration"); return; }
    await reload();
  }, [reload]);

  const purge = useCallback(async (item: TrashItem) => {
    try { await REPOS[item.type].hardDelete(item.id); }
    catch (e) { setError(e instanceof Error ? e.message : "Échec de la suppression"); return; }
    await reload();
  }, [reload]);

  return { items, loading, error, restore, purge, reload };
}
