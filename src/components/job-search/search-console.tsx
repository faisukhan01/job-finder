"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useShortlist } from "@/lib/job-search/shortlist";
import { useSearchHistory } from "@/lib/job-search/search-history";
import { useFitProfile, scoreJob, FIT_BAND_STYLES, type FitResult } from "@/lib/job-search/fit-ranker";
import { saveLastSearch, loadLastSearch, clearLastSearch, type StoredSearchForm } from "@/lib/job-search/search-session";
import { buildResultsCsv, slugifyQuery } from "@/lib/job-search/results-export";
import { translateDanish } from "@/lib/job-search/danish-labels";
import { JobDetailSheet } from "@/components/job-search/job-detail-sheet";
import { SalaryQuickTrigger } from "@/components/job-search/salary-quick-dialog";
import type { SearchRequestDetail } from "@/components/job-search/discover-panel";
import type {
  PortalMeta,
  PortalSearchOutcome,
  SearchResponse,
  NormalizedJob,
  SearchFilters,
  FreehireFacets,
  LocationSuggestion,
  SuggestResponse,
} from "@/lib/job-search/shared-types";
import {
  Search,
  Loader2,
  ExternalLink,
  Building2,
  MapPin,
  CalendarDays,
  AlertTriangle,
  Globe2,
  Timer,
  ListFilter,
  Star,
  History,
  X,
  Tag,
  ArrowDownWideNarrow,
  ChevronRight,
  Users,
  CalendarClock,
  Trophy,
  Files,
  SlidersHorizontal,
  Sparkles,
  Wand2,
  Hash,
  Briefcase,
  Laptop,
  Download,
  ArchiveRestore,
  Hourglass,
  CalendarRange,
  MapPinned,
  ShieldCheck,
} from "lucide-react";

const PORTAL_OPTIONS: { id: string; name: string }[] = [
  { id: "all", name: "All portals (parallel)" },
  { id: "jobindex", name: "Jobindex (DK)" },
  { id: "jobnet", name: "Jobnet (DK)" },
  { id: "jobbank", name: "Akademikernes Jobbank (DK)" },
  { id: "jobdanmark", name: "Jobdanmark (DK)" },
  { id: "linkedin", name: "LinkedIn Jobs (Global)" },
  { id: "freehire", name: "Freehire (Global tech)" },
];

/** One-tap location presets — the routing engine scopes every search to these. */
const LOCATION_PRESETS: string[] = [
  "Copenhagen, Denmark",
  "Lahore, Pakistan",
  "Karachi, Pakistan",
  "Islamabad, Pakistan",
  "Dubai, UAE",
  "London, UK",
  "Berlin, Germany",
  "New York, USA",
  "Remote",
];

/** Client-side deadline window for the result list (presets + custom range). */
type DeadlineMode = "all" | "d7" | "d14" | "d30" | "custom";

const DEADLINE_PRESETS: { id: DeadlineMode; label: string }[] = [
  { id: "all", label: "All" },
  { id: "d7", label: "≤ 7 days" },
  { id: "d14", label: "≤ 14 days" },
  { id: "d30", label: "≤ 30 days" },
  { id: "custom", label: "Custom range" },
];

/** Total postings across all portal outcomes (raw response, before client filters). */
function totalJobsCount(response: SearchResponse | null): number {
  return response?.outcomes.reduce((a, o) => a + o.jobs.length, 0) ?? 0;
}

function formatDate(raw: string | null): string | null {
  if (!raw) return null;
  const dmy = raw.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;
  return raw.slice(0, 10);
}

function relativeDate(iso: string | null): string | null {
  const norm = formatDate(iso);
  if (!norm) return null;
  const then = new Date(`${norm}T00:00:00Z`).getTime();
  if (Number.isNaN(then)) return norm;
  const days = Math.round((Date.now() - then) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "1d ago";
  if (days < 14) return `${days}d ago`;
  return norm;
}

function daysUntil(iso: string | null): number | null {
  const norm = formatDate(iso);
  if (!norm) return null;
  const then = new Date(`${norm}T00:00:00Z`).getTime();
  if (Number.isNaN(then)) return null;
  return Math.round((then - Date.now()) / 86_400_000);
}

function FitBadge({ fit }: { fit: FitResult }) {
  if (fit.score == null) return null;
  const style = FIT_BAND_STYLES[fit.band];
  const tip = fit.band === "veto"
    ? `Vetoed by deal-breaker: "${fit.vetoedBy}"`
    : `Matched: ${fit.matchedSkills.length > 0 ? fit.matchedSkills.join(", ") : "none of the profile skills"}${fit.matchedLocation ? ` · location ${fit.matchedLocation}` : ""}`;
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ${style.className}`} data-testid="fit-badge">
            <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
            {fit.band === "veto" ? "veto" : fit.score}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-64 text-xs">
          <span className="font-semibold">{style.label}</span> — {tip}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/** Extra chip text with Danish→English translation and original preserved in the title. */
function RowExtra({ extra }: { extra: string }) {
  const t = translateDanish(extra);
  return (
    <span className="hidden md:inline" title={t.translated ? `DK: ${extra}` : undefined}>
      · {t.text}
    </span>
  );
}

interface JobRowProps {
  job: NormalizedJob;
  showPortal: boolean;
  portalName?: string;
  portalId: string;
  index: number;
  fit: FitResult | null;
  isTopMatch: boolean;
  onOpenDetail: (job: NormalizedJob) => void;
  showSalaryAction: boolean;
}

function JobRowInner({ job, showPortal, portalName, portalId, index, fit, isTopMatch, onOpenDetail, showSalaryAction }: JobRowProps) {
  const { isStarred, toggle, hydrated } = useShortlist();
  const starred = hydrated && isStarred(portalId, job.id);
  const rel = relativeDate(job.date);
  const accent = fit ? FIT_BAND_STYLES[fit.band].dot : null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, delay: Math.min(index * 0.03, 0.3) }}
      onClick={() => onOpenDetail(job)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpenDetail(job);
        }
      }}
      aria-label={`Open details for ${job.title}`}
      className={`group relative flex cursor-pointer flex-col gap-1.5 border-b border-border/50 px-3 py-3 outline-none transition-colors last:border-b-0 hover:bg-muted/40 focus-visible:bg-muted/40 sm:flex-row sm:items-start sm:gap-3 sm:px-4 ${
        isTopMatch ? "bg-emerald-500/[0.06] dark:bg-emerald-400/[0.06]" : ""
      }`}
    >
      {/* fit accent rail */}
      <span
        aria-hidden
        className={`absolute inset-y-0 left-0 w-0.5 ${accent ?? "bg-transparent"} ${isTopMatch ? "bg-emerald-500" : accent ?? ""} transition-opacity sm:opacity-60 sm:group-hover:opacity-100`}
      />
      <button
        onClick={(e) => {
          e.stopPropagation();
          toggle(portalId, portalName ?? portalId, job);
        }}
        aria-label={starred ? `Remove ${job.title} from shortlist` : `Add ${job.title} to shortlist`}
        aria-pressed={starred}
        className="mt-0.5 shrink-0 self-start rounded-full p-1 transition-all focus-visible:ring-2 focus-visible:ring-ring sm:ml-1.5"
      >
        <Star
          className={`h-4 w-4 transition-colors ${
            starred
              ? "fill-amber-400 text-amber-500"
              : "text-muted-foreground/30 hover:bg-amber-500/10 hover:text-amber-500 sm:opacity-0 sm:group-hover:opacity-100"
          }`}
        />
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-600/10 text-[10px] font-bold uppercase text-emerald-700 dark:text-emerald-400">
            {(job.company ?? job.title).trim().charAt(0)}
          </span>
          <div className="min-w-0">
            <div className="flex items-start gap-1.5">
              <span className="line-clamp-2 text-sm font-medium leading-snug underline-offset-2 group-hover:underline">
                {job.title}
              </span>
              <ExternalLink className="mt-0.5 h-3 w-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-60" />
              {isTopMatch ? (
                <Badge className="mt-0 hidden h-4 gap-0.5 border-transparent bg-emerald-600/15 px-1.5 text-[9px] font-bold uppercase tracking-wide text-emerald-700 hover:bg-emerald-600/15 dark:text-emerald-300 sm:inline-flex">
                  <Trophy className="h-2.5 w-2.5" /> top match
                </Badge>
              ) : null}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              {job.company ? (
                <span className="inline-flex items-center gap-1">
                  <Building2 className="h-3 w-3" /> {job.company}
                </span>
              ) : null}
              {job.location ? (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> {job.location}
                </span>
              ) : null}
              {job.extra ? <RowExtra extra={job.extra} /> : null}
            </div>
          </div>
        </div>
      </div>
      <div className="ml-9 flex shrink-0 flex-wrap items-center gap-1.5 sm:ml-0 sm:flex-col sm:items-end sm:gap-1 sm:pr-1">
        {showPortal && portalName ? <Badge variant="outline" className="text-[10px]">{portalName}</Badge> : null}
        {fit ? <FitBadge fit={fit} /> : null}
        {rel ? (
          <span
            className="inline-flex items-center gap-1 text-[11px] text-muted-foreground"
            title={formatDate(job.date) ?? undefined}
          >
            <CalendarDays className="h-3 w-3" /> {rel}
          </span>
        ) : null}
        {job.deadline ? (
          <span className={`inline-flex items-center gap-1 text-[11px] font-medium ${(daysUntil(job.deadline) ?? 99) <= 14 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`}>
            <CalendarDays className="h-3 w-3" /> due {formatDate(job.deadline)}
          </span>
        ) : null}
        <span className="hidden items-center sm:flex">
          {showSalaryAction ? <SalaryQuickTrigger company={job.company ?? ""} /> : null}
        </span>
        <ChevronRight className="hidden h-3.5 w-3.5 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5 group-hover:text-muted-foreground sm:inline-block" />
      </div>
    </motion.div>
  );
}

const cardVariants = {
  hidden: { opacity: 0, y: 14 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, delay: i * 0.07, ease: "easeOut" as const },
  }),
};

/** Removable chip for an active suggestion/facet filter. */
function ActiveChip({ label, value, onRemove }: { label: string; value: string; onRemove: () => void }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/[0.07] px-2.5 py-1 text-xs font-medium text-emerald-700 transition-colors dark:text-emerald-300">
      <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-emerald-600/70 dark:text-emerald-400/70">
        {label}
      </span>
      <span className="truncate">{value}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${label} filter ${value}`}
        className="ml-0.5 shrink-0 rounded-full p-0.5 transition-colors hover:bg-emerald-600/15"
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

/** One row of clickable facet chips with count badges. */
function FacetChipRow({
  icon,
  label,
  items,
  isActive,
  onToggle,
}: {
  icon: React.ReactNode;
  label: string;
  items: { name: string; count: number; slug?: string }[];
  isActive: (s: { name: string; count: number; slug?: string }) => boolean;
  onToggle: (s: { name: string; count: number; slug?: string }) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {items.map((s) => {
          const active = isActive(s);
          return (
            <button
              key={s.slug ?? s.name}
              type="button"
              onClick={() => onToggle(s)}
              aria-pressed={active}
              title={active ? "Click to remove this filter" : "Click to filter by this"}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-all duration-150 active:scale-95 ${
                active
                  ? "border-emerald-500/60 bg-emerald-500/10 font-medium text-emerald-700 shadow-sm shadow-emerald-600/10 dark:text-emerald-300"
                  : "border-border/80 bg-card/60 text-foreground/80 hover:border-emerald-500/40 hover:bg-emerald-500/[0.06] hover:text-foreground"
              }`}
            >
              <span className="max-w-40 truncate font-medium">{s.name}</span>
              <span
                className={`rounded-full px-1.5 py-px text-[10px] tabular-nums ${
                  active ? "bg-emerald-600/20 text-emerald-700 dark:text-emerald-300" : "bg-muted text-muted-foreground"
                }`}
              >
                {s.count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, sub, accent }: { icon: React.ReactNode; label: string; value: string; sub?: string | null; accent: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="flex items-center gap-2.5 rounded-lg border border-border/70 bg-card/60 px-3 py-2.5"
    >
      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${accent}`}>{icon}</span>
      <div className="min-w-0 leading-tight">
        <div className="text-sm font-semibold tabular-nums">{value}</div>
        <div className="truncate text-[10px] uppercase tracking-wide text-muted-foreground">
          {label}
          {sub ? <span className="normal-case tracking-normal"> · {sub}</span> : null}
        </div>
      </div>
    </motion.div>
  );
}

export function SearchConsole({ portals }: { portals: PortalMeta[] }) {
  const { toast } = useToast();
  const { push, entries: history, clear: clearHistory } = useSearchHistory();
  const { profile, hydrated: profileHydrated } = useFitProfile();
  const fitEnabled = profileHydrated && (profile.skills.length > 0 || profile.dealBreakers.length > 0);
  const [portal, setPortal] = useState("all");
  const [query, setQuery] = useState("python developer");
  const [location, setLocation] = useState("Copenhagen, Denmark");
  const [jobAge, setJobAge] = useState("30");
  const [limit, setLimit] = useState("10");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [remote, setRemote] = useState("any");
  const [seniority, setSeniority] = useState("any");
  const [freehireCategory, setFreehireCategory] = useState("");
  const [freehireCountry, setFreehireCountry] = useState("");
  const [municipality, setMunicipality] = useState("");
  const [region, setRegion] = useState("");
  const [zip, setZip] = useState("");
  const [jobtitleId, setJobtitleId] = useState<{ id: string; title: string } | null>(null);
  const [freehireSkill, setFreehireSkill] = useState<string[]>([]);
  const [freehireCompany, setFreehireCompany] = useState<{ name: string; slug: string } | null>(null);
  const [freehireRegion, setFreehireRegion] = useState<string[]>([]);
  const [facets, setFacets] = useState<FreehireFacets | null>(null);
  const [facetsLoading, setFacetsLoading] = useState(false);
  const [locQuery, setLocQuery] = useState("");
  const [locSuggestions, setLocSuggestions] = useState<LocationSuggestion[]>([]);
  const [locOpen, setLocOpen] = useState(false);
  const [locLoading, setLocLoading] = useState(false);
  const [jobdanmarkCategory, setJobdanmarkCategory] = useState<{ id: string; title: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<SearchResponse | null>(null);
  const [restoredAt, setRestoredAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sortByFit, setSortByFit] = useState(true);
  const [deadlineMode, setDeadlineMode] = useState<DeadlineMode>("all");
  const [deadlineFrom, setDeadlineFrom] = useState("");
  const [deadlineTo, setDeadlineTo] = useState("");
  const [detailTarget, setDetailTarget] = useState<{ portalId: string; portalName: string; job: NormalizedJob } | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const locTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchRef = useRef<(override?: SearchOverride) => void>(() => {});

  const portalName = useCallback(
    (id: string) => portals.find((p) => p.id === id)?.name ?? id,
    [portals],
  );

  const scoreFn = useCallback(
    (job: NormalizedJob) => (fitEnabled ? scoreJob(profile, job) : null),
    [fitEnabled, profile],
  );

  /** Client-side deadline window (postings without a deadline never pass an active filter). */
  const passesDeadline = useCallback(
    (job: NormalizedJob): boolean => {
      if (deadlineMode === "all") return true;
      const d = job.deadline?.slice(0, 10);
      if (!d) return false;
      const t = new Date(`${d}T00:00:00Z`).getTime();
      if (Number.isNaN(t)) return false;
      const now = new Date();
      const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
      if (deadlineMode === "custom") {
        const fromOk = !deadlineFrom || t >= new Date(`${deadlineFrom}T00:00:00Z`).getTime();
        const toOk = !deadlineTo || t <= new Date(`${deadlineTo}T00:00:00Z`).getTime();
        return fromOk && toOk;
      }
      const maxDays = deadlineMode === "d7" ? 7 : deadlineMode === "d14" ? 14 : 30;
      const days = (t - todayUtc) / 86_400_000;
      return days >= 0 && days <= maxDays;
    },
    [deadlineMode, deadlineFrom, deadlineTo],
  );

  /** Jobs sorted (optionally by fit), then filtered by the deadline window. */
  const processedOutcomes = useMemo(() => {
    if (!response) return [];
    const outcomes = response.outcomes.map((o) => {
      let jobs = [...o.jobs];
      if (sortByFit && fitEnabled) {
        jobs.sort((a, b) => {
          const fa = scoreFn(a);
          const fb = scoreFn(b);
          const va = fa?.score ?? -1;
          const vb = fb?.score ?? -1;
          if (va !== vb) return vb - va;
          return 0;
        });
      }
      if (deadlineMode !== "all") jobs = jobs.filter(passesDeadline);
      return { ...o, jobs };
    });
    return outcomes;
  }, [response, sortByFit, fitEnabled, scoreFn, deadlineMode, passesDeadline]);

  const visibleJobs = useMemo(
    () => processedOutcomes.reduce((a, o) => a + o.jobs.length, 0),
    [processedOutcomes],
  );
  /** Raw per-portal counts (before the deadline window) for zero-state hints. */
  const rawCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const o of response?.outcomes ?? []) m.set(o.portalId, o.jobs.length);
    return m;
  }, [response]);
  const deadlineActive = deadlineMode !== "all";
  const deadlineHidden = deadlineActive ? totalJobsCount(response) - visibleJobs : 0;
  const deadlineLabel =
    deadlineMode === "all"
      ? "All"
      : deadlineMode === "custom"
        ? deadlineFrom || deadlineTo
          ? `${deadlineFrom || "…"} → ${deadlineTo || "…"}`
          : "Custom"
        : deadlineMode === "d7"
          ? "≤7d"
          : deadlineMode === "d14"
            ? "≤14d"
            : "≤30d";

  const topMatchKey = useMemo(() => {
    if (!fitEnabled || processedOutcomes.length === 0) return null;
    let best: { key: string; score: number } | null = null;
    for (const o of processedOutcomes) {
      for (const job of o.jobs) {
        const f = scoreFn(job);
        const score = f?.score ?? -1;
        if (score > 0 && (!best || score > best.score)) {
          best = { key: `${o.portalId}-${job.id}`, score };
        }
      }
    }
    return best?.key ?? null;
  }, [processedOutcomes, fitEnabled, scoreFn]);

  const stats = useMemo(() => {
    if (!response) return null;
    const allJobs = response.outcomes.flatMap((o) => o.jobs);
    const companies = new Set(allJobs.map((j) => j.company?.toLowerCase()).filter(Boolean));
    const upcoming = allJobs.filter((j) => {
      const d = daysUntil(j.deadline);
      return d != null && d >= 0 && d <= 14;
    }).length;
    let top: { score: number; title: string } | null = null;
    if (fitEnabled) {
      for (const j of allJobs) {
        const f = scoreFn(j);
        if (f?.score != null && (!top || f.score > top.score)) top = { score: f.score, title: j.title };
      }
    }
    return { total: allJobs.length, companies: companies.size, upcoming, top };
  }, [response, fitEnabled, scoreFn]);

  interface SearchOverride {
    portal?: string;
    query?: string;
    location?: string;
    jobAge?: string;
    limit?: string;
    filters?: {
      remote?: string;
      seniority?: string;
      freehireCategory?: string;
      freehireCountry?: string;
      freehireSkill?: string[];
      freehireCompany?: { name: string; slug: string } | null;
      freehireRegion?: string[];
      municipality?: string;
      region?: string;
      zip?: string;
      jobtitleId?: { id: string; title: string } | null;
      jobdanmarkCategory?: { id: string; title: string } | null;
    };
  }

  function buildApiFilters(over?: SearchOverride["filters"]): { api: SearchFilters; merged: StoredSearchForm } {
    const r = over?.remote ?? remote;
    const s = over?.seniority ?? seniority;
    const fc = over?.freehireCategory ?? freehireCategory;
    const co = over?.freehireCountry ?? freehireCountry;
    const sk = over?.freehireSkill ?? freehireSkill;
    const cmp = over?.freehireCompany !== undefined ? over.freehireCompany : freehireCompany;
    const fhr = over?.freehireRegion ?? freehireRegion;
    const mu = over?.municipality ?? municipality;
    const rg = over?.region ?? region;
    const zp = over?.zip ?? zip;
    const jt = over?.jobtitleId !== undefined ? over.jobtitleId : jobtitleId;
    const jd = over?.jobdanmarkCategory !== undefined ? over.jobdanmarkCategory : jobdanmarkCategory;
    const out: SearchFilters = {};
    if (r !== "any") out.remote = r;
    if (s !== "any") out.seniority = s;
    const fcTrim = fc.trim();
    if (fcTrim) out.freehireCategory = fcTrim;
    const coTrim = co.trim();
    if (coTrim) out.country = coTrim;
    if (sk.length > 0) out.freehireSkill = sk.join(",");
    if (cmp) out.freehireCompany = cmp.slug;
    if (fhr.length > 0) out.freehireRegion = fhr.join(",");
    const muTrim = mu.trim();
    if (muTrim) out.municipality = muTrim;
    const rgTrim = rg.trim();
    if (rgTrim) out.region = rgTrim;
    const zpTrim = zp.trim();
    if (zpTrim) out.zip = zpTrim;
    if (jt) out.jobtitleId = jt.id;
    if (jd) out.jobdanmarkCategory = jd.id;
    return {
      api: out,
      merged: {
        portal: "",
        query: "",
        location: "",
        jobAge: "",
        limit: "",
        remote: r,
        seniority: s,
        freehireCategory: fc,
        freehireCountry: co,
        municipality: mu,
        region: rg,
        zip: zp,
        jobtitleId: jt,
        freehireSkill: sk,
        freehireCompany: cmp,
        freehireRegion: fhr,
        jobdanmarkCategory: jd,
      },
    };
  }

  async function runSearch(override?: SearchOverride) {
    const p = override?.portal ?? portal;
    const q = (override?.query ?? query).trim();
    const loc = (override?.location ?? location).trim();
    const age = override?.jobAge ?? jobAge;
    const lim = override?.limit ?? limit;
    const { api: apiFilters, merged } = buildApiFilters(override?.filters);
    const filterActive = Object.values(apiFilters).some((v) => v != null && v !== "");
    if (!q && !filterActive) {
      toast({ title: "Enter a search query first", variant: "destructive" });
      return;
    }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);
    setRestoredAt(null);
    if (q) {
      push({ query: q, portal: p, location: loc, jobAge: age, limit: lim, at: new Date().toISOString() });
    }
    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          portal: p,
          query: q,
          location: loc || undefined,
          limit: Number(lim),
          jobAge: age === "any" ? null : Number(age),
          filters: apiFilters,
        }),
        signal: controller.signal,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : `Search failed (${res.status})`);
      } else {
        const searchResponse = data as SearchResponse;
        setResponse(searchResponse);
        // Persist the full form + response so a reload restores this view.
        saveLastSearch({
          form: {
            ...merged,
            portal: p,
            query: q,
            location: loc,
            jobAge: age,
            limit: lim,
            deadlineMode,
            deadlineFrom,
            deadlineTo,
          },
          response: searchResponse,
          savedAt: new Date().toISOString(),
        });
        const okCount = searchResponse.outcomes.filter((o) => o.ok).length;
        const total = searchResponse.outcomes.reduce((a, o) => a + o.jobs.length, 0);
        toast({
          title: `Search complete — ${total} jobs from ${okCount}/${searchResponse.outcomes.length} portals`,
          description: `Finished in ${(searchResponse.tookMs / 1000).toFixed(1)}s`,
        });
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        setError((e as Error).message || "Network error");
      }
    } finally {
      setLoading(false);
    }
  }

  /** Drop the session-persisted search; results stay on screen as "fresh". */
  function dismissRestored() {
    clearLastSearch();
    setRestoredAt(null);
  }

  function downloadResultsCsv() {
    if (!response) return;
    const csv = buildResultsCsv(response.outcomes);
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `results-${slugifyQuery(response.query)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({
      title: "Results exported",
      description: `${totalJobs} posting(s) across ${response.outcomes.length} portal outcome(s) as CSV.`,
    });
  }

  function rerunFromHistory(h: (typeof history)[number]) {
    setPortal(h.portal);
    setQuery(h.query);
    setLocation(h.location);
    setJobAge(h.jobAge);
    setLimit(h.limit);
    runSearch({ portal: h.portal, query: h.query, location: h.location, jobAge: h.jobAge, limit: h.limit });
  }

  /** Discover panel (and future panels) can request a search via a window event. */
  useEffect(() => {
    function onRequest(e: Event) {
      const detail = (e as CustomEvent<SearchRequestDetail>).detail;
      if (!detail) return;
      const override: SearchOverride = { portal: detail.portal };
      setPortal(detail.portal);
      if (detail.location != null) {
        setLocation(detail.location);
        override.location = detail.location;
      }
      if (detail.jobdanmarkCategory) {
        setJobdanmarkCategory(detail.jobdanmarkCategory);
        override.filters = { jobdanmarkCategory: detail.jobdanmarkCategory };
      }
      if (detail.query != null) {
        setQuery(detail.query);
        override.query = detail.query;
      }
      searchRef.current(override);
    }
    window.addEventListener("aijs:search-request", onRequest);
    return () => window.removeEventListener("aijs:search-request", onRequest);
  }, []);

  // Keep the event handler pointed at the latest runSearch without re-subscribing.
  useEffect(() => {
    searchRef.current = runSearch;
  });

  // Hydrate the last search from sessionStorage after mount — restores the
  // results view (form + response) after a page reload within the same tab.
  // Must not run during SSR; a one-shot session restore, not derived state.
  useEffect(() => {
    const stored = loadLastSearch();
    if (stored) {
      const f = stored.form;
      setPortal(f.portal);
      setQuery(f.query);
      setLocation(f.location);
      setJobAge(f.jobAge);
      setLimit(f.limit);
      setRemote(f.remote ?? "any");
      setSeniority(f.seniority ?? "any");
      setFreehireCategory(f.freehireCategory ?? "");
      setFreehireCountry(f.freehireCountry ?? "");
      setMunicipality(f.municipality ?? "");
      setRegion(f.region ?? "");
      setZip(f.zip ?? "");
      setJobtitleId(f.jobtitleId ?? null);
      setFreehireSkill(f.freehireSkill ?? []);
      setFreehireCompany(f.freehireCompany ?? null);
      setFreehireRegion(f.freehireRegion ?? []);
      setJobdanmarkCategory(f.jobdanmarkCategory ?? null);
      // Deadline window is part of the view — restore it too (validated).
      if (f.deadlineMode && ["all", "d7", "d14", "d30", "custom"].includes(f.deadlineMode)) {
        setDeadlineMode(f.deadlineMode as DeadlineMode);
        setDeadlineFrom(f.deadlineFrom ?? "");
        setDeadlineTo(f.deadlineTo ?? "");
      }
      setResponse(stored.response);
      setRestoredAt(stored.savedAt);
    }
  }, []);

  // The deadline window is a view filter, not part of the request — keep the
  // session-stored search in sync whenever it changes so a reload restores
  // the exact filtered view (skip until a response exists; private-mode safe).
  const viewSyncRef = useRef(false);
  useEffect(() => {
    if (!response) return;
    if (!viewSyncRef.current) {
      // First run after mount/restore — the stored form already matches.
      viewSyncRef.current = true;
      return;
    }
    const stored = loadLastSearch();
    if (!stored) return;
    saveLastSearch({
      ...stored,
      form: { ...stored.form, deadlineMode, deadlineFrom, deadlineTo },
    });
  }, [response, deadlineMode, deadlineFrom, deadlineTo]);

  const totalJobs = totalJobsCount(response);
  /** Restored results older than STALE_HOURS get a visible freshness warning. */
  const STALE_HOURS = 6;
  const restoredAgeH = useMemo(() => {
    if (!restoredAt) return null;
    const h = (Date.now() - new Date(restoredAt).getTime()) / 3_600_000;
    return Number.isFinite(h) && h >= 0 ? h : null;
  }, [restoredAt]);
  const restoredStale = restoredAgeH != null && restoredAgeH >= STALE_HOURS;
  const filterCount = useMemo(() => {
    let n = 0;
    if (remote !== "any") n += 1;
    if (seniority !== "any") n += 1;
    if (freehireCategory.trim()) n += 1;
    if (freehireCountry.trim()) n += 1;
    if (freehireSkill.length > 0) n += 1;
    if (freehireCompany) n += 1;
    if (freehireRegion.length > 0) n += 1;
    if (municipality.trim()) n += 1;
    if (region.trim()) n += 1;
    if (zip.trim()) n += 1;
    if (jobtitleId) n += 1;
    if (jobdanmarkCategory) n += 1;
    return n;
  }, [remote, seniority, freehireCategory, freehireCountry, freehireSkill, freehireCompany, freehireRegion, municipality, region, zip, jobtitleId, jobdanmarkCategory]);

  function resetAdvancedFilters() {
    setRemote("any");
    setSeniority("any");
    setFreehireCategory("");
    setFreehireCountry("");
    setFreehireSkill([]);
    setFreehireCompany(null);
    setFreehireRegion([]);
    setMunicipality("");
    setRegion("");
    setZip("");
    setJobtitleId(null);
    setJobdanmarkCategory(null);
    setLocQuery("");
    setLocSuggestions([]);
    setLocOpen(false);
  }

  /** Toggle a skill facet chip in/out of the active skill list. */
  function toggleSkill(name: string) {
    setFreehireSkill((prev) =>
      prev.includes(name) ? prev.filter((s) => s !== name) : [...prev, name],
    );
  }

  /** Toggle a macro-region code in/out of the freehire --region list. */
  function toggleRegionCode(code: string) {
    setFreehireRegion((prev) =>
      prev.includes(code) ? prev.filter((r) => r !== code) : [...prev, code],
    );
  }

  /** Toggle a country code in/out of the comma-separated freehire country list. */
  function toggleCountry(code: string) {
    setFreehireCountry((prev) => {
      const list = prev
        .split(",")
        .map((c) => c.trim().toLowerCase())
        .filter(Boolean);
      return list.includes(code)
        ? list.filter((c) => c !== code).join(",")
        : [...list, code].join(",");
    });
  }

  const freehireCountries = useMemo(
    () =>
      freehireCountry
        .split(",")
        .map((c) => c.trim().toLowerCase())
        .filter(Boolean),
    [freehireCountry],
  );

  async function loadFacets() {
    setFacetsLoading(true);
    try {
      const res = await fetch(`/api/facets?q=${encodeURIComponent(query.trim())}`);
      const data = (await res.json()) as FreehireFacets;
      setFacets(data);
      if (!data.ok) {
        toast({ title: "Facet suggestion failed", description: data.error ?? undefined, variant: "destructive" });
      }
    } catch {
      toast({ title: "Facet suggestion failed", description: "Network error", variant: "destructive" });
    } finally {
      setFacetsLoading(false);
    }
  }

  /** Debounced jobdanmark location/title suggestions as the user types. */
  function onLocQueryChange(v: string) {
    setLocQuery(v);
    if (locTimerRef.current) clearTimeout(locTimerRef.current);
    if (v.trim().length < 2) {
      setLocSuggestions([]);
      setLocOpen(false);
      setLocLoading(false);
      return;
    }
    setLocLoading(true);
    locTimerRef.current = setTimeout(async () => {
      const q = v.trim();
      try {
        const [locRes, jtRes] = await Promise.all([
          fetch(`/api/suggest?source=locations&q=${encodeURIComponent(q)}`),
          fetch(`/api/suggest?source=jobtitles&q=${encodeURIComponent(q)}`),
        ]);
        const loc = (await locRes.json()) as SuggestResponse;
        const jt = (await jtRes.json()) as SuggestResponse;
        const merged = [...(loc.ok ? loc.suggestions : []), ...(jt.ok ? jt.suggestions : [])];
        setLocSuggestions(merged);
        setLocOpen(merged.length > 0);
      } catch {
        setLocSuggestions([]);
        setLocOpen(false);
      } finally {
        setLocLoading(false);
      }
    }, 350);
  }

  function applySuggestion(s: LocationSuggestion) {
    if (s.category === "region") {
      setRegion(s.value);
      setMunicipality("");
      setZip("");
    } else if (s.category === "municipality") {
      setMunicipality(s.value);
      setRegion("");
      setZip("");
    } else if (s.category === "zip") {
      setZip(s.value);
      setRegion("");
      setMunicipality("");
    } else if (s.category === "jobtitle") {
      setJobtitleId({ id: s.value, title: s.text });
    }
    setLocOpen(false);
    setLocQuery("");
    setLocSuggestions([]);
  }

  /** Location/title suggestions grouped by their group label, order preserved. */
  const groupedSuggestions = useMemo(() => {
    const groups: { group: string; items: LocationSuggestion[] }[] = [];
    for (const s of locSuggestions) {
      const g = groups.find((x) => x.group === s.group);
      if (g) g.items.push(s);
      else groups.push({ group: s.group, items: [s] });
    }
    return groups;
  }, [locSuggestions]);

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600/10 text-emerald-600 dark:text-emerald-400">
              <Search className="h-4 w-4" />
            </span>
            <CardTitle className="text-lg">Live job search</CardTitle>
          </div>
          {response ? (
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="secondary">{totalJobs} jobs</Badge>
              <span className="inline-flex items-center gap-1">
                <Timer className="h-3 w-3" /> {(response.tookMs / 1000).toFixed(1)}s
              </span>
              {restoredAt ? (
                <Badge
                  variant="outline"
                  className="gap-1 border-amber-500/40 bg-amber-500/[0.07] text-amber-700 dark:text-amber-300"
                  data-testid="restored-badge"
                >
                  <ArchiveRestore className="h-3 w-3" />
                  restored {new Date(restoredAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  <button
                    type="button"
                    onClick={dismissRestored}
                    aria-label="Dismiss restored search marker"
                    title="Keep the results, clear the restored marker"
                    className="ml-0.5 rounded-full p-0.5 transition-colors hover:bg-amber-600/15"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ) : null}
              {restoredStale ? (
                <Badge
                  variant="outline"
                  className="gap-1 border-rose-500/40 bg-rose-500/[0.07] text-rose-700 dark:text-rose-300"
                  data-testid="stale-badge"
                  title={`These results were fetched ${Math.floor(restoredAgeH ?? 0)}h ago — postings may be gone or new ones missed.`}
                >
                  <Hourglass className="h-3 w-3" />
                  stale · {Math.floor(restoredAgeH ?? 0)}h
                  <button
                    type="button"
                    onClick={() => runSearch()}
                    aria-label="Re-run this search for fresh results"
                    title="Re-run this search now"
                    className="ml-0.5 inline-flex items-center gap-0.5 rounded-full px-1 py-0.5 font-semibold transition-colors hover:bg-rose-600/15"
                  >
                    <Search className="h-3 w-3" />
                    refresh
                  </button>
                </Badge>
              ) : null}
            </div>
          ) : null}
        </div>
        <CardDescription>
          Runs the repo&apos;s portal CLI tools (bun) against live job boards and normalizes each portal&apos;s JSON into one list.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
          <div className="space-y-1.5 md:col-span-3">
            <Label htmlFor="portal">Portal</Label>
            <Select value={portal} onValueChange={setPortal}>
              <SelectTrigger id="portal" aria-label="Job portal">
                <SelectValue placeholder="Select portal" />
              </SelectTrigger>
              <SelectContent>
                {PORTAL_OPTIONS.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 md:col-span-4">
            <Label htmlFor="query">Keywords</Label>
            <Input
              id="query"
              placeholder="e.g. data engineer, ML, UX designer…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !loading) runSearch();
              }}
            />
          </div>
          <div className="space-y-1.5 md:col-span-3">
            <Label htmlFor="location" className="flex items-center gap-1">
              Location
              <span className="text-[10px] text-muted-foreground">(scopes every portal)</span>
            </Label>
            <Input
              id="location"
              placeholder="City, Country — e.g. Lahore, Pakistan"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !loading) runSearch();
              }}
            />
            <div className="flex flex-wrap gap-1" role="group" aria-label="Quick location presets">
              {LOCATION_PRESETS.map((l) => {
                const active = location === l;
                return (
                  <button
                    key={l}
                    type="button"
                    onClick={() => setLocation(l)}
                    aria-pressed={active}
                    className={`rounded-full border px-2 py-0.5 text-[10px] font-medium transition-all active:scale-95 ${
                      active
                        ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                        : "border-border/60 text-muted-foreground hover:border-emerald-500/40 hover:text-foreground"
                    }`}
                  >
                    {l}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 md:col-span-2">
            <div className="space-y-1.5">
              <Label htmlFor="jobage" className="flex items-center gap-1">
                <ListFilter className="h-3 w-3" /> Age
              </Label>
              <Select value={jobAge} onValueChange={setJobAge}>
                <SelectTrigger id="jobage" aria-label="Max posting age">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any</SelectItem>
                  <SelectItem value="1">24h</SelectItem>
                  <SelectItem value="7">7 days</SelectItem>
                  <SelectItem value="14">14 days</SelectItem>
                  <SelectItem value="30">30 days</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="limit">Per portal</Label>
              <Select value={limit} onValueChange={setLimit}>
                <SelectTrigger id="limit" aria-label="Results per portal">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5</SelectItem>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="15">15</SelectItem>
                  <SelectItem value="20">20</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {history.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
              <History className="h-3 w-3" /> Recent:
            </span>
            {history.slice(0, 5).map((h, i) => (
              <button
                key={`${h.query}-${h.portal}-${i}`}
                onClick={() => rerunFromHistory(h)}
                title={`${h.query} · ${h.portal}${h.location ? ` · ${h.location}` : ""}`}
                className="group inline-flex max-w-56 items-center gap-1 rounded-full border border-border/70 px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:border-emerald-500/50 hover:text-foreground"
              >
                <span className="truncate">{h.query}</span>
                <span className="shrink-0 opacity-50">{h.portal === "all" ? "· all" : `· ${h.portal}`}</span>
              </button>
            ))}
            <button
              onClick={clearHistory}
              className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] text-muted-foreground/60 transition-colors hover:text-rose-500"
              aria-label="Clear search history"
            >
              <X className="h-3 w-3" /> clear
            </button>
          </div>
        ) : null}

        {/* Advanced filters (portal-specific) */}
        <div className="rounded-lg border border-border/60 bg-muted/20">
          <button
            type="button"
            onClick={() => setFiltersOpen((v) => !v)}
            aria-expanded={filtersOpen}
            className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left"
          >
            <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Advanced filters
              {filterCount > 0 ? (
                <Badge variant="secondary" className="h-4 px-1.5 text-[10px] tabular-nums">{filterCount}</Badge>
              ) : null}
              <span className="hidden text-[10px] font-normal opacity-70 sm:inline">
                · LinkedIn remote · Freehire facets · Jobdanmark location, zip & job title
              </span>
            </span>
            <ChevronRight className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${filtersOpen ? "rotate-90" : ""}`} />
          </button>
          {filtersOpen ? (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="grid grid-cols-1 gap-3 border-t border-border/60 px-3 py-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="f-remote" className="text-[11px] text-muted-foreground">
                    Workplace type <span className="opacity-60">(LinkedIn)</span>
                  </Label>
                  <Select value={remote} onValueChange={setRemote}>
                    <SelectTrigger id="f-remote" aria-label="Workplace type filter">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Any</SelectItem>
                      <SelectItem value="remote">Remote</SelectItem>
                      <SelectItem value="hybrid">Hybrid</SelectItem>
                      <SelectItem value="onsite">On-site</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="f-seniority" className="text-[11px] text-muted-foreground">
                    Seniority <span className="opacity-60">(Freehire)</span>
                  </Label>
                  <Select value={seniority} onValueChange={setSeniority}>
                    <SelectTrigger id="f-seniority" aria-label="Seniority filter">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Any</SelectItem>
                      <SelectItem value="junior">Junior</SelectItem>
                      <SelectItem value="middle">Middle</SelectItem>
                      <SelectItem value="senior">Senior</SelectItem>
                      <SelectItem value="staff">Staff</SelectItem>
                      <SelectItem value="principal">Principal</SelectItem>
                      <SelectItem value="lead">Lead</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="f-country" className="text-[11px] text-muted-foreground">
                    Countries <span className="opacity-60">(Freehire, e.g. DK,DE,SE)</span>
                  </Label>
                  <Input
                    id="f-country"
                    value={freehireCountry}
                    onChange={(e) => setFreehireCountry(e.target.value)}
                    placeholder="DK,DE"
                    className="h-9"
                    autoComplete="off"
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="f-fhcat" className="text-[11px] text-muted-foreground">
                    Job categories <span className="opacity-60">(Freehire, e.g. backend,ml_ai)</span>
                  </Label>
                  <Input
                    id="f-fhcat"
                    value={freehireCategory}
                    onChange={(e) => setFreehireCategory(e.target.value)}
                    placeholder="backend, ml_ai, devops…"
                    className="h-9"
                    autoComplete="off"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="f-fhskill" className="text-[11px] text-muted-foreground">
                    Skills <span className="opacity-60">(Freehire, comma = OR)</span>
                  </Label>
                  <Input
                    id="f-fhskill"
                    value={freehireSkill.join(",")}
                    onChange={(e) =>
                      setFreehireSkill(
                        e.target.value
                          .split(",")
                          .map((s) => s.trim().toLowerCase())
                          .filter(Boolean),
                      )
                    }
                    placeholder="go, kubernetes…"
                    className="h-9"
                    autoComplete="off"
                  />
                </div>
                <div className="relative space-y-1.5">
                  <Label htmlFor="f-location" className="text-[11px] text-muted-foreground">
                    Location <span className="opacity-60">(Jobdanmark · type to search)</span>
                  </Label>
                  <div className="relative">
                    <Input
                      id="f-location"
                      value={locQuery}
                      onChange={(e) => onLocQueryChange(e.target.value)}
                      onFocus={() => {
                        if (locSuggestions.length > 0) setLocOpen(true);
                      }}
                      onBlur={() => {
                        setTimeout(() => setLocOpen(false), 150);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Escape") setLocOpen(false);
                      }}
                      placeholder="København, region or zip…"
                      className="h-9 pr-8"
                      autoComplete="off"
                      role="combobox"
                      aria-expanded={locOpen}
                      aria-controls="loc-suggest-list"
                      aria-autocomplete="list"
                    />
                    {locLoading ? (
                      <Loader2 className="absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
                    ) : null}
                    {locOpen && groupedSuggestions.length > 0 ? (
                      <div
                        id="loc-suggest-list"
                        role="listbox"
                        aria-label="Location suggestions"
                        className="absolute left-0 right-0 top-full z-30 mt-1 max-h-72 overflow-y-auto rounded-lg border border-border bg-popover shadow-lg shadow-black/10 scrollbar-thin"
                      >
                        {groupedSuggestions.map((g) => (
                          <div key={g.group} role="group" aria-label={g.group}>
                            <div className="sticky top-0 z-10 border-b border-border/60 bg-muted/95 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                              {g.group}
                            </div>
                            {g.items.map((s) => (
                              <button
                                key={`${s.category}-${s.value}`}
                                type="button"
                                role="option"
                                aria-selected={false}
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  applySuggestion(s);
                                }}
                                className="flex w-full items-center justify-between gap-2 px-2.5 py-1.5 text-left text-xs transition-colors hover:bg-emerald-500/10 focus-visible:bg-emerald-500/10 focus-visible:outline-none"
                              >
                                <span className="truncate">{s.text}</span>
                                <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-[9px] uppercase text-muted-foreground">
                                  {s.category}
                                </span>
                              </button>
                            ))}
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

              {/* Active filter chips (picked via suggestions / facets) */}
              {(region || zip || municipality.trim() || jobtitleId || freehireCompany || freehireRegion.length > 0 || freehireCountries.length > 0 || freehireSkill.length > 0) ? (
                <div className="flex flex-wrap items-center gap-1.5 border-t border-border/60 px-3 py-2.5">
                  {region ? (
                    <ActiveChip label="Region" value={region} onRemove={() => setRegion("")} />
                  ) : null}
                  {zip ? <ActiveChip label="Zip" value={zip} onRemove={() => setZip("")} /> : null}
                  {municipality.trim() ? (
                    <ActiveChip label="Kommune" value={municipality} onRemove={() => setMunicipality("")} />
                  ) : null}
                  {jobtitleId ? (
                    <ActiveChip label="Jobtitel" value={jobtitleId.title} onRemove={() => setJobtitleId(null)} />
                  ) : null}
                  {freehireCompany ? (
                    <ActiveChip
                      label="Company"
                      value={freehireCompany.name}
                      onRemove={() => setFreehireCompany(null)}
                    />
                  ) : null}
                  {freehireSkill.map((s) => (
                    <ActiveChip key={s} label="Skill" value={s} onRemove={() => toggleSkill(s)} />
                  ))}
                  {freehireRegion.map((r) => (
                    <ActiveChip key={`fhr-${r}`} label="Macro-region" value={r} onRemove={() => toggleRegionCode(r)} />
                  ))}
                  {freehireCountries.map((c) => (
                    <ActiveChip key={`fhc-${c}`} label="Country" value={c.toUpperCase()} onRemove={() => toggleCountry(c)} />
                  ))}
                  <button
                    type="button"
                    onClick={resetAdvancedFilters}
                    className="ml-1 text-[11px] font-medium text-muted-foreground/70 underline-offset-2 transition-colors hover:text-rose-500 hover:underline"
                  >
                    Reset all
                  </button>
                </div>
              ) : null}

              {/* Freehire facet suggestions (aggregated from live results) */}
              <div className="border-t border-border/60 px-3 py-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                    Freehire facet suggestions
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={loadFacets}
                    disabled={facetsLoading}
                    className="h-7 gap-1.5 rounded-full border-border/80 px-3 text-xs"
                  >
                    {facetsLoading ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Wand2 className="h-3 w-3" />
                    )}
                    Suggest from live data
                  </Button>
                </div>
                {facets ? (
                  facets.ok ? (
                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25 }}
                      className="mt-2.5 space-y-2.5"
                    >
                      <FacetChipRow
                        icon={<Hash className="h-3 w-3" />}
                        label={`Skills · ${facets.scanned} postings scanned`}
                        items={facets.skills}
                        isActive={(s) => freehireSkill.includes(s.name)}
                        onToggle={(s) => toggleSkill(s.name)}
                      />
                      <FacetChipRow
                        icon={<Briefcase className="h-3 w-3" />}
                        label="Companies"
                        items={facets.companies}
                        isActive={(s) => freehireCompany?.slug === s.slug}
                        onToggle={(s) =>
                          setFreehireCompany(
                            freehireCompany?.slug === s.slug || !s.slug
                              ? null
                              : { name: s.name, slug: s.slug },
                          )
                        }
                      />
                      <FacetChipRow
                        icon={<Laptop className="h-3 w-3" />}
                        label="Work modes"
                        items={facets.workModes}
                        isActive={(s) => remote === s.name}
                        onToggle={(s) => {
                          if (!["remote", "hybrid", "onsite"].includes(s.name)) return;
                          setRemote(remote === s.name ? "any" : s.name);
                        }}
                      />
                      <FacetChipRow
                        icon={<Globe2 className="h-3 w-3" />}
                        label="Macro-regions"
                        items={facets.regions}
                        isActive={(s) => freehireRegion.includes(s.name)}
                        onToggle={(s) => toggleRegionCode(s.name)}
                      />
                      <FacetChipRow
                        icon={<MapPin className="h-3 w-3" />}
                        label="Countries"
                        items={facets.countries}
                        isActive={(s) => freehireCountries.includes(s.name)}
                        onToggle={(s) => toggleCountry(s.name)}
                      />
                      <p className="text-[10px] text-muted-foreground/70">
                        Aggregated in {(facets.tookMs / 1000).toFixed(1)}s{facets.cached ? " · cached" : ""} — click a
                        chip to narrow the next Freehire search.
                      </p>
                    </motion.div>
                  ) : (
                    <p className="mt-2 text-[11px] text-destructive/90">{facets.error ?? "Facet lookup failed"}</p>
                  )
                ) : (
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    Scans ~100 live Freehire postings for the current keywords and surfaces the most common skills and
                    employers as one-click filters.
                  </p>
                )}
              </div>
            </motion.div>
          ) : null}
        </div>

        {/* Active category chip from the Discover panel */}
        {jobdanmarkCategory ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/[0.07] px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
              <Tag className="h-3 w-3" />
              Jobdanmark category: {jobdanmarkCategory.title}
              <button
                onClick={() => setJobdanmarkCategory(null)}
                aria-label="Remove category filter"
                className="ml-0.5 rounded-full p-0.5 transition-colors hover:bg-emerald-600/15"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
            <span className="text-[11px] text-muted-foreground">empty keywords + this chip = browse the whole category</span>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={() => runSearch()} disabled={loading} className="min-w-40 bg-emerald-600 text-white shadow-sm shadow-emerald-600/20 hover:bg-emerald-700">
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Searching portals…
              </>
            ) : (
              <>
                <Search className="mr-2 h-4 w-4" />
                Search jobs
              </>
            )}
          </Button>
          {loading ? (
            <span className="text-xs text-muted-foreground">
              Hitting live boards — portals respond at different speeds, this can take up to ~90s.
            </span>
          ) : null}
        </div>

        <AnimatePresence>
          {error ? (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Search failed</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            </motion.div>
          ) : null}
        </AnimatePresence>

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : null}

        {response && !loading ? (
          <div className="space-y-4">
            {/* Insights strip */}
            {stats && stats.total > 0 ? (
              <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                <StatCard icon={<Files className="h-3.5 w-3.5" />} label="postings" value={String(stats.total)} accent="bg-emerald-600/10 text-emerald-600 dark:text-emerald-400" />
                <StatCard icon={<Users className="h-3.5 w-3.5" />} label="employers" value={String(stats.companies)} accent="bg-teal-600/10 text-teal-600 dark:text-teal-400" />
                <StatCard icon={<CalendarClock className="h-3.5 w-3.5" />} label="due ≤14 days" value={String(stats.upcoming)} accent="bg-amber-600/10 text-amber-600 dark:text-amber-400" />
                {fitEnabled ? (
                  <StatCard
                    icon={<Trophy className="h-3.5 w-3.5" />}
                    label="top fit"
                    value={stats.top ? String(stats.top.score) : "—"}
                    sub={stats.top ? stats.top.title.slice(0, 26) : "no skills matched"}
                    accent="bg-rose-600/10 text-rose-600 dark:text-rose-400"
                  />
                ) : (
                  <StatCard icon={<SlidersHorizontal className="h-3.5 w-3.5" />} label="fit triage" value="off" sub="set a fit profile" accent="bg-muted text-muted-foreground" />
                )}
              </div>
            ) : null}

            {/* Location routing: resolved scope + honestly skipped boards */}
            {response.routing && (response.routing.skippedPortals.length > 0 || response.routing.notices.length > 0) ? (
              <div className="rounded-lg border border-sky-500/30 bg-sky-500/[0.05] px-3.5 py-3" data-testid="location-routing">
                <div className="flex items-start gap-2">
                  <MapPinned className="mt-0.5 h-4 w-4 shrink-0 text-sky-600 dark:text-sky-400" />
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <p className="text-xs font-semibold text-sky-800 dark:text-sky-300">
                      Location routing — {response.routing.isRemote ? "Remote / anywhere" : response.routing.requested}
                      {response.routing.countryCode ? (
                        <span className="ml-1.5 font-normal text-sky-700/80 dark:text-sky-400/80">
                          resolved to <span className="font-mono text-[10px]">{response.routing.countryCode}</span>
                          {response.routing.country ? ` · ${response.routing.country}` : ""}
                        </span>
                      ) : !response.routing.isRemote ? (
                        <span className="ml-1.5 font-normal text-amber-700/90 dark:text-amber-400/90">
                          country not recognized — add one (e.g. “Lahore, Pakistan”)
                        </span>
                      ) : null}
                    </p>
                    {response.routing.skippedPortals.length > 0 ? (
                      <ul className="space-y-1">
                        {response.routing.skippedPortals.map((s) => (
                          <li key={s.portalId} className="flex items-start gap-1.5 text-[11px] leading-snug text-muted-foreground">
                            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-sky-500/60" />
                            <span>
                              <span className="font-medium text-foreground/80">{s.name}</span> skipped — {s.reason}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    {response.routing.notices.map((n, i) => (
                      <p key={i} className="flex items-start gap-1.5 text-[11px] leading-snug text-amber-700 dark:text-amber-400">
                        <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                        <span>{n}</span>
                      </p>
                    ))}
                    <p className="text-[10px] leading-relaxed text-muted-foreground/70">
                      Results are guarded: postings clearly located in another country are hidden and counted per board. Pick a skipped board explicitly to search it anyway.
                    </p>
                  </div>
                </div>
              </div>
            ) : null}

            {/* Results toolbar: export + deadline window + sort */}
            {stats && stats.total > 0 ? (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={downloadResultsCsv}
                    className="h-7 gap-1.5 rounded-full border-border/80 px-3 text-xs"
                    aria-label="Export all results as CSV"
                    data-testid="export-results"
                  >
                    <Download className="h-3 w-3" />
                    Export CSV
                  </Button>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        data-testid="deadline-filter"
                        aria-label={`Deadline window: ${deadlineLabel}`}
                        className={`h-7 gap-1.5 rounded-full px-3 text-xs ${
                          deadlineActive
                            ? "border-amber-500/50 bg-amber-500/[0.07] text-amber-700 dark:text-amber-400"
                            : "border-border/80"
                        }`}
                      >
                        <CalendarRange className="h-3 w-3" />
                        Deadline: {deadlineLabel}
                        {deadlineHidden > 0 ? (
                          <span className="rounded-full bg-amber-500/20 px-1.5 text-[10px] font-semibold tabular-nums">
                            −{deadlineHidden}
                          </span>
                        ) : null}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-72 space-y-3 p-3">
                      <div>
                        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Due within
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {DEADLINE_PRESETS.map((p) => {
                            const active = deadlineMode === p.id;
                            return (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() => {
                                  setDeadlineMode(p.id);
                                  if (p.id !== "custom") {
                                    setDeadlineFrom("");
                                    setDeadlineTo("");
                                  }
                                }}
                                className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all active:scale-95 ${
                                  active
                                    ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                                    : "border-border/70 text-muted-foreground hover:border-emerald-500/40 hover:text-emerald-700 dark:hover:text-emerald-400"
                                }`}
                              >
                                {p.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      {deadlineMode === "custom" ? (
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <Label htmlFor="deadline-from" className="text-[10px] text-muted-foreground">
                              From
                            </Label>
                            <Input
                              id="deadline-from"
                              type="date"
                              value={deadlineFrom}
                              onChange={(e) => setDeadlineFrom(e.target.value)}
                              className="h-8 text-xs"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor="deadline-to" className="text-[10px] text-muted-foreground">
                              To
                            </Label>
                            <Input
                              id="deadline-to"
                              type="date"
                              value={deadlineTo}
                              onChange={(e) => setDeadlineTo(e.target.value)}
                              className="h-8 text-xs"
                            />
                          </div>
                        </div>
                      ) : null}
                      <p className="text-[10px] leading-relaxed text-muted-foreground/70">
                        {deadlineActive
                          ? `${visibleJobs} of ${totalJobs} postings match the window — postings without a deadline are hidden. Exports always include everything.`
                          : "Show only postings closing within a window. Postings without a deadline are hidden while a filter is active."}
                      </p>
                    </PopoverContent>
                  </Popover>
                  {deadlineActive && deadlineHidden > 0 ? (
                    <span className="text-[11px] text-muted-foreground">
                      showing <span className="font-semibold tabular-nums">{visibleJobs}</span> of{" "}
                      {totalJobs}
                    </span>
                  ) : null}
                </div>
                {fitEnabled && stats.total > 1 ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <ArrowDownWideNarrow className="h-3.5 w-3.5" />
                    <Label htmlFor="sort-fit" className="text-[11px]">Sort by fit</Label>
                    <Switch id="sort-fit" checked={sortByFit} onCheckedChange={setSortByFit} aria-label="Sort results by fit score" />
                  </div>
                ) : null}
              </div>
            ) : null}

            {processedOutcomes.map((outcome, i) => (
              <motion.div
                key={outcome.portalId}
                custom={i}
                variants={cardVariants}
                initial="hidden"
                animate="show"
                className="overflow-hidden rounded-lg border border-border/70"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 bg-muted/40 px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <Globe2 className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-semibold">{portalName(outcome.portalId)}</span>
                    {outcome.ok ? (
                      <Badge variant="secondary" className="text-[11px]">
                        {outcome.jobs.length} jobs
                      </Badge>
                    ) : (
                      <Badge variant="destructive" className="text-[11px]">
                        failed
                      </Badge>
                    )}
                    {outcome.locationFiltered ? (
                      <Badge
                        className="border border-amber-500/40 bg-amber-500/10 text-[10px] font-medium text-amber-700 dark:text-amber-400"
                        title="Postings clearly located in another country were hidden by the location guard"
                      >
                        <ShieldCheck className="mr-0.5 h-3 w-3" />
                        −{outcome.locationFiltered} off-location
                      </Badge>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    {outcome.total != null ? <span>{outcome.total.toLocaleString()} total on board</span> : null}
                    <span className="inline-flex items-center gap-1">
                      <Timer className="h-3 w-3" /> {(outcome.tookMs / 1000).toFixed(1)}s
                    </span>
                  </div>
                </div>
                {outcome.error ? (
                  <Alert variant="destructive" className="rounded-none border-0 border-b">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle className="text-sm">{portalName(outcome.portalId)} could not be searched</AlertTitle>
                    <AlertDescription className="text-xs">
                      {outcome.error}
                      {outcome.errorCode === "API_ERROR" ? (
                        <span className="mt-1 block opacity-80">
                          The portal is actively bot-blocking this sandbox IP — this is the CLI&apos;s own honest error, the other portals still work.
                        </span>
                      ) : null}
                    </AlertDescription>
                  </Alert>
                ) : null}
                {outcome.jobs.length > 0 ? (
                  <div className="max-h-96 overflow-y-auto scrollbar-thin">
                    {outcome.jobs.map((job, j) => {
                      const key = `${outcome.portalId}-${job.id}`;
                      return (
                        <JobRowInner
                          key={key}
                          job={job}
                          showPortal={response.outcomes.length > 1}
                          portalName={portalName(outcome.portalId)}
                          portalId={outcome.portalId}
                          index={j}
                          fit={scoreFn(job)}
                          isTopMatch={topMatchKey === key}
                          showSalaryAction={Boolean(job.company)}
                          onOpenDetail={(job2) =>
                            setDetailTarget({ portalId: outcome.portalId, portalName: portalName(outcome.portalId), job: job2 })
                          }
                        />
                      );
                    })}
                  </div>
                ) : !outcome.error ? (
                  <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                    {deadlineActive && (rawCounts.get(outcome.portalId) ?? 0) > 0 ? (
                      <div className="space-y-2">
                        <p>
                          All {rawCounts.get(outcome.portalId)} posting(s) are hidden by the deadline
                          window <span className="font-medium text-amber-700 dark:text-amber-400">({deadlineLabel})</span>.
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setDeadlineMode("all");
                            setDeadlineFrom("");
                            setDeadlineTo("");
                          }}
                          className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/50 bg-amber-500/[0.07] px-3 py-1 text-[11px] font-medium text-amber-700 transition-all hover:bg-amber-500/15 active:scale-95 dark:text-amber-400"
                        >
                          <CalendarRange className="h-3 w-3" />
                          Show everything from {portalName(outcome.portalId)}
                        </button>
                      </div>
                    ) : (
                      <>No postings matched this query on {portalName(outcome.portalId)}.</>
                    )}
                  </div>
                ) : null}
              </motion.div>
            ))}

            {/* Every posting hidden by the deadline window — offer a one-click reset. */}
            {deadlineActive && totalJobs > 0 && visibleJobs === 0 ? (
              <div className="flex flex-col items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/[0.05] px-4 py-6 text-center">
                <CalendarRange className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                <p className="text-sm font-medium">The deadline window hides all {totalJobs} postings</p>
                <p className="max-w-md text-xs text-muted-foreground">
                  Nothing closes within <span className="font-medium text-amber-700 dark:text-amber-400">{deadlineLabel}</span>.
                  Widen the window or clear the filter — exports always include everything.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setDeadlineMode("all");
                    setDeadlineFrom("");
                    setDeadlineTo("");
                  }}
                  className="mt-1 inline-flex items-center gap-1.5 rounded-full border border-amber-500/50 bg-amber-500/10 px-3.5 py-1.5 text-xs font-semibold text-amber-700 transition-all hover:bg-amber-500/20 active:scale-95 dark:text-amber-400"
                >
                  <X className="h-3.5 w-3.5" />
                  Clear deadline filter
                </button>
              </div>
            ) : null}
          </div>
        ) : null}

        {!response && !loading && !error ? (
          <div className="rounded-lg border border-dashed border-border/70 px-4 py-10 text-center">
            <Search className="mx-auto h-8 w-8 text-muted-foreground/50" />
            <p className="mt-3 text-sm font-medium">Try a live search</p>
            <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
              Searches are location-aware: type a city + country (e.g. “Lahore, Pakistan”) and
              Denmark-only boards are skipped automatically, LinkedIn geocodes your city, and
              Freehire is scoped to the country. Click any result for the full description;
              star it to build a tracker-CSV shortlist.
            </p>
          </div>
        ) : null}
      </CardContent>

      <JobDetailSheet
        open={detailTarget != null}
        onOpenChange={(o) => {
          if (!o) setDetailTarget(null);
        }}
        portalId={detailTarget?.portalId ?? ""}
        portalName={detailTarget?.portalName ?? ""}
        job={detailTarget?.job ?? null}
      />
    </Card>
  );
}
