"use client";

import { useCallback, useEffect, useState } from "react";

export interface HistoryEntry {
  query: string;
  portal: string;
  location: string;
  jobAge: string;
  limit: string;
  at: string;
}

const STORAGE_KEY = "aijs.searchHistory.v1";
const MAX_ENTRIES = 6;

function parseStored(raw: string | null): HistoryEntry[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (e): e is HistoryEntry =>
          !!e && typeof e === "object" && typeof (e as HistoryEntry).query === "string",
      )
      .slice(0, MAX_ENTRIES);
  } catch {
    return [];
  }
}

export function useSearchHistory() {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // Hydrate from localStorage after mount — must not run during SSR.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEntries(parseStored(window.localStorage.getItem(STORAGE_KEY)));
     
    setHydrated(true);
  }, []);

  const push = useCallback((entry: HistoryEntry) => {
    setEntries((prev) => {
      const deduped = prev.filter(
        (e) => !(e.query === entry.query && e.portal === entry.portal && e.location === entry.location),
      );
      const next = [entry, ...deduped].slice(0, MAX_ENTRIES);
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    setEntries([]);
    window.localStorage.removeItem(STORAGE_KEY);
  }, []);

  /** Re-read localStorage — other hook instances (e.g. the palette) push entries. */
  const reload = useCallback(() => {
    setEntries(parseStored(window.localStorage.getItem(STORAGE_KEY)));
  }, []);

  return { entries, push, clear, reload, hydrated };
}
