import { useCallback, useEffect, useState } from "react";
import { contactsRepo, type Contact, type ContactDraft } from "@retrorganizer/core";
import { useAuth } from "../auth/AuthProvider";

export interface UseContacts {
  contacts: Contact[];
  loading: boolean;
  error: string | null;
  create(d: ContactDraft): Promise<void>;
  update(id: string, d: ContactDraft): Promise<void>;
  remove(id: string): Promise<void>;
  reload(): Promise<void>;
}

export function useContacts(): UseContacts {
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!uid) { setContacts([]); setError(null); setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      setContacts(await contactsRepo.listByOwner(uid));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Échec du chargement");
    } finally {
      setLoading(false);
    }
  }, [uid]);

  useEffect(() => { void reload(); }, [reload]);

  const create = useCallback(async (d: ContactDraft) => {
    if (!uid) return;
    try { await contactsRepo.create(uid, d); }
    catch (e) { setError(e instanceof Error ? e.message : "Échec de l'enregistrement"); return; }
    await reload();
  }, [uid, reload]);

  const update = useCallback(async (id: string, d: ContactDraft) => {
    try { await contactsRepo.update(id, d); }
    catch (e) { setError(e instanceof Error ? e.message : "Échec de l'enregistrement"); return; }
    await reload();
  }, [reload]);

  const remove = useCallback(async (id: string) => {
    try { await contactsRepo.softDelete(id); }
    catch (e) { setError(e instanceof Error ? e.message : "Échec de la suppression"); return; }
    await reload();
  }, [reload]);

  return { contacts, loading, error, create, update, remove, reload };
}
