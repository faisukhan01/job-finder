"use client";

import { useMemo } from "react";
import { useShortlist, TRACKER_STATUSES, type TrackerStatus } from "@/lib/job-search/shortlist";
import { useFitProfile, scoreJob, FIT_BAND_STYLES } from "@/lib/job-search/fit-ranker";
import { CalendarClock, Route } from "lucide-react";

const PORTAL_COLORS: Record<string, string> = {
  jobindex: "bg-emerald-500",
  jobnet: "bg-teal-500",
  jobbank: "bg-cyan-500",
  jobdanmark: "bg-lime-500",
  linkedin: "bg-sky-500",
  freehire: "bg-violet-500",
};

const BAND_ORDER = ["strong", "good", "fair", "weak", "veto"] as const;

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const norm = iso.slice(0, 10);
  const then = new Date(`${norm}T00:00:00Z`).getTime();
  if (Number.isNaN(then)) return null;
  return Math.round((then - Date.now()) / 86_400_000);
}

/**
 * Compact analytics for the shortlist: distribution by portal (bars) and
 * by fit band (stacked bar), plus deadline urgency. Purely client-side.
 */
export function ShortlistAnalytics() {
  const { items } = useShortlist();
  const { profile, hydrated } = useFitProfile();

  const byPortal = useMemo(() => {
    const map = new Map<string, number>();
    for (const it of items) map.set(it.portalName, (map.get(it.portalName) ?? 0) + 1);
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [items]);

  const byBand = useMemo(() => {
    if (!hydrated) return null;
    const fitActive = profile.skills.length > 0 || profile.dealBreakers.length > 0;
    if (!fitActive) return null;
    const counts = new Map<string, number>();
    let scored = 0;
    for (const it of items) {
      const fit = scoreJob(profile, it.job);
      if (fit.score == null && fit.band !== "veto") continue;
      scored += 1;
      counts.set(fit.band, (counts.get(fit.band) ?? 0) + 1);
    }
    return { counts, scored, total: items.length };
  }, [items, profile, hydrated]);

  const dueSoon = useMemo(() => {
    return items
      .map((it) => ({ it, d: daysUntil(it.job.deadline) }))
      .filter((x): x is { it: (typeof items)[number]; d: number } => x.d != null && x.d >= 0 && x.d <= 14);
  }, [items]);

  /** Tracker pipeline: canonical status vocabulary counts in vocabulary order. */
  const byStatus = useMemo(() => {
    const counts = new Map<TrackerStatus, number>();
    for (const it of items) {
      const s = it.status ?? "drafted";
      counts.set(s, (counts.get(s) ?? 0) + 1);
    }
    return TRACKER_STATUSES.map((meta) => ({ meta, n: counts.get(meta.id) ?? 0 })).filter((x) => x.n > 0);
  }, [items]);

  if (items.length === 0) return null;
  const maxPortal = Math.max(...byPortal.map(([, n]) => n), 1);

  return (
    <div className="space-y-3 rounded-lg border border-border/70 bg-muted/20 p-3" data-testid="shortlist-analytics">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          At a glance
        </span>
        {dueSoon.length > 0 ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-400">
            <CalendarClock className="h-3 w-3" />
            {dueSoon.length} due ≤14 days
          </span>
        ) : null}
      </div>

      {/* By portal */}
      {byPortal.length > 0 ? (
        <div className="space-y-1.5">
          {byPortal.map(([portal, n]) => (
            <div key={portal} className="flex items-center gap-2 text-[11px]">
              <span className="w-24 shrink-0 truncate text-muted-foreground">{portal}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full rounded-full ${PORTAL_COLORS[items.find((i) => i.portalName === portal)?.portalId ?? ""] ?? "bg-emerald-500"} transition-all duration-500`}
                  style={{ width: `${(n / maxPortal) * 100}%` }}
                />
              </div>
              <span className="w-5 shrink-0 text-right font-semibold tabular-nums">{n}</span>
            </div>
          ))}
        </div>
      ) : null}

      {/* Tracker pipeline */}
      {byStatus.length > 0 ? (
        <div>
          <div className="mb-1.5 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            <Route className="h-3 w-3" />
            Tracker pipeline
          </div>
          <div
            className="flex h-2.5 overflow-hidden rounded-full bg-muted"
            role="img"
            aria-label={byStatus.map((x) => `${x.n} ${x.meta.label}`).join(", ")}
          >
            {byStatus.map((x) => (
              <div
                key={x.meta.id}
                title={`${x.meta.label}: ${x.n}${x.meta.final ? " (final)" : ""}`}
                className={`h-full ${x.meta.dot} transition-all duration-500`}
                style={{ width: `${(x.n / items.length) * 100}%` }}
              />
            ))}
          </div>
          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
            {byStatus.map((x) => (
              <span key={x.meta.id} className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                <span className={`h-1.5 w-1.5 rounded-full ${x.meta.dot}`} />
                {x.meta.label} {x.n}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {/* By fit band */}
      {byBand && byBand.scored > 0 ? (
        <div>
          <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Fit triage · {byBand.scored}/{byBand.total} scored
          </div>
          <div
            className="flex h-2.5 overflow-hidden rounded-full bg-muted"
            role="img"
            aria-label={BAND_ORDER.map((b) => `${byBand.counts.get(b) ?? 0} ${b}`).join(", ")}
          >
            {BAND_ORDER.map((band) => {
              const n = byBand.counts.get(band) ?? 0;
              if (n === 0) return null;
              const style = FIT_BAND_STYLES[band];
              return (
                <div
                  key={band}
                  title={`${style.label}: ${n}`}
                  className={`h-full ${style.dot} transition-all duration-500`}
                  style={{ width: `${(n / byBand.scored) * 100}%` }}
                />
              );
            })}
          </div>
          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
            {BAND_ORDER.map((band) => {
              const n = byBand.counts.get(band) ?? 0;
              if (n === 0) return null;
              const style = FIT_BAND_STYLES[band];
              return (
                <span key={band} className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                  <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
                  {style.label} {n}
                </span>
              );
            })}
          </div>
        </div>
      ) : (
        <p className="text-[10px] text-muted-foreground/70">
          Set a fit profile to see a fit triage of your shortlist.
        </p>
      )}
    </div>
  );
}
