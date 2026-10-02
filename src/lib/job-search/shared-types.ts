/**
 * Pure type definitions shared between client components and API routes.
 * No server-only imports here so client bundles stay clean.
 */

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

/** Per-portal advanced filters (each field only used by specific portals). */
export interface SearchFilters {
  /** linkedin: remote | hybrid | onsite */
  remote?: string | null;
  /** freehire: junior | middle | senior | staff | principal | lead */
  seniority?: string | null;
  /** freehire canonical job category, e.g. backend, ml_ai */
  freehireCategory?: string | null;
  /** freehire ISO-3166 alpha-2 country codes, comma = OR, e.g. "DK,DE" */
  country?: string | null;
  /** jobdanmark category ID (from /api/discover categories) */
  jobdanmarkCategory?: string | null;
  /** jobdanmark municipality name, e.g. "København" */
  municipality?: string | null;
  /** jobdanmark region name, e.g. "Byen København" */
  region?: string | null;
  /** jobdanmark 4-digit zip code, e.g. "1050" */
  zip?: string | null;
  /** jobdanmark job-title id (from autocomplete), e.g. "902" */
  jobtitleId?: string | null;
  /** freehire canonical skill(s), comma = OR, e.g. "go,kubernetes" */
  freehireSkill?: string | null;
  /** freehire company slug (from a result's company_slug) */
  freehireCompany?: string | null;
  /** freehire macro-region codes, comma = OR, e.g. "eu,nordics" */
  freehireRegion?: string | null;
}

/** One clickable facet suggestion aggregated from live search results. */
export interface FacetSuggestion {
  name: string;
  count: number;
  /** Companies only: the company slug used by --company. */
  slug?: string;
}

export interface FreehireFacets {
  ok: boolean;
  query: string;
  scanned: number;
  skills: FacetSuggestion[];
  companies: FacetSuggestion[];
  workModes: FacetSuggestion[];
  regions: FacetSuggestion[];
  countries: FacetSuggestion[];
  tookMs: number;
  cached: boolean;
  error: string | null;
  errorCode: string | null;
}

/** One location/title suggestion from jobdanmark's suggest endpoints. */
export interface LocationSuggestion {
  /** region | municipality | zip | jobtitle */
  category: string;
  group: string;
  text: string;
  value: string;
}

export interface SuggestResponse {
  ok: boolean;
  source: string;
  query: string;
  suggestions: LocationSuggestion[];
  cached: boolean;
  error: string | null;
  errorCode: string | null;
}

export type UpdateStatus = "up_to_date" | "behind" | "error";

export interface UpdatesResponse {
  ok: boolean;
  status: UpdateStatus;
  behindCount: number;
  commits: { sha: string; subject: string }[];
  /** `git diff --stat HEAD..origin/master` output (capped), only when behind. */
  diffStat: string | null;
  details: string | null;
  checkedAt: string;
  cached: boolean;
  error: string | null;
}

/** Per-commit drill-down detail (`git show`), fetched on demand. */
export interface UpdateCommitDetail {
  ok: boolean;
  sha: string;
  author: string | null;
  date: string | null;
  subject: string | null;
  body: string | null;
  /** `git show --stat` file-level output (capped). */
  stat: string | null;
  error?: string;
}

export interface PortalSearchOutcome {
  portalId: string;
  ok: boolean;
  jobs: NormalizedJob[];
  total: number | null;
  error: string | null;
  errorCode: string | null;
  tookMs: number;
  /** Postings hidden by the location guard (clearly in another country). */
  locationFiltered?: number;
}

/** One board excluded from a search because it cannot honor the location. */
export interface SkippedPortal {
  portalId: string;
  name: string;
  reason: string;
}

/** Location-aware routing decisions attached to every search response. */
export interface LocationRouting {
  /** The (sanitized) location the search was scoped to. */
  requested: string;
  city: string | null;
  country: string | null;
  countryCode: string | null;
  isRemote: boolean;
  isDenmark: boolean;
  mode: "none" | "denmark" | "remote" | "international" | "unresolved";
  skippedPortals: SkippedPortal[];
  /** Warnings for explicitly-selected boards that cannot honor the location. */
  notices: string[];
}

export interface SearchResponse {
  query: string;
  location: string;
  limit: number;
  jobAge: number | null;
  filters: SearchFilters;
  tookMs: number;
  outcomes: PortalSearchOutcome[];
  /** Present on all searches made after the location-routing fix. */
  routing?: LocationRouting;
}

export interface PortalMeta {
  id: string;
  name: string;
  board: string;
  market: string;
  description: string;
  requiresLocation: boolean;
  supportsJobAge: boolean;
}

export interface EnvStatus {
  repo: {
    cloned: boolean;
    branch: string | null;
    headCommit: string | null;
    frameworkVersion: string | null;
    remoteUrl: string | null;
  };
  runtimes: {
    bun: string | null;
    python: string | null;
  };
  portals: { id: string; installed: boolean }[];
  toolchain: {
    lualatex: string | null;
    xelatex: string | null;
    pdftotext: boolean;
    pypdf: boolean;
    salaryData: boolean;
  };
  checkedAt: string;
}

export type SuiteId = "python" | "lint" | "typecheck" | "cli";

export interface SuiteResult {
  suite: SuiteId;
  ok: boolean;
  summary: string;
  output: string;
  durationMs: number;
  finishedAt: string;
  running: boolean;
}

export interface SuitesState {
  suites: { id: SuiteId; running: boolean; result: SuiteResult | null }[];
}

/** Normalized full job posting returned by /api/detail. */
export interface JobDetail {
  id: string;
  title: string | null;
  company: string | null;
  location: string | null;
  date: string | null;
  deadline: string | null;
  url: string | null;
  applyUrl: string | null;
  employmentType: string | null;
  hours: string | null;
  description: string | null;
  /** Non-fatal notes, e.g. "description was empty on the portal". */
  notes: string[];
}

export interface DetailResponse {
  portal: string;
  id: string;
  ok: boolean;
  detail: JobDetail | null;
  error: string | null;
  errorCode: string | null;
  tookMs: number;
  cached: boolean;
}
