import { useCallback, useEffect, useState } from "react";
import { tasksRepo, type Task, type TaskDraft } from "@retrorganizer/core";
import { useAuth } from "../auth/AuthProvider";

export interface UseTasks {
  tasks: Task[];
  loading: boolean;
  error: string | null;
  create(d: TaskDraft): Promise<void>;
  update(id: string, patch: Partial<Task>): Promise<void>;
  remove(id: string): Promise<void>;
  reload(): Promise<void>;
}

export function useTasks(): UseTasks {
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!uid) { setTasks([]); setError(null); setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      setTasks(await tasksRepo.listByOwner(uid));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Échec du chargement");
    } finally {
      setLoading(false);
    }
  }, [uid]);

  useEffect(() => { void reload(); }, [reload]);

  const create = useCallback(async (d: TaskDraft) => {
    if (!uid) return;
    try { await tasksRepo.create(uid, d); }
    catch (e) { setError(e instanceof Error ? e.message : "Échec de l'enregistrement"); return; }
    await reload();
  }, [uid, reload]);

  const update = useCallback(async (id: string, patch: Partial<Task>) => {
    try { await tasksRepo.update(id, patch); }
    catch (e) { setError(e instanceof Error ? e.message : "Échec de l'enregistrement"); return; }
    await reload();
  }, [reload]);

  const remove = useCallback(async (id: string) => {
    try { await tasksRepo.softDelete(id); }
    catch (e) { setError(e instanceof Error ? e.message : "Échec de la suppression"); return; }
    await reload();
  }, [reload]);

  return { tasks, loading, error, create, update, remove, reload };
}
