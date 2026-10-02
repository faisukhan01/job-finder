"use client";

import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  useShortlist,
  buildTrackerCsv,
  TRACKER_STATUSES,
  trackerStatusMeta,
  formatStatusHistory,
  type TrackerStatus,
  type ShortlistItem,
  type StatusTransition,
} from "@/lib/job-search/shortlist";
import { useFitProfile, scoreJob, FIT_BAND_STYLES, type FitResult } from "@/lib/job-search/fit-ranker";
import { buildShortlistMarkdown } from "@/lib/job-search/analytics-export";
import { relativeTime } from "@/lib/job-search/relative-time";
import { ShortlistAnalytics } from "@/components/job-search/shortlist-analytics";
import {
  Star,
  StarOff,
  Download,
  Trash2,
  ExternalLink,
  ClipboardList,
  ClipboardCopy,
  Building2,
  MapPin,
  CalendarDays,
  SlidersHorizontal,
  Route,
  History,
  FileText,
  CheckSquare,
} from "lucide-react";

const BOARD_NAMES: Record<string, string> = {
  jobindex: "jobindex.dk",
  jobnet: "jobnet.dk",
  jobbank: "jobbank.dk",
  jobdanmark: "jobdanmark.dk",
  linkedin: "linkedin.com",
  freehire: "freehire.me",
};

type SortMode = "recent" | "fit" | "company" | "deadline";

const SORT_OPTIONS: { id: SortMode; label: string }[] = [
  { id: "recent", label: "Newest starred" },
  { id: "fit", label: "Fit score" },
  { id: "company", label: "Company A–Z" },
  { id: "deadline", label: "Deadline" },
];

const BAND_OPTIONS: { id: string; label: string }[] = [
  { id: "all", label: "All bands" },
  { id: "strong", label: "Strong fit" },
  { id: "good", label: "Good fit" },
  { id: "fair", label: "Fair fit" },
  { id: "weak", label: "Weak fit" },
  { id: "veto", label: "Vetoed" },
  { id: "unrated", label: "Unrated" },
];

const STATUS_OPTIONS: { id: string; label: string }[] = [
  { id: "all", label: "All stages" },
  ...TRACKER_STATUSES.map((s) => ({ id: s.id as string, label: s.label })),
];

/** Color-coded tracker-status pill that doubles as the per-item status dropdown. */
function StatusPill({ status, onChange }: { status: TrackerStatus; onChange: (s: TrackerStatus) => void }) {
  const meta = trackerStatusMeta(status);
  return (
    <Select value={status} onValueChange={(v) => onChange(v as TrackerStatus)}>
      <SelectTrigger
        aria-label="Application status (tracker vocabulary)"
        className={`h-auto w-auto gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${meta.pill} hover:bg-inherit`}
      >
        <span className="inline-flex items-center gap-1">
          <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
          {meta.label}
        </span>
      </SelectTrigger>
      <SelectContent>
        {TRACKER_STATUSES.map((s) => (
          <SelectItem key={s.id} value={s.id} className="text-xs">
            <span className="inline-flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${s.dot}`} />
              {s.label}
              {s.final ? (
                <span className="ml-auto pl-2 text-[9px] uppercase tracking-wide text-muted-foreground">final</span>
              ) : null}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Append-only transition log, one row per stage change (newest last). */
function StatusHistoryPopover({ item }: { item: ShortlistItem }) {
  const history: StatusTransition[] = item.statusHistory ?? [];
  if (history.length === 0) return null;
  const last = history[history.length - 1];
  const lastMeta = trackerStatusMeta(last.to);
  return (
    <Popover>
      <PopoverTrigger
        aria-label={`Stage history: ${history.length} change(s). Last: ${lastMeta.label}`}
        title="Stage history"
        className="inline-flex h-auto items-center gap-1 rounded-full border border-border/60 bg-muted/40 px-2 py-0.5 text-[10px] font-medium text-muted-foreground transition-colors hover:border-amber-500/40 hover:text-amber-700 dark:hover:text-amber-400"
      >
        <History className="h-3 w-3" />
        {history.length}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-3">
        <p className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          <History className="h-3 w-3" />
          Stage history
        </p>
        <ol className="space-y-1.5">
          {history.map((t, i) => {
            const toMeta = trackerStatusMeta(t.to);
            const fromMeta = t.from ? trackerStatusMeta(t.from) : null;
            const exact = new Date(t.at).toLocaleString(undefined, {
              year: "numeric",
              month: "short",
              day: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
            });
            return (
              <li key={i} className="flex items-center gap-1.5 text-[11px]">
                <span
                  title={exact}
                  className="w-7 shrink-0 cursor-default text-right font-mono text-[9px] text-muted-foreground/70 tabular-nums"
                >
                  {relativeTime(t.at)}
                </span>
                {fromMeta ? (
                  <>
                    <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${fromMeta.dot}`} title={fromMeta.label} />
                    <span className="text-muted-foreground">{fromMeta.label}</span>
                    <span className="text-muted-foreground/50">→</span>
                  </>
                ) : (
                  <span className="text-muted-foreground/50">set</span>
                )}
                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${toMeta.dot}`} title={toMeta.label} />
                <span className="font-medium">{toMeta.label}</span>
              </li>
            );
          })}
        </ol>
        <p className="mt-2 border-t border-border/60 pt-2 text-[9px] leading-relaxed text-muted-foreground/70">
          Exported to the CSV notes column as: <span className="font-mono">{formatStatusHistory(item)}</span>
        </p>
      </PopoverContent>
    </Popover>
  );
}

/** Compact fit badge for shortlist rows (same visual language as JobRow). */
function MiniFitBadge({ fit }: { fit: FitResult }) {
  if (fit.score == null) return null;
  const style = FIT_BAND_STYLES[fit.band];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ${style.className}`}
      title={`${style.label}: matched ${fit.matchedSkills.length > 0 ? fit.matchedSkills.join(", ") : "none of the profile skills"}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
      {fit.band === "veto" ? "veto" : fit.score}
    </span>
  );
}

export function ShortlistButton({
  open: controlledOpen,
  onOpenChange,
}: {
  /** Optional controlled open state (used by the keyboard-shortcut palette). */
  open?: boolean;
  onOpenChange?: (o: boolean) => void;
} = {}) {
  const { items, remove, clear, setStatus, setBulkStatus, hydrated } = useShortlist();
  const { profile } = useFitProfile();
  const { toast } = useToast();
  const [internalOpen, setInternalOpen] = useState(false);
  const [portalFilter, setPortalFilter] = useState("all");
  const [bandFilter, setBandFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState<SortMode>("recent");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkStage, setBulkStage] = useState<string>("");
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;

  const setOpen = (o: boolean) => {
    if (!isControlled) setInternalOpen(o);
    onOpenChange?.(o);
  };

  const csv = useMemo(
    () => buildTrackerCsv(items, (portalId) => BOARD_NAMES[portalId] ?? portalId),
    [items],
  );

  /** Distinct portals present in the shortlist (stable order of first appearance). */
  const portalsPresent = useMemo(() => {
    const seen: string[] = [];
    for (const it of items) {
      if (!seen.includes(it.portalId)) seen.push(it.portalId);
    }
    return seen;
  }, [items]);

  /** Fit triage per shortlisted item (heuristic, same engine as JobRow badges). */
  const fits = useMemo(() => {
    const m = new Map<string, FitResult>();
    for (const it of items) m.set(it.key, scoreJob(profile, it.job));
    return m;
  }, [items, profile]);

  const visible = useMemo(() => {
    let list = items;
    if (portalFilter !== "all") list = list.filter((it) => it.portalId === portalFilter);
    if (bandFilter !== "all") {
      list = list.filter((it) => (fits.get(it.key)?.band ?? "unrated") === bandFilter);
    }
    if (statusFilter !== "all") {
      list = list.filter((it) => (it.status ?? "drafted") === statusFilter);
    }
    const sorted = [...list];
    if (sortBy === "fit") {
      sorted.sort((a, b) => (fits.get(b.key)?.score ?? -1) - (fits.get(a.key)?.score ?? -1));
    } else if (sortBy === "company") {
      sorted.sort(
        (a, b) =>
          (a.job.company ?? "~").localeCompare(b.job.company ?? "~") ||
          a.job.title.localeCompare(b.job.title),
      );
    } else if (sortBy === "deadline") {
      sorted.sort((a, b) => (a.job.deadline ?? "9999-99-99").localeCompare(b.job.deadline ?? "9999-99-99"));
    }
    // "recent": keep insertion order — toggle() prepends newest first.
    return sorted;
  }, [items, portalFilter, bandFilter, statusFilter, sortBy, fits]);

  const filtersActive = portalFilter !== "all" || bandFilter !== "all" || statusFilter !== "all" || sortBy !== "recent";

  /** Prune selection to keys still visible (filters/sorts change the list). */
  const effectiveSelected = useMemo(
    () => new Set([...selected].filter((k) => visible.some((it) => it.key === k))),
    [selected, visible],
  );
  const allVisibleSelected = visible.length > 0 && visible.every((it) => effectiveSelected.has(it.key));

  const toggleSelectAll = () => {
    setSelected(allVisibleSelected ? new Set() : new Set(visible.map((it) => it.key)));
  };

  function applyBulkStage() {
    if (!bulkStage || effectiveSelected.size === 0) return;
    const target = bulkStage as TrackerStatus;
    const changed = items.filter((it) => effectiveSelected.has(it.key) && (it.status ?? "drafted") !== target).length;
    setBulkStatus([...effectiveSelected], target);
    setSelected(new Set());
    setBulkStage("");
    toast({
      title: `Stage set to ${trackerStatusMeta(target).label}`,
      description: `${changed} item(s) updated · stage history recorded per item.`,
    });
  }

  function downloadMarkdown() {
    const md = buildShortlistMarkdown(items, fits, (portalId) => BOARD_NAMES[portalId] ?? portalId);
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `shortlist-snapshot-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast({
      title: "Markdown snapshot exported",
      description: `${items.length} row(s) with pipeline, fit triage and per-item stage history as tables.`,
    });
  }

  function copyMarkdown() {
    const md = buildShortlistMarkdown(items, fits, (portalId) => BOARD_NAMES[portalId] ?? portalId);
    navigator.clipboard.writeText(md).then(
      () => toast({ title: "Markdown snapshot copied to clipboard" }),
      () => toast({ title: "Could not copy", variant: "destructive" }),
    );
  }

  function downloadCsv() {
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "job_search_tracker.csv";
    a.click();
    URL.revokeObjectURL(url);
    toast({
      title: "Tracker CSV exported",
      description: `${items.length} row(s) with the framework's standard 14-column header and live tracker statuses. Drop it into the repo root to let /rank, /apply and /outcome pick it up.`,
    });
  }

  function copyCsv() {
    navigator.clipboard.writeText(csv).then(
      () => toast({ title: "CSV copied to clipboard" }),
      () => toast({ title: "Could not copy", variant: "destructive" }),
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="relative">
          <Star className="mr-1.5 h-3.5 w-3.5 text-amber-500" />
          Shortlist
          {hydrated && items.length > 0 ? (
            <Badge className="ml-2 bg-amber-500 px-1.5 text-[10px] text-white hover:bg-amber-500">
              {items.length}
            </Badge>
          ) : null}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-amber-500" />
            Shortlist ({items.length})
          </DialogTitle>
          <DialogDescription>
            Starred postings, persisted in this browser. Export them in the framework&apos;s tracker format to
            continue with <code className="rounded bg-muted px-1 font-mono text-[11px]">/rank</code> and{" "}
            <code className="rounded bg-muted px-1 font-mono text-[11px]">/apply</code> in Claude Code.
          </DialogDescription>
        </DialogHeader>

        {items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border/70 px-4 py-10 text-center">
            <Star className="h-7 w-7 text-muted-foreground/40" />
            <p className="text-sm font-medium">Nothing shortlisted yet</p>
            <p className="max-w-xs text-xs text-muted-foreground">
              Run a job search and hit the star on any posting to build your shortlist here.
            </p>
          </div>
        ) : (
          <>
            {/* Sort & filter controls */}
            {items.length > 1 ? (
              <div className="rounded-lg border border-border/60 bg-muted/20 px-2.5 py-2">
                <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <SlidersHorizontal className="h-3 w-3" />
                  Sort &amp; filter
                  {filtersActive ? (
                    <button
                      type="button"
                      onClick={() => {
                        setPortalFilter("all");
                        setBandFilter("all");
                        setStatusFilter("all");
                        setSortBy("recent");
                      }}
                      className="ml-auto text-[10px] font-medium normal-case tracking-normal text-muted-foreground/70 underline-offset-2 transition-colors hover:text-rose-500 hover:underline"
                    >
                      Reset
                    </button>
                  ) : null}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Select value={portalFilter} onValueChange={setPortalFilter}>
                    <SelectTrigger aria-label="Filter by portal" className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All portals</SelectItem>
                      {portalsPresent.map((p) => (
                        <SelectItem key={p} value={p}>
                          {BOARD_NAMES[p] ?? p}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={bandFilter} onValueChange={setBandFilter}>
                    <SelectTrigger aria-label="Filter by fit band" className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {BAND_OPTIONS.map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger aria-label="Filter by application stage" className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortMode)}>
                    <SelectTrigger aria-label="Sort shortlist" className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SORT_OPTIONS.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {filtersActive ? (
                  <p className="mt-1.5 text-[10px] text-muted-foreground">
                    Showing {visible.length} of {items.length} — exports always include all {items.length}.
                  </p>
                ) : null}
              </div>
            ) : null}

            {/* Select-all + bulk stage toolbar */}
            {items.length > 1 ? (
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex cursor-pointer items-center gap-2 text-[11px] text-muted-foreground">
                  <Checkbox
                    checked={allVisibleSelected ? true : effectiveSelected.size > 0 ? "indeterminate" : false}
                    onCheckedChange={toggleSelectAll}
                    aria-label={allVisibleSelected ? "Deselect all visible" : "Select all visible"}
                    className="data-[state=indeterminate]:bg-amber-500 data-[state=indeterminate]:border-amber-500"
                  />
                  <CheckSquare className="h-3 w-3" />
                  Select
                </label>
                {effectiveSelected.size > 0 ? (
                  <div className="flex flex-1 flex-wrap items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/[0.06] px-2 py-1">
                    <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                      {effectiveSelected.size} selected
                    </span>
                    <Select value={bulkStage} onValueChange={setBulkStage}>
                      <SelectTrigger aria-label="Set stage for selected" className="h-7 w-auto gap-1 rounded-full border-emerald-500/40 bg-background px-2.5 text-[11px]">
                        <span className={bulkStage ? "" : "text-muted-foreground"}>
                          {bulkStage ? trackerStatusMeta(bulkStage as TrackerStatus).label : "Set stage…"}
                        </span>
                      </SelectTrigger>
                      <SelectContent>
                        {TRACKER_STATUSES.map((s) => (
                          <SelectItem key={s.id} value={s.id} className="text-xs">
                            <span className="inline-flex items-center gap-2">
                              <span className={`h-2 w-2 rounded-full ${s.dot}`} />
                              {s.label}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      onClick={applyBulkStage}
                      disabled={!bulkStage}
                      className="h-7 rounded-full bg-emerald-600 px-3 text-[11px] text-white hover:bg-emerald-700"
                    >
                      <Route className="mr-1 h-3 w-3" />
                      Apply
                    </Button>
                    <button
                      type="button"
                      onClick={() => setSelected(new Set())}
                      className="ml-auto text-[10px] text-muted-foreground/70 underline-offset-2 hover:text-rose-500 hover:underline"
                    >
                      Clear
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}

            <ScrollArea className="-mr-3 max-h-80 pr-3">
              <div className="space-y-2">
                {visible.map((it) => {
                  const due = it.job.deadline;
                  const dueSoon =
                    due != null &&
                    (new Date(`${due}T00:00:00Z`).getTime() - Date.now()) / 86_400_000 <= 14;
                  return (
                    <div
                      key={it.key}
                      className={`group flex items-start gap-2.5 rounded-lg border px-2.5 py-2.5 transition-colors sm:gap-3 sm:px-3 ${
                        effectiveSelected.has(it.key)
                          ? "border-emerald-500/40 bg-emerald-500/[0.05]"
                          : "border-border/70 hover:border-amber-500/30 hover:bg-amber-500/[0.03]"
                      }`}
                    >
                      {items.length > 1 ? (
                        <Checkbox
                          checked={effectiveSelected.has(it.key)}
                          onCheckedChange={(v) =>
                            setSelected((prev) => {
                              const next = new Set(prev);
                              if (v) next.add(it.key);
                              else next.delete(it.key);
                              return next;
                            })
                          }
                          aria-label={`Select ${it.job.title}`}
                          className="mt-0.5 shrink-0 data-[state=checked]:border-emerald-500 data-[state=checked]:bg-emerald-500"
                        />
                      ) : null}
                      <div className="min-w-0 flex-1">
                        {it.job.url ? (
                          <a
                            href={it.job.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="line-clamp-2 text-sm font-medium underline-offset-2 hover:underline"
                          >
                            {it.job.title}
                            <ExternalLink className="ml-1 inline h-3 w-3 opacity-50" />
                          </a>
                        ) : (
                          <span className="line-clamp-2 text-sm font-medium">{it.job.title}</span>
                        )}
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                          <Badge variant="outline" className="px-1.5 text-[10px]">
                            {it.portalName}
                          </Badge>
                          <MiniFitBadge fit={fits.get(it.key) ?? { score: null, band: "unrated", matchedSkills: [], matchedLocation: null, vetoedBy: null }} />
                          {it.job.company ? (
                            <span className="inline-flex items-center gap-1">
                              <Building2 className="h-3 w-3" /> {it.job.company}
                            </span>
                          ) : null}
                          {it.job.location ? (
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="h-3 w-3" /> {it.job.location}
                            </span>
                          ) : null}
                          {due ? (
                            <span
                              className={`inline-flex items-center gap-1 ${dueSoon ? "font-medium text-amber-600 dark:text-amber-400" : ""}`}
                            >
                              <CalendarDays className="h-3 w-3" /> due {due}
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-1.5 flex flex-wrap items-center gap-2">
                          <StatusPill status={it.status ?? "drafted"} onChange={(s) => setStatus(it.key, s)} />
                          <StatusHistoryPopover item={it} />
                          <span className="text-[9px] uppercase tracking-wide text-muted-foreground/60">
                            tracker stage — exported to the CSV status column
                          </span>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => remove(it.key)}
                        className="h-7 shrink-0 px-1.5 text-muted-foreground hover:text-rose-500"
                        aria-label={`Remove ${it.job.title} from shortlist`}
                      >
                        <StarOff className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  );
                })}
                {visible.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-border/70 px-4 py-6 text-center text-xs text-muted-foreground">
                    No items match the current sort &amp; filter — reset them to see the full shortlist.
                  </p>
                ) : null}
              </div>
            </ScrollArea>

            <ShortlistAnalytics />

            <Separator />

            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" onClick={downloadCsv} className="bg-emerald-600 text-white hover:bg-emerald-700">
                <Download className="mr-1.5 h-3.5 w-3.5" />
                Export tracker CSV
              </Button>
              <Button size="sm" variant="outline" onClick={copyCsv}>
                <ClipboardCopy className="mr-1.5 h-3.5 w-3.5" />
                Copy CSV
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={downloadMarkdown}
                className="border-sky-500/40 text-sky-700 hover:bg-sky-500/10 dark:text-sky-400"
                title="Analytics snapshot: sources, pipeline, fit triage + full table with stage history"
              >
                <FileText className="mr-1.5 h-3.5 w-3.5" />
                Export .md
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={copyMarkdown}
                className="text-muted-foreground hover:text-sky-600 dark:hover:text-sky-400"
                title="Copy the markdown snapshot"
              >
                <ClipboardCopy className="mr-1.5 h-3.5 w-3.5" />
                Copy md
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={clear}
                className="ml-auto text-muted-foreground hover:text-rose-500"
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                Clear all
              </Button>
            </div>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              Columns: <span className="font-mono">date, company, sector, role, role_type, channel, status,
              contact_person, fit_rating, notes, cv_file, cover_letter_file, source, deadline</span> — identical to
              /apply and /outcome.
            </p>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
