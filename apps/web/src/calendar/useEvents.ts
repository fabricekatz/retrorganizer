import { useCallback, useEffect, useState } from "react";
import { eventsRepo, type Event, type EventDraft } from "@retrorganizer/core";
import { useAuth } from "../auth/AuthProvider";

export interface UseEvents {
  events: Event[];
  loading: boolean;
  error: string | null;
  create(d: EventDraft): Promise<void>;
  update(id: string, d: EventDraft): Promise<void>;
  remove(id: string): Promise<void>;
  reload(): Promise<void>;
}

export function useEvents(): UseEvents {
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!uid) { setEvents([]); setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      setEvents(await eventsRepo.listByOwner(uid));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Échec du chargement");
    } finally {
      setLoading(false);
    }
  }, [uid]);

  useEffect(() => { void reload(); }, [reload]);

  const create = useCallback(async (d: EventDraft) => {
    if (!uid) return;
    try { await eventsRepo.create(uid, d); await reload(); }
    catch (e) { setError(e instanceof Error ? e.message : "Échec de l'enregistrement"); }
  }, [uid, reload]);

  const update = useCallback(async (id: string, d: EventDraft) => {
    try { await eventsRepo.update(id, d); await reload(); }
    catch (e) { setError(e instanceof Error ? e.message : "Échec de l'enregistrement"); }
  }, [reload]);

  const remove = useCallback(async (id: string) => {
    try { await eventsRepo.softDelete(id); await reload(); }
    catch (e) { setError(e instanceof Error ? e.message : "Échec de la suppression"); }
  }, [reload]);

  return { events, loading, error, create, update, remove, reload };
}
