import { useCallback, useEffect, useState } from "react";
import { bookmarksRepo, type Bookmark, type BookmarkDraft } from "@retrorganizer/core";
import { useAuth } from "../auth/AuthProvider";

export interface UseBookmarks {
  bookmarks: Bookmark[];
  loading: boolean;
  error: string | null;
  create(d: BookmarkDraft): Promise<void>;
  update(id: string, d: BookmarkDraft): Promise<void>;
  remove(id: string): Promise<void>;
  reload(): Promise<void>;
}

export function useBookmarks(): UseBookmarks {
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!uid) { setBookmarks([]); setError(null); setLoading(false); return; }
    setLoading(true); setError(null);
    try { setBookmarks(await bookmarksRepo.listByOwner(uid)); }
    catch (e) { setError(e instanceof Error ? e.message : "Échec du chargement"); }
    finally { setLoading(false); }
  }, [uid]);

  useEffect(() => { void reload(); }, [reload]);

  const create = useCallback(async (d: BookmarkDraft) => {
    if (!uid) return;
    try { await bookmarksRepo.create(uid, d); }
    catch (e) { setError(e instanceof Error ? e.message : "Échec de l'enregistrement"); return; }
    await reload();
  }, [uid, reload]);

  const update = useCallback(async (id: string, d: BookmarkDraft) => {
    try { await bookmarksRepo.update(id, d); }
    catch (e) { setError(e instanceof Error ? e.message : "Échec de l'enregistrement"); return; }
    await reload();
  }, [reload]);

  const remove = useCallback(async (id: string) => {
    try { await bookmarksRepo.softDelete(id); }
    catch (e) { setError(e instanceof Error ? e.message : "Échec de la suppression"); return; }
    await reload();
  }, [reload]);

  return { bookmarks, loading, error, create, update, remove, reload };
}
