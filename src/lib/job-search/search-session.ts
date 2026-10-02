"use client";

import type { SearchResponse } from "./shared-types";

/**
 * Session-scoped persistence for the last live search so a page reload
 * restores the results instantly instead of showing an empty console.
 * Uses sessionStorage (dies with the tab) — the shortlist stays in
 * localStorage; this is just view state for the current browsing session.
 */

const STORAGE_KEY = "aijs.lastsearch.v1";

/** Full search-console form snapshot (top-level fields + advanced filters). */
export interface StoredSearchForm {
  portal: string;
  query: string;
  location: string;
  jobAge: string;
  limit: string;
  remote: string;
  seniority: string;
  freehireCategory: string;
  freehireCountry: string;
  municipality: string;
  region: string;
  zip: string;
  jobtitleId: { id: string; title: string } | null;
  freehireSkill: string[];
  freehireCompany: { name: string; slug: string } | null;
  freehireRegion: string[];
  jobdanmarkCategory: { id: string; title: string } | null;
  /** Client-side deadline window (view filter, restored with the results). */
  deadlineMode?: string;
  deadlineFrom?: string;
  deadlineTo?: string;
}

export interface StoredSearch {
  form: StoredSearchForm;
  response: SearchResponse;
  savedAt: string;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

export function saveLastSearch(stored: StoredSearch): void {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  } catch {
    // sessionStorage unavailable (private mode / quota) — view state only, ignore.
  }
}

export function loadLastSearch(): StoredSearch | null {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || !isRecord(parsed.form) || !isRecord(parsed.response)) return null;
    const form = parsed.form as Partial<StoredSearchForm>;
    const response = parsed.response as Partial<SearchResponse>;
    if (
      typeof form.portal !== "string" ||
      typeof form.query !== "string" ||
      !Array.isArray(response.outcomes)
    ) {
      return null;
    }
    return parsed as unknown as StoredSearch;
  } catch {
    return null;
  }
}

export function clearLastSearch(): void {
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
