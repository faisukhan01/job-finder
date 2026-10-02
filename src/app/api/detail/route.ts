import { NextRequest, NextResponse } from "next/server";
import { runBun, parseCliJson } from "@/lib/job-search/runner";
import { getPortal } from "@/lib/job-search/portals";
import { buildDetailArgs, normalizeDetail } from "@/lib/job-search/details";
import type { JobDetail, DetailResponse } from "@/lib/job-search/shared-types";

/**
 * POST /api/detail { portal, id }
 * Runs the portal CLI's `detail <id>` subcommand and returns a
 * normalized JobDetail. Results are cached in memory for 10 minutes
 * (postings change slowly; repeated opens stay instant).
 */

const TIMEOUT_MS = 60_000;
const CACHE_TTL_MS = 10 * 60_000;
const CACHE_MAX = 60;
const REPO_ROOT = "/home/z/my-project/ai-job-search";

interface CacheEntry {
  at: number;
  detail: JobDetail | null;
  error: string | null;
  errorCode: string | null;
}

const cache = new Map<string, CacheEntry>();

function cacheKey(portal: string, id: string): string {
  return `${portal}::${id}`;
}

function readCache(key: string): CacheEntry | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return hit;
}

function writeCache(key: string, entry: Omit<CacheEntry, "at">): void {
  if (cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  cache.set(key, { ...entry, at: Date.now() });
}

function fail(portalId: string, jobId: string, error: string, errorCode: string, started: number, cached = false) {
  const res: DetailResponse = {
    portal: portalId,
    id: jobId,
    ok: false,
    detail: null,
    error,
    errorCode,
    tookMs: Date.now() - started,
    cached,
  };
  return NextResponse.json(res);
}

export async function POST(req: NextRequest) {
  const started = Date.now();
  let body: { portal?: unknown; id?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const portalId = typeof body.portal === "string" ? body.portal.trim() : "";
  const jobId = typeof body.id === "string" ? body.id.trim().slice(0, 300) : "";
  if (!portalId || !jobId) {
    return NextResponse.json({ error: "Both 'portal' and 'id' are required" }, { status: 400 });
  }
  const portal = getPortal(portalId);
  if (!portal) {
    return fail(portalId, jobId, `Unknown portal '${portalId}'`, "UNKNOWN_PORTAL", started);
  }

  const key = cacheKey(portalId, jobId);
  const hit = readCache(key);
  if (hit) {
    const res: DetailResponse = {
      portal: portalId,
      id: jobId,
      ok: hit.detail != null,
      detail: hit.detail,
      error: hit.error,
      errorCode: hit.errorCode,
      tookMs: Date.now() - started,
      cached: true,
    };
    return NextResponse.json(res);
  }

  const run = await runBun(buildDetailArgs(portalId, jobId), {
    cwd: `${REPO_ROOT}/${portal.cliDir}`,
    timeoutMs: TIMEOUT_MS,
  });

  const payload = parseCliJson<Record<string, unknown>>(run.stdout) ?? parseCliJson<Record<string, unknown>>(run.stderr);
  if (payload && typeof payload.error === "string" && payload.error.length > 0) {
    const entry: Omit<CacheEntry, "at"> = {
      detail: null,
      error: payload.error,
      errorCode: typeof payload.code === "string" ? payload.code : "API_ERROR",
    };
    // Cache failures briefly so retry storms don't hammer the portal;
    // a shorter TTL than successes. Reuse the same map with an earlier
    // expiry by storing now and letting readCache's TTL check handle it.
    writeCache(key, entry);
    return NextResponse.json({
      portal: portalId, id: jobId, ok: false, detail: null,
      error: entry.error, errorCode: entry.errorCode,
      tookMs: Date.now() - started, cached: false,
    } satisfies DetailResponse);
  }
  if (!payload) {
    const msg = run.timedOut
      ? "The portal CLI timed out fetching this detail."
      : `CLI returned no parsable JSON output${run.stderr ? `: ${run.stderr.slice(0, 200)}` : ""}`;
    return fail(portalId, jobId, msg, run.timedOut ? "TIMEOUT" : "BAD_OUTPUT", started);
  }

  const detail = normalizeDetail(portalId, payload);
  writeCache(key, { detail, error: null, errorCode: null });
  const res: DetailResponse = {
    portal: portalId,
    id: jobId,
    ok: true,
    detail,
    error: null,
    errorCode: null,
    tookMs: Date.now() - started,
    cached: false,
  };
  return NextResponse.json(res);
}
