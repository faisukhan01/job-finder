"use client";

import type { ShortlistItem, TrackerStatus } from "./shortlist";
import { trackerStatusMeta, formatStatusHistory } from "./shortlist";
import type { FitResult } from "./fit-ranker";
import { FIT_BAND_STYLES } from "./fit-ranker";

/**
 * Markdown snapshot of the shortlist + its analytics, for pasting into the
 * repo's interview/apply notes or an issue. Mirrors the "At a glance" block
 * in the shortlist dialog so exports and screen stay in sync.
 */

function mdEscape(s: string): string {
  return s.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

/** Colored dot emojis matching the on-screen fit-band dots (emerald/teal/amber/rose/rose). */
const BAND_EMOJI: Record<string, string> = {
  strong: "🟢",
  good: "🟩",
  fair: "🟡",
  weak: "🟠",
  veto: "🔴",
};

export function buildShortlistMarkdown(
  items: ShortlistItem[],
  fits: Map<string, FitResult>,
  boardName: (portalId: string) => string,
): string {
  const today = new Date().toISOString().slice(0, 10);
  const lines: string[] = [];

  // Header + topline counts
  const dueCount = items.filter((it) => {
    const d = it.job.deadline?.slice(0, 10);
    if (!d) return false;
    const days = (new Date(`${d}T00:00:00Z`).getTime() - Date.now()) / 86_400_000;
    return days >= 0 && days <= 14;
  }).length;

  lines.push(`# Shortlist snapshot — ${today}`);
  lines.push("");
  lines.push(`${items.length} application(s) · ${dueCount} due within 14 days · exported from the AI Job Search Control Center.`);
  lines.push("");

  // By portal
  const byPortal = new Map<string, number>();
  for (const it of items) byPortal.set(it.portalName, (byPortal.get(it.portalName) ?? 0) + 1);
  if (byPortal.size > 0) {
    lines.push("## Sources");
    lines.push("");
    lines.push("| Board | Postings |");
    lines.push("| --- | ---: |");
    for (const [portal, n] of [...byPortal.entries()].sort((a, b) => b[1] - a[1])) {
      lines.push(`| ${mdEscape(portal)} | ${n} |`);
    }
    lines.push("");
  }

  // Tracker pipeline
  const byStatus = new Map<TrackerStatus, number>();
  for (const it of items) {
    const s = it.status ?? "drafted";
    byStatus.set(s, (byStatus.get(s) ?? 0) + 1);
  }
  if (byStatus.size > 0) {
    lines.push("## Tracker pipeline");
    lines.push("");
    lines.push(
      [...byStatus.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([s, n]) => `${trackerStatusMeta(s).label}: ${n}`)
        .join(" · "),
    );
    lines.push("");
  }

  // Fit triage (scored items only — mirrors the on-screen block)
  const scored = items.filter((it) => {
    const f = fits.get(it.key);
    return f && (f.score != null || f.band === "veto");
  });
  if (scored.length > 0) {
    const byBand = new Map<string, number>();
    for (const it of scored) {
      const f = fits.get(it.key)!;
      byBand.set(f.band, (byBand.get(f.band) ?? 0) + 1);
    }
    lines.push(`## Fit triage · ${scored.length}/${items.length} scored`);
    lines.push("");
    lines.push(
      [...byBand.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(
          ([band, n]) =>
            `${BAND_EMOJI[band] ?? "•"} ${FIT_BAND_STYLES[band as keyof typeof FIT_BAND_STYLES]?.label ?? band}: ${n}`,
        )
        .join(" · "),
    );
    lines.push("");
    lines.push(
      `_Legend: ${BAND_ORDER_EMOJI_LEGEND}_ ` +
        `(colors match the in-app fit badges; scoring = ${scored.length} of ${items.length} postings had profile matches).`,
    );
    lines.push("");
  }

  // Full table
  lines.push("## Applications");
  lines.push("");
  lines.push("| Role | Company | Board | Stage | Fit | Deadline | Stage history |");
  lines.push("| --- | --- | --- | --- | --- | --- | --- |");
  for (const it of items) {
    const fit = fits.get(it.key);
    const fitCell =
      fit && fit.score != null
        ? `${BAND_EMOJI[fit.band] ?? "•"} ${fit.score} ${FIT_BAND_STYLES[fit.band]?.label ?? fit.band}`
        : fit?.band === "veto"
          ? "🔴 veto"
          : "—";
    const stage = trackerStatusMeta(it.status ?? "drafted").label;
    const history = formatStatusHistory(it);
    lines.push(
      `| ${mdEscape(it.job.title)} | ${mdEscape(it.job.company ?? "")} | ${mdEscape(boardName(it.portalId))} | ${stage} | ${fitCell} | ${it.job.deadline ?? "—"} | ${mdEscape(history || "—")} |`,
    );
  }
  lines.push("");
  return lines.join("\n");
}

/** Fixed-order legend line for the fit bands (emoji + label). */
const BAND_ORDER_EMOJI_LEGEND = (
  ["strong", "good", "fair", "weak", "veto"] as const
)
  .map((b) => `${BAND_EMOJI[b]} ${FIT_BAND_STYLES[b].label}`)
  .join(" · ");
