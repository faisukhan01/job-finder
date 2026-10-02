import { NextRequest, NextResponse } from "next/server";
import { PORTALS, getPortal, parsePortalOutput, portalCliAbsPath, type SearchFilters, type PortalSearchOutcome } from "@/lib/job-search/portals";
import { parseLocation, planLocationSearch, guardJobsByLocation, type ParsedLocation, type LocationPlan } from "@/lib/job-search/location-routing";
import { runBun } from "@/lib/job-search/runner";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const MAX_QUERY_LEN = 200;
const ALLOWED_LIMITS = [5, 10, 15, 20, 30];
const ALLOWED_JOB_AGES = [1, 7, 14, 30];
const REMOTE_MODES = ["remote", "hybrid", "onsite"];
const FREEHIRE_SENIORITIES = ["junior", "middle", "senior", "staff", "principal", "lead"];
const CODELIST_RE = /^[a-zA-Z0-9_]{2,30}(,[a-zA-Z0-9_]{2,30})*$/;
const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,59}$/;
const REGION_CODES_RE = /^[a-z]{2,10}(,[a-z]{2,10})*$/;
const ZIP_RE = /^\d{4}$/;
const NUMERIC_ID_RE = /^\d{1,10}$/;

function sanitizeText(input: unknown, maxLen: number): string {
  if (typeof input !== "string") return "";
  // Strip control characters and hard-cap length; args are passed via
  // execFile (no shell), so this is about output hygiene, not injection.
  return input.replace(/[\x00-\x1f\x7f]/g, " ").trim().slice(0, maxLen);
}

function sanitizeFilterToken(input: unknown, allowed: string[]): string | null {
  const v = sanitizeText(input, 30).toLowerCase();
  return v && allowed.includes(v) ? v : null;
}

/** Whitelist + shape-check the optional per-portal advanced filters. */
function sanitizeFilters(raw: unknown): SearchFilters {
  const out: SearchFilters = {};
  if (!raw || typeof raw !== "object") return out;
  const r = raw as Record<string, unknown>;
  const remote = sanitizeFilterToken(r.remote, REMOTE_MODES);
  if (remote) out.remote = remote;
  const seniority = sanitizeFilterToken(r.seniority, FREEHIRE_SENIORITIES);
  if (seniority) out.seniority = seniority;
  const freehireCategory = sanitizeText(r.freehireCategory, 60).toLowerCase();
  if (freehireCategory && CODELIST_RE.test(freehireCategory)) out.freehireCategory = freehireCategory;
  const country = sanitizeText(r.country, 30).toUpperCase();
  if (country && /^[A-Z]{2}(,[A-Z]{2})*$/.test(country)) out.country = country;
  const jobdanmarkCategory = sanitizeText(r.jobdanmarkCategory, 10);
  if (jobdanmarkCategory && /^\d{2,10}$/.test(jobdanmarkCategory)) out.jobdanmarkCategory = jobdanmarkCategory;
  const municipality = sanitizeText(r.municipality, 60);
  if (municipality) out.municipality = municipality;
  const region = sanitizeText(r.region, 60);
  if (region) out.region = region;
  const zip = sanitizeText(r.zip, 4);
  if (zip && ZIP_RE.test(zip)) out.zip = zip;
  const jobtitleId = sanitizeText(r.jobtitleId, 10);
  if (jobtitleId && NUMERIC_ID_RE.test(jobtitleId)) out.jobtitleId = jobtitleId;
  const freehireSkill = sanitizeText(r.freehireSkill, 80).toLowerCase();
  if (freehireSkill && CODELIST_RE.test(freehireSkill)) out.freehireSkill = freehireSkill;
  const freehireCompany = sanitizeText(r.freehireCompany, 60).toLowerCase();
  if (freehireCompany && SLUG_RE.test(freehireCompany)) out.freehireCompany = freehireCompany;
  const freehireRegion = sanitizeText(r.freehireRegion, 60).toLowerCase();
  if (freehireRegion && REGION_CODES_RE.test(freehireRegion)) out.freehireRegion = freehireRegion;
  return out;
}

function hasAnyFilter(f: SearchFilters): boolean {
  return Boolean(
    f.remote || f.seniority || f.freehireCategory || f.country || f.jobdanmarkCategory ||
    f.municipality || f.region || f.zip || f.jobtitleId || f.freehireSkill || f.freehireCompany ||
    f.freehireRegion,
  );
}

async function searchOne(
  portalId: string,
  query: string,
  location: string,
  limit: number,
  jobAge: number | null,
  filters: SearchFilters,
): Promise<PortalSearchOutcome> {
  const started = Date.now();
  const portal = getPortal(portalId);
  if (!portal) {
    return { portalId, ok: false, jobs: [], total: null, error: "Unknown portal", errorCode: "UNKNOWN_PORTAL", tookMs: 0 };
  }
  const args = portal.buildArgs({ query, location: location || "Remote", limit, jobAge, filters });
  const r = await runBun(args, { cwd: portalCliAbsPath(portal), timeoutMs: 90_000 });
  // Some CLIs emit the JSON error envelope on stderr when spawned non-TTY,
  // so prefer stdout, but fall back to stderr when stdout has nothing parsable.
  const stdoutParse = parsePortalOutput(portal, r.stdout);
  const stderrParse = r.stderr.trim() ? parsePortalOutput(portal, r.stderr) : null;
  const parsed =
    stdoutParse.ok || stdoutParse.errorCode !== "BAD_OUTPUT"
      ? stdoutParse
      : (stderrParse ?? stdoutParse);
  const error = parsed.ok ? null : r.timedOut
    ? `Portal did not respond within 90s (timed out)`
    : parsed.error || r.stderr.trim().slice(0, 300) || `CLI exited with code ${r.code}`;
  return {
    portalId,
    ok: error === null,
    jobs: parsed.jobs,
    total: parsed.total,
    error,
    errorCode: parsed.ok ? null : r.timedOut ? "TIMEOUT" : parsed.errorCode,
    tookMs: Date.now() - started,
  };
}

const PORTAL_NAMES: Record<string, string> = Object.fromEntries(PORTALS.map((p) => [p.id, p.name]));

/**
 * Warnings for explicitly-selected boards that cannot honor the requested
 * location (the fan-out plan already excluded them from "all" searches).
 */
function buildLocationNotices(portalId: string, parsed: ParsedLocation): string[] {
  const name = PORTAL_NAMES[portalId] ?? portalId;
  const notices: string[] = [];
  const danish = ["jobindex", "jobnet", "jobbank", "jobdanmark"].includes(portalId);
  if (danish && (parsed.mode === "international" || parsed.mode === "unresolved")) {
    notices.push(`${name} only lists jobs in Denmark — results are Danish nationwide, so your “${parsed.raw}” location cannot be applied on this board.`);
  }
  if (danish && parsed.mode === "remote") {
    notices.push(`${name} is a Denmark-only board; “Remote” returns Danish postings (some offer hjemmearbejde).`);
  }
  if (portalId === "freehire" && parsed.mode === "unresolved") {
    notices.push(`Freehire filters by country, but no country was recognized in “${parsed.raw}” — results are global. Include a country name (e.g. “Lahore, Pakistan”) to scope it.`);
  }
  return notices;
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const portalId = typeof body.portal === "string" ? body.portal : "all";
  const query = sanitizeText(body.query, MAX_QUERY_LEN);
  const location = sanitizeText(body.location, 120);
  const limitRaw = Number(body.limit);
  const limit = ALLOWED_LIMITS.includes(limitRaw) ? limitRaw : 10;
  const jobAgeRaw = Number(body.jobAge);
  const jobAge = ALLOWED_JOB_AGES.includes(jobAgeRaw) ? jobAgeRaw : null;
  const filters = sanitizeFilters(body.filters);

  // A query is required unless an advanced filter narrows the search instead
  // (e.g. browsing a jobdanmark category without keywords).
  if (!query && !hasAnyFilter(filters)) {
    return NextResponse.json({ error: "Please enter a search query or pick a filter" }, { status: 400 });
  }

  // LinkedIn requires an explicit location.
  const useLocation = location || "Copenhagen, Denmark";

  // --- Location-aware routing (fixes wrong-country results) ---------------
  const parsedLocation = parseLocation(useLocation);
  let plan: LocationPlan = { include: [], skipped: [] };
  let notices: string[] = [];

  if (portalId === "all") {
    plan = planLocationSearch(parsedLocation);
  } else {
    if (!getPortal(portalId)) {
      return NextResponse.json({ error: `Unknown portal: ${portalId}` }, { status: 400 });
    }
    // Explicit board choice is always honored — but warn when the board
    // cannot apply the requested location.
    plan = { include: [portalId], skipped: [] };
    notices = buildLocationNotices(portalId, parsedLocation);
  }

  // Scope Freehire to the requested country unless the user already set a
  // specific country filter (denmark mode → DK, international → resolved code).
  const effectiveFilters: SearchFilters = { ...filters };
  if (
    (parsedLocation.mode === "denmark" || parsedLocation.mode === "international") &&
    parsedLocation.countryCode &&
    !effectiveFilters.country &&
    plan.include.includes("freehire")
  ) {
    effectiveFilters.country = parsedLocation.countryCode;
  }

  const started = Date.now();
  const outcomes = await Promise.all(
    plan.include.map((id) => searchOne(id, query, useLocation, limit, jobAge, effectiveFilters)),
  );

  // Defense-in-depth: drop leaked postings that clearly sit in another
  // country and count them per outcome so the UI can show the guard badge.
  const guarded = outcomes.map((o) => {
    const g = guardJobsByLocation(o.jobs, parsedLocation);
    return g.hidden > 0 ? { ...o, jobs: g.jobs, locationFiltered: g.hidden } : o;
  });

  return NextResponse.json({
    query,
    location: useLocation,
    limit,
    jobAge,
    filters: effectiveFilters,
    routing: {
      requested: parsedLocation.raw,
      city: parsedLocation.city,
      country: parsedLocation.country,
      countryCode: parsedLocation.countryCode,
      isRemote: parsedLocation.isRemote,
      isDenmark: parsedLocation.isDenmark,
      mode: parsedLocation.mode,
      skippedPortals: plan.skipped.map((s) => ({ ...s, name: PORTAL_NAMES[s.portalId] ?? s.portalId })),
      notices,
    },
    tookMs: Date.now() - started,
    outcomes: guarded,
  });
}
