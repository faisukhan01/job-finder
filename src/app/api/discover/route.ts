import { NextRequest, NextResponse } from "next/server";
import { REPO_ROOT, runBun, parseCliJson } from "@/lib/job-search/runner";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const JOBDANMARK_DIR = `${REPO_ROOT}/.agents/skills/jobdanmark-search/cli`;
const JOBNET_DIR = `${REPO_ROOT}/.agents/skills/jobnet-search/cli`;

export interface DiscoverCategory {
  id: string;
  title: string;
  helpText: string | null;
  count: number;
}

export interface DiscoverOccupation {
  label: string;
  aliases: string[];
}

interface CacheEntry<T> {
  data: T;
  at: number;
}

/** Small in-memory TTL cache — taxonomy data changes at most daily. */
const cache = new Map<string, CacheEntry<unknown>>();
const TTL_MS = 5 * 60 * 1000;

function cacheGet<T>(key: string): T | null {
  const hit = cache.get(key) as CacheEntry<T> | undefined;
  if (hit && Date.now() - hit.at < TTL_MS) return hit.data;
  cache.delete(key);
  return null;
}

function cacheSet<T>(key: string, data: T): void {
  // Simple size bound.
  if (cache.size > 120) cache.clear();
  cache.set(key, { data, at: Date.now() });
}

function errPayload(source: string, error: string, errorCode: string) {
  return { source, ok: false, error, errorCode };
}

async function fetchCategories(): Promise<DiscoverCategory[]> {
  const r = await runBun(["run", "src/cli.ts", "categories", "--format", "json"], {
    cwd: JOBDANMARK_DIR,
    timeoutMs: 45_000,
  });
  const parsed = parseCliJson<unknown>(r.stdout) ?? parseCliJson<unknown>(r.stderr);
  if (!parsed) throw Object.assign(new Error("jobdanmark categories returned no parsable output"), { code: "BAD_OUTPUT" });
  if (!Array.isArray(parsed)) {
    const msg = typeof (parsed as { error?: string }).error === "string" ? (parsed as { error: string }).error : "categories lookup failed";
    throw Object.assign(new Error(msg), { code: "API_ERROR" });
  }
  return parsed
    .map((raw): DiscoverCategory => {
      const c = (raw ?? {}) as Record<string, unknown>;
      const id = c.id != null ? String(c.id) : "";
      return {
        id,
        title: typeof c.title === "string" ? c.title.trim() : id || "(unknown)",
        helpText: typeof c.helpText === "string" && c.helpText.trim() ? c.helpText.trim() : null,
        count: typeof c.count === "number" && Number.isFinite(c.count) ? c.count : 0,
      };
    })
    .filter((c) => c.id.length > 0)
    .sort((a, b) => b.count - a.count);
}

async function fetchOccupations(query: string): Promise<DiscoverOccupation[]> {
  const r = await runBun(
    ["run", "src/cli.ts", "occupations", "--search-string", query, "--per-page", "14", "--format", "json"],
    { cwd: JOBNET_DIR, timeoutMs: 45_000 },
  );
  const parsed = parseCliJson<unknown>(r.stdout) ?? parseCliJson<unknown>(r.stderr);
  if (!parsed) throw Object.assign(new Error("jobnet occupations returned no parsable output"), { code: "BAD_OUTPUT" });
  if (!Array.isArray(parsed)) {
    const msg = typeof (parsed as { error?: string }).error === "string" ? (parsed as { error: string }).error : "occupations lookup failed";
    throw Object.assign(new Error(msg), { code: "API_ERROR" });
  }
  const out: DiscoverOccupation[] = [];
  for (const raw of parsed.slice(0, 40)) {
    const o = (raw ?? {}) as Record<string, unknown>;
    const label = typeof o.preferredLabelDa === "string" ? o.preferredLabelDa.trim() : "";
    if (!label) continue;
    const aliases = Array.isArray(o.aliases)
      ? (o.aliases as unknown[])
          .map((a) => (a && typeof a === "object" ? (a as Record<string, unknown>).alternativeLabelDa : null))
          .filter((a): a is string => typeof a === "string" && a.trim().length > 0)
          .slice(0, 3)
      : [];
    if (!out.some((x) => x.label.toLowerCase() === label.toLowerCase())) {
      out.push({ label, aliases });
    }
  }
  return out.slice(0, 18);
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const source = searchParams.get("source") ?? "categories";
  const force = searchParams.get("force") === "1";

  if (source === "categories") {
    const key = "jobdanmark:categories";
    const cached = force ? null : cacheGet<DiscoverCategory[]>(key);
    if (cached) {
      return NextResponse.json({ source, ok: true, categories: cached, cached: true });
    }
    try {
      const categories = await fetchCategories();
      cacheSet(key, categories);
      return NextResponse.json({ source, ok: true, categories, cached: false });
    } catch (e) {
      return NextResponse.json(
        { ...errPayload(source, (e as Error).message || "Failed to load categories", (e as { code?: string }).code ?? "API_ERROR") },
        { status: 502 },
      );
    }
  }

  if (source === "occupations") {
    const query = (searchParams.get("query") ?? "").replace(/[\x00-\x1f\x7f]/g, " ").trim().slice(0, 80);
    if (!query) {
      return NextResponse.json({ source, ok: false, error: "Provide a query, e.g. udvikler", errorCode: "MISSING_QUERY" }, { status: 400 });
    }
    const key = `jobnet:occupations:${query.toLowerCase()}`;
    const cached = force ? null : cacheGet<DiscoverOccupation[]>(key);
    if (cached) {
      return NextResponse.json({ source, ok: true, query, occupations: cached, cached: true });
    }
    try {
      const occupations = await fetchOccupations(query);
      cacheSet(key, occupations);
      return NextResponse.json({ source, ok: true, query, occupations, cached: false });
    } catch (e) {
      return NextResponse.json(
        { ...errPayload(source, (e as Error).message || "Failed to load occupations", (e as { code?: string }).code ?? "API_ERROR") },
        { status: 502 },
      );
    }
  }

  return NextResponse.json({ ok: false, error: `Unknown source: ${source}`, errorCode: "UNKNOWN_SOURCE" }, { status: 400 });
}
