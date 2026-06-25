import { useCallback, useEffect, useState } from "react";
import {
  notesRepo, noteSectionsRepo,
  type Note, type NoteSection, type NoteDraft, type NoteSectionDraft,
} from "@retrorganizer/core";
import { useAuth } from "../auth/AuthProvider";

export interface UseNotes {
  sections: NoteSection[];
  notes: Note[];
  loading: boolean;
  error: string | null;
  createSection(d: NoteSectionDraft): Promise<void>;
  removeSection(id: string): Promise<void>;
  createNote(d: NoteDraft): Promise<void>;
  updateNote(id: string, patch: Partial<Note>): Promise<void>;
  removeNote(id: string): Promise<void>;
  reload(): Promise<void>;
}

export function useNotes(): UseNotes {
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  const [sections, setSections] = useState<NoteSection[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!uid) { setSections([]); setNotes([]); setError(null); setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const [s, n] = await Promise.all([noteSectionsRepo.listByOwner(uid), notesRepo.listByOwner(uid)]);
      setSections(s);
      setNotes(n);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Échec du chargement");
    } finally {
      setLoading(false);
    }
  }, [uid]);

  useEffect(() => { void reload(); }, [reload]);

  const createSection = useCallback(async (d: NoteSectionDraft) => {
    if (!uid) return;
    try { await noteSectionsRepo.create(uid, d); }
    catch (e) { setError(e instanceof Error ? e.message : "Échec de l'enregistrement"); return; }
    await reload();
  }, [uid, reload]);

  const removeSection = useCallback(async (id: string) => {
    try { await noteSectionsRepo.softDelete(id); }
    catch (e) { setError(e instanceof Error ? e.message : "Échec de la suppression"); return; }
    await reload();
  }, [reload]);

  const createNote = useCallback(async (d: NoteDraft) => {
    if (!uid) return;
    try { await notesRepo.create(uid, d); }
    catch (e) { setError(e instanceof Error ? e.message : "Échec de l'enregistrement"); return; }
    await reload();
  }, [uid, reload]);

  const updateNote = useCallback(async (id: string, patch: Partial<Note>) => {
    try { await notesRepo.update(id, patch); }
    catch (e) { setError(e instanceof Error ? e.message : "Échec de l'enregistrement"); return; }
    await reload();
  }, [reload]);

  const removeNote = useCallback(async (id: string) => {
    try { await notesRepo.softDelete(id); }
    catch (e) { setError(e instanceof Error ? e.message : "Échec de la suppression"); return; }
    await reload();
  }, [reload]);

  return { sections, notes, loading, error, createSection, removeSection, createNote, updateNote, removeNote, reload };
}
