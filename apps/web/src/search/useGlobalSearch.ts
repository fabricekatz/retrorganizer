import { useCallback, useEffect, useMemo, useState } from "react";
import {
  contactsRepo, eventsRepo, tasksRepo, notesRepo,
  buildSearchDocs, buildSearchIndex, runSearch,
  type SearchData, type SearchResult,
} from "@retrorganizer/core";
import { useAuth } from "../auth/AuthProvider";

const EMPTY: SearchData = { contacts: [], events: [], tasks: [], notes: [] };

export interface UseGlobalSearch {
  query: string;
  setQuery(q: string): void;
  results: SearchResult[];
  loading: boolean;
}

export function useGlobalSearch(): UseGlobalSearch {
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  const [data, setData] = useState<SearchData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  const reload = useCallback(async () => {
    if (!uid) { setData(EMPTY); setLoading(false); return; }
    setLoading(true);
    try {
      const [contacts, events, tasks, notes] = await Promise.all([
        contactsRepo.listByOwner(uid), eventsRepo.listByOwner(uid),
        tasksRepo.listByOwner(uid), notesRepo.listByOwner(uid),
      ]);
      setData({ contacts, events, tasks, notes });
    } catch {
      setData(EMPTY);
    } finally {
      setLoading(false);
    }
  }, [uid]);

  useEffect(() => { void reload(); }, [reload]);

  const index = useMemo(() => buildSearchIndex(buildSearchDocs(data)), [data]);
  const results = useMemo(() => runSearch(index, query), [index, query]);

  return { query, setQuery, results, loading };
}
