import { useCallback, useEffect, useState } from "react";
import { callsRepo, type Call, type CallDraft } from "@retrorganizer/core";
import { useAuth } from "../auth/AuthProvider";

export interface UseCalls {
  calls: Call[];
  loading: boolean;
  error: string | null;
  create(d: CallDraft): Promise<void>;
  update(id: string, d: CallDraft): Promise<void>;
  remove(id: string): Promise<void>;
  reload(): Promise<void>;
}

export function useCalls(): UseCalls {
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  const [calls, setCalls] = useState<Call[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!uid) { setCalls([]); setError(null); setLoading(false); return; }
    setLoading(true); setError(null);
    try { setCalls(await callsRepo.listByOwner(uid)); }
    catch (e) { setError(e instanceof Error ? e.message : "Échec du chargement"); }
    finally { setLoading(false); }
  }, [uid]);

  useEffect(() => { void reload(); }, [reload]);

  const create = useCallback(async (d: CallDraft) => {
    if (!uid) return;
    try { await callsRepo.create(uid, d); }
    catch (e) { setError(e instanceof Error ? e.message : "Échec de l'enregistrement"); return; }
    await reload();
  }, [uid, reload]);

  const update = useCallback(async (id: string, d: CallDraft) => {
    try { await callsRepo.update(id, d); }
    catch (e) { setError(e instanceof Error ? e.message : "Échec de l'enregistrement"); return; }
    await reload();
  }, [reload]);

  const remove = useCallback(async (id: string) => {
    try { await callsRepo.softDelete(id); }
    catch (e) { setError(e instanceof Error ? e.message : "Échec de la suppression"); return; }
    await reload();
  }, [reload]);

  return { calls, loading, error, create, update, remove, reload };
}
