import { NextRequest, NextResponse } from "next/server";
import { REPO_ROOT, runBun, parseCliJson } from "@/lib/job-search/runner";
import type { LocationSuggestion } from "@/lib/job-search/shared-types";

export const dynamic = "force-dynamic";
export const maxDuration = 45;

const JOBDANMARK_DIR = `${REPO_ROOT}/.agents/skills/jobdanmark-search/cli`;

interface CacheEntry {
  data: unknown;
  at: number;
}

/** Suggestion vocabularies change rarely — cache per query for 10 minutes. */
const cache = new Map<string, CacheEntry>();
const TTL_MS = 10 * 60 * 1000;

function cacheGet<T>(key: string): T | null {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.data as T;
  cache.delete(key);
  return null;
}

function cacheSet(key: string, data: unknown): void {
  if (cache.size > 150) cache.clear();
  cache.set(key, { data, at: Date.now() });
}

const GROUP_LABELS: Record<string, string> = {
  region: "Landsdel (region)",
  municipality: "Kommune (municipality)",
  zip: "Postnummer (zip)",
  jobtitle: "Jobtitel (job title)",
};

interface RawSuggestItem {
  id?: unknown;
  text?: unknown;
  value?: unknown;
  category?: unknown;
}

/** jobdanmark locations/autocomplete return [{title, items:[...]}] groups. */
async function fetchSuggestions(source: string, query: string): Promise<LocationSuggestion[]> {
  const sub = source === "jobtitles" ? "autocomplete" : "locations";
  const r = await runBun(["run", "src/cli.ts", sub, "--query", query, "--format", "json"], {
    cwd: JOBDANMARK_DIR,
    timeoutMs: 30_000,
  });
  const parsed = parseCliJson<unknown>(r.stdout) ?? parseCliJson<unknown>(r.stderr);
  if (!parsed) {
    throw Object.assign(new Error(`jobdanmark ${sub} returned no parsable output`), { code: "BAD_OUTPUT" });
  }
  if (!Array.isArray(parsed)) {
    const envErr = (parsed as { error?: unknown }).error;
    throw Object.assign(
      new Error(typeof envErr === "string" ? envErr : `${sub} lookup failed`),
      { code: "API_ERROR" },
    );
  }

  const out: LocationSuggestion[] = [];
  const seen = new Set<string>();
  for (const group of parsed) {
    if (!group || typeof group !== "object") continue;
    const items = (group as { items?: unknown }).items;
    if (!Array.isArray(items)) continue;
    for (const raw of items as RawSuggestItem[]) {
      if (!raw || typeof raw !== "object") continue;
      const category = typeof raw.category === "string" ? raw.category : "";
      const text = typeof raw.text === "string" ? raw.text.trim() : "";
      const value =
        typeof raw.value === "string" && raw.value.trim()
          ? raw.value.trim()
          : typeof raw.value === "number" && Number.isFinite(raw.value)
            ? String(raw.value)
            : "";
      if (!category || !text || !value) continue;
      // The search CLI's --region takes a region name; strip group ids like "region__218528".
      if (category !== "jobtitle" && category !== "municipality" && category !== "region" && category !== "zip") continue;
      const dedupe = `${category}:${value}`;
      if (seen.has(dedupe)) continue;
      seen.add(dedupe);
      out.push({ category, group: GROUP_LABELS[category] ?? category, text, value });
      if (out.length >= 24) return out;
    }
  }
  return out;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const source = searchParams.get("source") ?? "locations";
  if (source !== "locations" && source !== "jobtitles") {
    return NextResponse.json(
      { ok: false, source, query: "", suggestions: [], cached: false, error: `Unknown source: ${source}`, errorCode: "UNKNOWN_SOURCE" },
      { status: 400 },
    );
  }
  const query = (searchParams.get("q") ?? "").replace(/[\x00-\x1f\x7f]/g, " ").trim().slice(0, 60);
  if (query.length < 2) {
    return NextResponse.json(
      { ok: false, source, query, suggestions: [], cached: false, error: "Type at least 2 characters", errorCode: "MISSING_QUERY" },
      { status: 400 },
    );
  }
  const force = searchParams.get("force") === "1";
  const key = `jobdanmark:${source}:${query.toLowerCase()}`;

  const cached = force ? null : cacheGet<LocationSuggestion[]>(key);
  if (cached) {
    return NextResponse.json({ ok: true, source, query, suggestions: cached, cached: true, error: null, errorCode: null });
  }

  try {
    const suggestions = await fetchSuggestions(source, query);
    cacheSet(key, suggestions);
    return NextResponse.json({ ok: true, source, query, suggestions, cached: false, error: null, errorCode: null });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        source,
        query,
        suggestions: [],
        cached: false,
        error: (e as Error).message || "Suggestion lookup failed",
        errorCode: (e as { code?: string }).code ?? "API_ERROR",
      },
      { status: 502 },
    );
  }
}
