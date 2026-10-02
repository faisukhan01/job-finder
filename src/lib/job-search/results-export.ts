import type { PortalSearchOutcome } from "./shared-types";

/** Escape a single CSV field per RFC 4180 (quotes, commas, newlines). */
function csvField(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

/**
 * Build a flat CSV of all normalized search results across portals —
 * a wider format than the framework's 14-column tracker (which is
 * shortlist-oriented); this one is for analyzing a full result set.
 */
export function buildResultsCsv(outcomes: PortalSearchOutcome[]): string {
  const header = "portal,title,company,location,posted,deadline,url,extra";
  const rows: string[] = [];
  for (const o of outcomes) {
    for (const j of o.jobs) {
      const cells = [
        o.portalId,
        j.title,
        j.company ?? "",
        j.location ?? "",
        j.date ?? "",
        j.deadline ?? "",
        j.url ?? "",
        j.extra ?? "",
      ];
      rows.push(cells.map(csvField).join(","));
    }
  }
  return [header, ...rows].join("\r\n");
}

/** Slugify a search query into a safe filename fragment. */
export function slugifyQuery(query: string): string {
  const slug = query
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return slug || "search";
}
