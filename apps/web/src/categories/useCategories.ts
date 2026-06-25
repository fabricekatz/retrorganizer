import { useCallback, useEffect, useState } from "react";
import { categoriesRepo, type Category, type CategoryDraft } from "@retrorganizer/core";
import { useAuth } from "../auth/AuthProvider";

export interface UseCategories {
  categories: Category[];
  loading: boolean;
  error: string | null;
  createCategory(d: CategoryDraft): Promise<string | null>;
  updateCategory(id: string, patch: Partial<Category>): Promise<void>;
  removeCategory(id: string): Promise<void>;
  reload(): Promise<void>;
}

export function useCategories(): UseCategories {
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!uid) { setCategories([]); setError(null); setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      setCategories(await categoriesRepo.listByOwner(uid));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Échec du chargement");
    } finally {
      setLoading(false);
    }
  }, [uid]);

  useEffect(() => { void reload(); }, [reload]);

  const createCategory = useCallback(async (d: CategoryDraft): Promise<string | null> => {
    if (!uid) return null;
    let id: string | null = null;
    try {
      const created = await categoriesRepo.create(uid, d);
      id = created.id;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Échec de l'enregistrement");
      return null;
    }
    await reload();
    return id;
  }, [uid, reload]);

  const updateCategory = useCallback(async (id: string, patch: Partial<Category>) => {
    try { await categoriesRepo.update(id, patch); }
    catch (e) { setError(e instanceof Error ? e.message : "Échec de l'enregistrement"); return; }
    await reload();
  }, [reload]);

  const removeCategory = useCallback(async (id: string) => {
    try { await categoriesRepo.softDelete(id); }
    catch (e) { setError(e instanceof Error ? e.message : "Échec de la suppression"); return; }
    await reload();
  }, [reload]);

  return { categories, loading, error, createCategory, updateCategory, removeCategory, reload };
}
