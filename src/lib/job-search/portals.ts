import { REPO_ROOT, parseCliJson, pickStr } from "./runner";
import type { SearchFilters } from "./shared-types";

export type { SearchFilters } from "./shared-types";

export interface NormalizedJob {
  id: string;
  title: string;
  company: string | null;
  location: string | null;
  date: string | null;
  deadline: string | null;
  url: string | null;
  extra: string | null;
}

/** Per-portal advanced filters — type lives in shared-types.ts (client-safe). */
export interface SearchOptions {
  query: string;
  location?: string;
  limit: number;
  jobAge?: number | null;
  filters?: SearchFilters;
}

export interface PortalSearchOutcome {
  portalId: string;
  ok: boolean;
  jobs: NormalizedJob[];
  total: number | null;
  error: string | null;
  errorCode: string | null;
  tookMs: number;
}

export interface PortalDef {
  id: string;
  name: string;
  board: string;
  market: string;
  description: string;
  /** Directory (relative to REPO_ROOT) containing the CLI package. */
  cliDir: string;
  requiresLocation: boolean;
  supportsJobAge: boolean;
  buildArgs: (opts: SearchOptions) => string[];
  /** Extract the results array + total from the CLI's JSON payload. */
  extract: (payload: unknown) => { results: unknown[]; total: number | null };
  normalize: (raw: unknown) => NormalizedJob;
}

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
}

function firstArray(v: unknown): unknown[] {
  if (Array.isArray(v)) return v;
  if (v && typeof v === "object") {
    for (const key of ["results", "jobs", "items", "data"]) {
      const inner = (v as Record<string, unknown>)[key];
      if (Array.isArray(inner)) return inner;
    }
  }
  return [];
}

function toNumber(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function baseNormalize(raw: unknown): NormalizedJob & Record<string, unknown> {
  const r = asRecord(raw);
  return {
    id:
      pickStr(r, ["id", "slug", "jobId", "jobAdId", "adId", "uuid"]) ??
      `job-${Math.random().toString(36).slice(2, 10)}`,
    title: pickStr(r, ["title", "jobTitle", "name"]) ?? "(untitled posting)",
    company: pickStr(r, ["company", "companyName", "employer", "company_name"]),
    location: pickStr(r, ["location", "locationText", "city", "region", "companyAddress"]),
    date: pickStr(r, ["date", "publishedDate", "postedDate", "published", "datePosted"]),
    deadline: pickStr(r, ["deadline", "applicationDeadline", "application deadline"]),
    url: pickStr(r, ["url", "jobUrl", "link", "absoluteUrl", "detailUrl"]),
    extra: null,
    ...r,
  };
}

/** Danish portals share the {meta, results} envelope. */
function standardExtract(payload: unknown): { results: unknown[]; total: number | null } {
  const p = asRecord(payload);
  const results = firstArray(payload);
  const meta = asRecord(p.meta);
  const total =
    toNumber(meta.total) ??
    toNumber(meta.totalJobAdCount) ??
    toNumber(meta.count) ??
    (results.length || null);
  return { results, total };
}

export const PORTALS: PortalDef[] = [
  {
    id: "jobindex",
    name: "Jobindex",
    board: "jobindex.dk",
    market: "Denmark",
    description: "Denmark's largest job portal - private + public postings across all sectors.",
    cliDir: ".agents/skills/jobindex-search/cli",
    requiresLocation: false,
    supportsJobAge: true,
    buildArgs: (o) => {
      const args = ["run", "src/cli.ts", "search", "-q", o.query, "--limit", String(o.limit), "--format", "json"];
      if (o.jobAge) args.push("--jobage", String(o.jobAge));
      return args;
    },
    extract: standardExtract,
    normalize: (raw) => {
      const j = baseNormalize(raw);
      return {
        id: j.id,
        title: j.title,
        company: j.company,
        location: j.location,
        date: j.date,
        deadline: j.deadline,
        url: j.url,
        extra: null,
      };
    },
  },
  {
    id: "jobnet",
    name: "Jobnet",
    board: "jobnet.dk",
    market: "Denmark",
    description: "The Danish government's official job portal (Starthjenævnet).",
    cliDir: ".agents/skills/jobnet-search/cli",
    requiresLocation: false,
    supportsJobAge: false,
    buildArgs: (o) => [
      "run", "src/cli.ts", "search",
      "--search-string", o.query,
      "--limit", String(o.limit),
      "--format", "json",
    ],
    extract: standardExtract,
    normalize: (raw) => {
      const j = baseNormalize(raw);
      return {
        id: j.id,
        title: j.title,
        company: j.company,
        location: j.location,
        date: j.date,
        deadline: j.deadline,
        url: j.url,
        extra: null,
      };
    },
  },
  {
    id: "jobbank",
    name: "Akademikernes Jobbank",
    board: "jobbank.dk",
    market: "Denmark",
    description: "Job bank for academics (MA, MSc, PhD) run by Danish unemployment insurance funds.",
    cliDir: ".agents/skills/jobbank-search/cli",
    requiresLocation: false,
    supportsJobAge: false,
    buildArgs: (o) => [
      "run", "src/cli.ts", "search",
      "--key", o.query,
      "--limit", String(o.limit),
      "--format", "json",
    ],
    extract: standardExtract,
    normalize: (raw) => {
      const j = baseNormalize(raw);
      return {
        id: j.id,
        title: j.title,
        company: j.company,
        location: j.location,
        date: j.date,
        deadline: j.deadline,
        url: j.url,
        extra: null,
      };
    },
  },
  {
    id: "jobdanmark",
    name: "Jobdanmark",
    board: "jobdanmark.dk",
    market: "Denmark",
    description: "Danish aggregator with strong coverage of specialist and academic roles.",
    cliDir: ".agents/skills/jobdanmark-search/cli",
    requiresLocation: false,
    supportsJobAge: false,
    buildArgs: (o) => {
      const args = ["run", "src/cli.ts", "search"];
      if (o.query) args.push("--text", o.query);
      if (o.filters?.jobdanmarkCategory) args.push("--category", o.filters.jobdanmarkCategory);
      if (o.filters?.municipality) args.push("--municipality", o.filters.municipality);
      if (o.filters?.region) args.push("--region", o.filters.region);
      if (o.filters?.zip) args.push("--zip", o.filters.zip);
      if (o.filters?.jobtitleId) args.push("--jobtitle-id", o.filters.jobtitleId);
      args.push("--limit", String(o.limit), "--format", "json");
      return args;
    },
    extract: standardExtract,
    normalize: (raw) => {
      const j = baseNormalize(raw);
      return {
        id: j.id,
        title: j.title,
        company: j.company,
        location: j.location,
        date: j.date,
        deadline: j.deadline,
        url: j.url,
        extra: null,
      };
    },
  },
  {
    id: "linkedin",
    name: "LinkedIn Jobs",
    board: "linkedin.com",
    market: "Global",
    description: "Worldwide coverage incl. remote. Personal-use only (LinkedIn ToS) - keep volume low.",
    cliDir: ".agents/skills/linkedin-search/cli",
    requiresLocation: true,
    supportsJobAge: true,
    buildArgs: (o) => {
      const args = ["run", "src/cli.ts", "search", "-q", o.query, "-l", o.location || "Remote", "--limit", String(o.limit), "--format", "json"];
      if (o.jobAge) args.push("--jobage", String(o.jobAge));
      const remote = o.filters?.remote;
      if (remote === "remote" || remote === "hybrid" || remote === "onsite") args.push("--remote", remote);
      return args;
    },
    extract: standardExtract,
    normalize: (raw) => {
      const j = baseNormalize(raw);
      return {
        id: j.id,
        title: j.title,
        company: j.company,
        location: j.location,
        date: j.date,
        deadline: null,
        url: j.url,
        extra: null,
      };
    },
  },
  {
    id: "freehire",
    name: "Freehire",
    board: "freehire.me",
    market: "Global (tech)",
    description: "Tech-focused aggregator across many markets; pulls from EURES and company career pages.",
    cliDir: ".agents/skills/freehire-search/cli",
    requiresLocation: false,
    supportsJobAge: true,
    buildArgs: (o) => {
      const args = ["run", "src/cli.ts", "search"];
      if (o.query) args.push("-q", o.query);
      args.push("--limit", String(o.limit), "--no-description", "--format", "json");
      if (o.jobAge) args.push("--jobage", String(o.jobAge));
      const f = o.filters;
      if (f?.seniority) args.push("--seniority", f.seniority);
      if (f?.freehireCategory) args.push("--category", f.freehireCategory);
      if (f?.country) args.push("--country", f.country.toUpperCase());
      if (f?.freehireSkill) args.push("--skill", f.freehireSkill.toLowerCase());
      if (f?.freehireCompany) args.push("--company", f.freehireCompany.toLowerCase());
      if (f?.freehireRegion) args.push("--region", f.freehireRegion.toLowerCase());
      return args;
    },
    extract: standardExtract,
    normalize: (raw) => {
      const j = baseNormalize(raw);
      const skills = Array.isArray((j as Record<string, unknown>).skills)
        ? ((j as Record<string, unknown>).skills as unknown[]).slice(0, 5).join(", ")
        : null;
      const workMode = pickStr(j as Record<string, unknown>, ["work_mode", "workMode"]);
      return {
        id: j.id,
        title: j.title,
        company: j.company,
        location: j.location,
        date: j.date ? j.date.slice(0, 10) : null,
        deadline: j.deadline,
        url: j.url,
        extra: [workMode ? `work mode: ${workMode}` : null, skills ? `skills: ${skills}` : null]
          .filter(Boolean)
          .join(" · ") || null,
      };
    },
  },
];

export function getPortal(id: string): PortalDef | undefined {
  return PORTALS.find((p) => p.id === id);
}

export function portalCliAbsPath(portal: PortalDef): string {
  return `${REPO_ROOT}/${portal.cliDir}`;
}

export interface ParsedPortalPayload {
  ok: boolean;
  error: string | null;
  errorCode: string | null;
  jobs: NormalizedJob[];
  total: number | null;
}

/**
 * Parse a portal CLI run into a normalized outcome. The CLIs signal
 * failures with {"error": "...", "code": "..."} JSON envelopes.
 */
export function parsePortalOutput(portal: PortalDef, stdout: string): ParsedPortalPayload {
  const payload = parseCliJson<Record<string, unknown>>(stdout);
  if (!payload) {
    return {
      ok: false,
      error: "CLI returned no parsable JSON output",
      errorCode: "BAD_OUTPUT",
      jobs: [],
      total: null,
    };
  }
  if (typeof payload.error === "string" && payload.error.length > 0) {
    return {
      ok: false,
      error: payload.error,
      errorCode: typeof payload.code === "string" ? payload.code : "API_ERROR",
      jobs: [],
      total: null,
    };
  }
  const { results, total } = portal.extract(payload);
  return {
    ok: true,
    error: null,
    errorCode: null,
    jobs: results.slice(0, 200).map((r) => portal.normalize(r)),
    total,
  };
}
