"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { NormalizedJob } from "./shared-types";

/**
 * The framework's authoritative tracker status vocabulary, defined once in
 * `.claude/commands/outcome.md` ("Tracker status vocabulary", pinned by
 * tests/test_tracker_status_vocab.py). Underscores, never spaces. We reuse it
 * verbatim so a CSV exported here drops straight into /rank, /apply and
 * /outcome without any mapping.
 */
export type TrackerStatus =
  | "drafted"
  | "applied"
  | "interview"
  | "offer"
  | "hired"
  | "rejected"
  | "no_response"
  | "offer_declined"
  | "withdrawn";

export const TRACKER_STATUSES: {
  id: TrackerStatus;
  label: string;
  /** tailwind classes for a filled pill */
  pill: string;
  /** tailwind class for the legend dot */
  dot: string;
  final: boolean;
}[] = [
  { id: "drafted", label: "Drafted", pill: "border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-300", dot: "bg-amber-500", final: false },
  { id: "applied", label: "Applied", pill: "border-sky-500/50 bg-sky-500/10 text-sky-700 dark:text-sky-300", dot: "bg-sky-500", final: false },
  { id: "interview", label: "Interview", pill: "border-violet-500/50 bg-violet-500/10 text-violet-700 dark:text-violet-300", dot: "bg-violet-500", final: false },
  { id: "offer", label: "Offer", pill: "border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300", dot: "bg-emerald-500", final: false },
  { id: "hired", label: "Hired", pill: "border-emerald-600/60 bg-emerald-600/15 text-emerald-800 dark:text-emerald-200", dot: "bg-emerald-600", final: true },
  { id: "rejected", label: "Rejected", pill: "border-rose-500/50 bg-rose-500/10 text-rose-700 dark:text-rose-300", dot: "bg-rose-500", final: true },
  { id: "no_response", label: "No response", pill: "border-zinc-400/50 bg-zinc-400/10 text-zinc-600 dark:text-zinc-300", dot: "bg-zinc-400", final: true },
  { id: "offer_declined", label: "Offer declined", pill: "border-orange-500/50 bg-orange-500/10 text-orange-700 dark:text-orange-300", dot: "bg-orange-500", final: true },
  { id: "withdrawn", label: "Withdrawn", pill: "border-zinc-400/50 bg-zinc-400/10 text-zinc-600 dark:text-zinc-300", dot: "bg-zinc-500", final: true },
];

const STATUS_MAP = new Map(TRACKER_STATUSES.map((s) => [s.id, s]));

export function trackerStatusMeta(id: TrackerStatus) {
  return STATUS_MAP.get(id) ?? TRACKER_STATUSES[0];
}

export function isTrackerStatus(v: unknown): v is TrackerStatus {
  return typeof v === "string" && STATUS_MAP.has(v as TrackerStatus);
}

/** One recorded tracker-stage change (append-only log). */
export interface StatusTransition {
  /** Previous stage, or null when the item had no explicit stage yet. */
  from: TrackerStatus | null;
  to: TrackerStatus;
  /** ISO timestamp of the change. */
  at: string;
}

export interface ShortlistItem {
  /** `${portalId}:${jobId}` composite key. */
  key: string;
  portalId: string;
  portalName: string;
  job: NormalizedJob;
  starredAt: string;
  /** Tracker CSV status column — defaults to "drafted" for older stored items. */
  status?: TrackerStatus;
  /** Append-only log of stage transitions (newest last), surfaced in the UI + CSV notes. */
  statusHistory?: StatusTransition[];
}

interface ShortlistContextValue {
  items: ShortlistItem[];
  keys: Set<string>;
  toggle: (portalId: string, portalName: string, job: NormalizedJob) => void;
  remove: (key: string) => void;
  clear: () => void;
  isStarred: (portalId: string, jobId: string) => boolean;
  /** Move a shortlisted application along the tracker status vocabulary. */
  setStatus: (key: string, status: TrackerStatus) => void;
  /** Move several shortlisted applications at once (bulk toolbar). */
  setBulkStatus: (keys: string[], status: TrackerStatus) => void;
  hydrated: boolean;
}

const STORAGE_KEY = "aijs.shortlist.v1";

const ShortlistContext = createContext<ShortlistContextValue | null>(null);

function parseStored(raw: string | null): ShortlistItem[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (it): it is ShortlistItem =>
        !!it && typeof it === "object" && typeof (it as ShortlistItem).key === "string" && !!(it as ShortlistItem).job,
    );
  } catch {
    return [];
  }
}

export function ShortlistProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ShortlistItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // Hydrate from localStorage after mount — must not run during SSR.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setItems(parseStored(window.localStorage.getItem(STORAGE_KEY)));
     
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items, hydrated]);

  const toggle = useCallback((portalId: string, portalName: string, job: NormalizedJob) => {
    const key = `${portalId}:${job.id}`;
    setItems((prev) =>
      prev.some((it) => it.key === key)
        ? prev.filter((it) => it.key !== key)
        : [{ key, portalId, portalName, job, starredAt: new Date().toISOString() }, ...prev],
    );
  }, []);

  const remove = useCallback((key: string) => {
    setItems((prev) => prev.filter((it) => it.key !== key));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  /**
   * Stage change with an append-only transition log. Re-setting the same
   * stage is a no-op (no duplicate log entries).
   */
  const setStatus = useCallback((key: string, status: TrackerStatus) => {
    setItems((prev) =>
      prev.map((it) => {
        if (it.key !== key || (it.status ?? "drafted") === status) return it;
        const entry: StatusTransition = { from: it.status ?? null, to: status, at: new Date().toISOString() };
        return { ...it, status, statusHistory: [...(it.statusHistory ?? []), entry] };
      }),
    );
  }, []);

  const setBulkStatus = useCallback((keys: string[], status: TrackerStatus) => {
    const keySet = new Set(keys);
    setItems((prev) =>
      prev.map((it) => {
        if (!keySet.has(it.key) || (it.status ?? "drafted") === status) return it;
        const entry: StatusTransition = { from: it.status ?? null, to: status, at: new Date().toISOString() };
        return { ...it, status, statusHistory: [...(it.statusHistory ?? []), entry] };
      }),
    );
  }, []);

  const value = useMemo<ShortlistContextValue>(
    () => ({
      items,
      keys: new Set(items.map((it) => it.key)),
      toggle,
      remove,
      clear,
      setStatus,
      setBulkStatus,
      isStarred: (portalId: string, jobId: string) => items.some((it) => it.key === `${portalId}:${jobId}`),
      hydrated,
    }),
    [items, toggle, remove, clear, setStatus, setBulkStatus, hydrated],
  );

  return <ShortlistContext.Provider value={value}>{children}</ShortlistContext.Provider>;
}

export function useShortlist(): ShortlistContextValue {
  const ctx = useContext(ShortlistContext);
  if (!ctx) throw new Error("useShortlist must be used inside <ShortlistProvider>");
  return ctx;
}

/** Escape a single CSV field per RFC 4180 (quotes, commas, newlines). */
function csvField(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

const TRACKER_HEADER =
  "date,company,sector,role,role_type,channel,status,contact_person,fit_rating,notes,cv_file,cover_letter_file,source,deadline";

/** Compact history for the CSV notes column: `drafted→applied@2026-01-02` (newest last). */
export function formatStatusHistory(item: ShortlistItem): string {
  if (!item.statusHistory || item.statusHistory.length === 0) return "";
  return item.statusHistory
    .map((t) => `${t.from ?? "(new)"}→${t.to}@${t.at.slice(0, 10)}`)
    .join(", ");
}

/**
 * Export shortlisted jobs in the framework's `job_search_tracker.csv` format
 * (see /apply + /outcome — identical 14-column header). The status column
 * carries each item's live tracker status (defaulting to `drafted`), using the
 * exact canonical spellings from the framework's Tracker status vocabulary.
 * The notes column appends the per-item stage-transition log when present.
 */
export function buildTrackerCsv(items: ShortlistItem[], boardName: (portalId: string) => string): string {
  const today = new Date().toISOString().slice(0, 10);
  const rows = items.map((it) => {
    const history = formatStatusHistory(it);
    const notes = `Shortlisted from ${it.portalName} via sandbox Control Center${history ? ` | stages: ${history}` : ""}`;
    const cells = [
      today,
      it.job.company ?? "",
      "", // sector — filled later by /rank or /outcome
      it.job.title,
      "", // role_type
      boardName(it.portalId),
      it.status ?? "drafted",
      "", // contact_person
      "", // fit_rating
      notes,
      "", // cv_file
      "", // cover_letter_file
      it.job.url ?? "",
      it.job.deadline ?? "",
    ];
    return cells.map(csvField).join(",");
  });
  return [TRACKER_HEADER, ...rows].join("\r\n");
}
