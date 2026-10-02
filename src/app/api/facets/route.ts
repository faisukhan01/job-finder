import { NextRequest, NextResponse } from "next/server";
import { REPO_ROOT, runBun, parseCliJson, pickStr } from "@/lib/job-search/runner";
import type { FacetSuggestion } from "@/lib/job-search/shared-types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const FREEHIRE_DIR = `${REPO_ROOT}/.agents/skills/freehire-search/cli`;

interface CacheEntry {
  data: unknown;
  at: number;
}

/** Facet vocabularies change slowly — cache per query for 5 minutes. */
const cache = new Map<string, CacheEntry>();
const TTL_MS = 5 * 60 * 1000;

function cacheGet<T>(key: string): T | null {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.data as T;
  cache.delete(key);
  return null;
}

function cacheSet(key: string, data: unknown): void {
  if (cache.size > 80) cache.clear();
  cache.set(key, { data, at: Date.now() });
}

interface RawResult {
  skills?: unknown;
  company?: unknown;
  company_slug?: unknown;
  work_mode?: unknown;
  regions?: unknown;
  countries?: unknown;
}

function bump(map: Map<string, number>, key: string): void {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function topN(map: Map<string, number>, n: number): FacetSuggestion[] {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, n)
    .map(([name, count]) => ({ name, count }));
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string" && x.trim().length > 0).map((x) => x.trim());
}

async function aggregateFacets(query: string): Promise<{
  scanned: number;
  skills: FacetSuggestion[];
  companies: FacetSuggestion[];
  workModes: FacetSuggestion[];
  regions: FacetSuggestion[];
  countries: FacetSuggestion[];
}> {
  // A broad 100-result scan (no description hydration = cheap) gives a
  // representative facet sample for the query.
  const args = ["run", "src/cli.ts", "search", "--limit", "100", "--no-description", "--format", "json"];
  if (query) args.push("-q", query);
  const r = await runBun(args, { cwd: FREEHIRE_DIR, timeoutMs: 45_000 });
  const parsed = parseCliJson<unknown>(r.stdout) ?? parseCliJson<unknown>(r.stderr);
  const results = parsed && typeof parsed === "object" && Array.isArray((parsed as { results?: unknown }).results)
    ? ((parsed as { results: unknown[] }).results as RawResult[])
    : null;
  if (!results) {
    const envErr = parsed && typeof parsed === "object" ? (parsed as { error?: unknown }).error : null;
    throw Object.assign(
      new Error(typeof envErr === "string" ? envErr : "freehire search returned no parsable output"),
      { code: typeof envErr === "string" ? "API_ERROR" : "BAD_OUTPUT" },
    );
  }

  const skills = new Map<string, number>();
  const companies = new Map<string, number>();
  const companySlugs = new Map<string, string>();
  const workModes = new Map<string, number>();
  const regions = new Map<string, number>();
  const countries = new Map<string, number>();

  for (const raw of results) {
    if (!raw || typeof raw !== "object") continue;
    for (const s of asStringArray(raw.skills)) bump(skills, s.toLowerCase());
    const rec = raw as unknown as Record<string, unknown>;
    const company = pickStr(rec, ["company"]);
    const slug = pickStr(rec, ["company_slug"]);
    if (company && slug) {
      bump(companies, company);
      if (!companySlugs.has(company)) companySlugs.set(company, slug);
    }
    const wm = pickStr(rec, ["work_mode"]);
    if (wm) bump(workModes, wm);
    for (const reg of asStringArray(raw.regions)) bump(regions, reg.toLowerCase());
    for (const c of asStringArray(raw.countries)) bump(countries, c.toLowerCase());
  }

  return {
    scanned: results.length,
    skills: topN(skills, 14),
    companies: [...companies.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 10)
      .map(([name, count]) => ({ name, count, slug: companySlugs.get(name) }))
      .filter((c) => c.slug && /^[a-z0-9][a-z0-9-]{1,59}$/.test(c.slug)),
    workModes: topN(workModes, 4),
    regions: topN(regions, 8),
    countries: topN(countries, 10),
  };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const query = (searchParams.get("q") ?? "").replace(/[\x00-\x1f\x7f]/g, " ").trim().slice(0, 120);
  const force = searchParams.get("force") === "1";
  const key = `freehire:facets:${query.toLowerCase()}`;

  const cached = force ? null : cacheGet<Awaited<ReturnType<typeof aggregateFacets>>>(key);
  if (cached) {
    return NextResponse.json({ ok: true, query, ...cached, cached: true, error: null, errorCode: null });
  }

  const started = Date.now();
  try {
    const facets = await aggregateFacets(query);
    const payload = { ...facets, tookMs: Date.now() - started };
    cacheSet(key, payload);
    return NextResponse.json({ ok: true, query, ...payload, cached: false, error: null, errorCode: null });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        query,
        scanned: 0,
        skills: [],
        companies: [],
        workModes: [],
        regions: [],
        countries: [],
        tookMs: Date.now() - started,
        cached: false,
        error: (e as Error).message || "Failed to aggregate facets",
        errorCode: (e as { code?: string }).code ?? "API_ERROR",
      },
      { status: 502 },
    );
  }
}
