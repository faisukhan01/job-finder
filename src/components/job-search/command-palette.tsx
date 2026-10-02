"use client";

import { useEffect, useMemo, useRef } from "react";
import { useCommandState } from "cmdk";
import {
  CommandDialog,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { useShortlist } from "@/lib/job-search/shortlist";
import { useSearchHistory } from "@/lib/job-search/search-history";
import { relativeTime } from "@/lib/job-search/relative-time";
import {
  Briefcase,
  Compass,
  ExternalLink,
  FileCode2,
  FlaskConical,
  GraduationCap,
  Keyboard,
  Moon,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Star,
  Banknote,
  Clock,
  Workflow,
  Map as MapIcon,
  GitBranch,
  CornerDownLeft,
} from "lucide-react";

/** Scroll smoothly to a page section and pulse its header. */
function scrollToPanel(id: string) {
  const el = document.getElementById(id);
  if (el instanceof HTMLElement) {
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

/**
 * Live fallback inside the palette: while typing, show a hint that Enter runs
 * the raw text as a real board search (replayed on the last-used portal).
 *
 * Deliberately DISPLAY-ONLY: cmdk's item/group machinery swallows synthetic
 * events for elements it doesn't own (and late-mounted items never get wired
 * into the selection path), so the actual execution lives in a document-level
 * capture keydown listener (see CommandPalette) that fires when Enter is
 * pressed with no command selected. useCommandState drives the hint text.
 */
function BareQuerySearchHint({
  lastPortal,
  lastLocation,
}: {
  lastPortal: string;
  lastLocation: string;
}) {
  const search = useCommandState((state) => state.search);
  const q = search.trim();
  const ready = q.length >= 2;
  if (!ready) return null;
  return (
    <div
      className="flex items-center gap-2 border-t border-border/60 px-3 py-2 text-[11px] text-muted-foreground"
      data-testid="palette-fallback-hint"
    >
      <Search className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
      <span className="min-w-0 flex-1 truncate">
        <kbd className="mr-1 rounded border border-border bg-muted px-1 font-mono text-[10px] font-semibold">↵</kbd>
        Run <span className="font-semibold text-foreground">&ldquo;{q}&rdquo;</span> on{" "}
        {lastPortal === "all" ? "all boards" : lastPortal}
        {lastLocation ? <span> · {lastLocation}</span> : null}
      </span>
      <span className="shrink-0 text-[9px] uppercase tracking-wide text-muted-foreground/60">live CLI</span>
    </div>
  );
}

export interface CommandPaletteActions {
  onFocusSearch: () => void;
  onOpenShortlist: () => void;
  onOpenFitProfile: () => void;
  onOpenShortcuts: () => void;
  onToggleTheme: () => void;
  onRefreshStatus: () => void;
}

/**
 * Spotlight-style command palette (⌘K / Ctrl+K): actions, recent searches,
 * salary companies, panel navigation and the live shortlist in one list.
 */
export function CommandPalette({
  open,
  onOpenChange,
  actions,
  salaryCompanies = [],
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  actions: CommandPaletteActions;
  /** Companies available in the repo's salary demo data (fuzzy-matched). */
  salaryCompanies?: string[];
}) {
  const { items } = useShortlist();
  const { entries: history, reload: reloadHistory } = useSearchHistory();

  // Other components push history entries into localStorage directly — re-read
  // on every open so the "Recent searches" group is always current.
  useEffect(() => {
    if (open) reloadHistory();
  }, [open, reloadHistory]);

  const shortlisted = useMemo(() => items.slice(0, 8), [items]);
  const salaryHints = useMemo(() => salaryCompanies.slice(0, 6), [salaryCompanies]);

  const run = (fn: () => void) => () => {
    onOpenChange(false);
    // Let the dialog unmount before scrolling/dialog opens, avoids focus fights.
    window.setTimeout(fn, 60);
  };

  /** Replay a recent search: fills + runs the live search console. */
  const runRecentSearch = (h: { portal: string; query: string; location: string }) =>
    run(() => {
      window.dispatchEvent(
        new CustomEvent("aijs:search-request", {
          detail: { portal: h.portal, query: h.query, location: h.location, ts: Date.now() },
        }),
      );
      scrollToPanel("panel-search");
    });

  /** Jump to the salary panel with a pre-filled company lookup. */
  const runSalaryLookup = (company: string) =>
    run(() => {
      window.dispatchEvent(new CustomEvent("aijs:salary-company", { detail: { company } }));
      scrollToPanel("panel-salary");
    });

  /**
   * Run a raw query typed into the palette on the last-used board
   * (or all boards) — the palette's answer to “no command matches”.
   * Executes immediately (closes the palette, then fires the search event).
   */
  const runBareQuery = (query: string, portal: string, loc: string) => {
    onOpenChange(false);
    // Let the dialog unmount before scrolling — avoids focus fights.
    window.setTimeout(() => {
      window.dispatchEvent(
        new CustomEvent("aijs:search-request", {
          detail: { portal, query, location: loc, ts: Date.now() },
        }),
      );
      scrollToPanel("panel-search");
    }, 60);
  };

  const lastSearch = history[0];

  // Enter with no command selected → run the bare query as a live search.
  // Capture-phase document listener (trusted keyboard events reach it even
  // though cmdk's in-tree synthetic wiring is unreliable for dynamic nodes);
  // it stays passive when a real command item is highlighted.
  const bareQueryRef = useRef({ run: runBareQuery, lastPortal: lastSearch?.portal ?? "all", lastLocation: lastSearch?.location ?? "" });
  useEffect(() => {
    bareQueryRef.current = { run: runBareQuery, lastPortal: lastSearch?.portal ?? "all", lastLocation: lastSearch?.location ?? "" };
  });
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      (window as unknown as { __dbg?: string[] }).__dbg = (window as unknown as { __dbg?: string[] }).__dbg ?? [];
      (window as unknown as { __dbg: string[] }).__dbg.push("listener-fired");
      if (e.key !== "Enter" || e.metaKey || e.ctrlKey || e.altKey) return;
      const { run: exec, lastPortal, lastLocation } = bareQueryRef.current;
      const input = document.querySelector("[cmdk-input]") as HTMLInputElement | null;
      const q = input?.value.trim() ?? "";
      if (q.length < 2) return;
      // A highlighted AND visible command item means normal cmdk selection
      // handles Enter. (cmdk keeps aria-selected on hidden leftovers after a
      // search change — verify the row is actually rendered.)
      const highlighted = document.querySelector('[cmdk-item][aria-selected="true"]') as HTMLElement | null;
      if (highlighted && highlighted.offsetParent !== null) return;
      e.preventDefault();
      e.stopPropagation();
      exec(q, lastPortal, lastLocation);
    }
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [open]);

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Command palette"
      description="Search actions, panels and shortlisted jobs"
      className="sm:max-w-xl"
    >
      <CommandInput placeholder="Type a command or search your shortlist…" className="pr-8" />
      <CommandList className="max-h-[360px]">

        <CommandGroup heading="Search & jobs">
          <CommandItem onSelect={run(actions.onFocusSearch)}>
            <Search className="text-emerald-600 dark:text-emerald-400" />
            Focus keyword search
            <CommandShortcut className="flex gap-1">
              <kbd className="rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-semibold">/</kbd>
            </CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={run(actions.onOpenShortlist)}>
            <Star className="text-amber-500" />
            Open shortlist
            {items.length > 0 ? (
              <Badge className="ml-1 border-transparent bg-amber-500 px-1.5 text-[10px] text-white hover:bg-amber-500">
                {items.length}
              </Badge>
            ) : null}
            <CommandShortcut className="flex gap-1">
              <kbd className="rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-semibold">S</kbd>
            </CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={run(actions.onOpenFitProfile)}>
            <SlidersHorizontal className="text-violet-500" />
            Edit fit profile
            <CommandShortcut className="flex gap-1">
              <kbd className="rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-semibold">F</kbd>
            </CommandShortcut>
          </CommandItem>
        </CommandGroup>

        {history.length > 0 ? (
          <>
            <CommandSeparator />
            <CommandGroup heading="Recent searches">
              {history.slice(0, 6).map((h, i) => (
                <CommandItem
                  key={`${h.portal}-${h.query}-${h.location}-${i}`}
                  value={`search ${h.query} ${h.portal} ${h.location}`}
                  onSelect={runRecentSearch(h)}
                >
                  <Clock className="text-teal-600 dark:text-teal-400" />
                  <span className="min-w-0 flex-1 truncate">
                    {h.query || <span className="italic text-muted-foreground">(no keywords)</span>}
                    {h.location ? <span className="text-muted-foreground"> · {h.location}</span> : null}
                  </span>
                  <Badge variant="outline" className="shrink-0 px-1.5 text-[9px]">
                    {h.portal === "all" ? "all boards" : h.portal}
                  </Badge>
                  <span className="w-7 shrink-0 text-right font-mono text-[9px] text-muted-foreground/70 tabular-nums">
                    {relativeTime(h.at)}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        ) : null}

        {salaryHints.length > 0 ? (
          <>
            <CommandSeparator />
            <CommandGroup heading={`Salary lookup — demo data (${salaryCompanies.length} companies)`}>
              {salaryHints.map((c) => (
                <CommandItem
                  key={c}
                  value={`salary ${c}`}
                  onSelect={runSalaryLookup(c)}
                >
                  <Banknote className="text-amber-600 dark:text-amber-400" />
                  <span className="min-w-0 flex-1 truncate">{c}</span>
                  <span className="shrink-0 text-[9px] uppercase tracking-wide text-muted-foreground/60">look up</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        ) : null}

        <CommandGroup heading="Go to panel">
          <CommandItem onSelect={run(() => scrollToPanel("panel-search"))}>
            <Briefcase className="text-emerald-600 dark:text-emerald-400" />
            Live job search
          </CommandItem>
          <CommandItem onSelect={run(() => scrollToPanel("panel-discover"))}>
            <Compass className="text-amber-600 dark:text-amber-400" />
            Discover taxonomies
          </CommandItem>
          <CommandItem onSelect={run(() => scrollToPanel("panel-testbench"))}>
            <FlaskConical className="text-teal-600 dark:text-teal-400" />
            Test bench & repo checks
          </CommandItem>
          <CommandItem onSelect={run(() => scrollToPanel("panel-latex"))}>
            <FileCode2 className="text-cyan-600 dark:text-cyan-400" />
            LaTeX CV &amp; cover letters
          </CommandItem>
          <CommandItem onSelect={run(() => scrollToPanel("panel-salary"))}>
            <Banknote className="text-amber-600 dark:text-amber-400" />
            Salary benchmark
          </CommandItem>
          <CommandItem onSelect={run(() => scrollToPanel("panel-workflow"))}>
            <Workflow className="text-emerald-600 dark:text-emerald-400" />
            Workflow pipeline
          </CommandItem>
          <CommandItem onSelect={run(() => scrollToPanel("panel-interview"))}>
            <GraduationCap className="text-rose-500" />
            Interview prep
          </CommandItem>
          <CommandItem onSelect={run(() => scrollToPanel("panel-repomap"))}>
            <MapIcon className="text-sky-600 dark:text-sky-400" />
            Repo map
          </CommandItem>
          <CommandItem onSelect={run(() => scrollToPanel("panel-updates"))}>
            <GitBranch className="text-amber-600 dark:text-amber-400" />
            Framework updates
          </CommandItem>
        </CommandGroup>

        {shortlisted.length > 0 ? (
          <>
            <CommandSeparator />
            <CommandGroup heading={`Shortlisted — ${items.length} saved`}>
              {shortlisted.map((it) => (
                <CommandItem
                  key={it.key}
                  value={`job ${it.job.title} ${it.job.company ?? ""} ${it.portalName}`}
                  onSelect={run(() => {
                    if (it.job.url) window.open(it.job.url, "_blank", "noopener,noreferrer");
                  })}
                >
                  <Star className="fill-amber-400 text-amber-500" />
                  <span className="min-w-0 flex-1 truncate">
                    {it.job.title}
                    {it.job.company ? <span className="text-muted-foreground"> · {it.job.company}</span> : null}
                  </span>
                  <Badge variant="outline" className="shrink-0 px-1.5 text-[9px]">
                    {it.portalName}
                  </Badge>
                  <ExternalLink className="shrink-0 opacity-40" />
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        ) : null}

        <CommandSeparator />
        <CommandGroup heading="View & system">
          <CommandItem onSelect={run(actions.onToggleTheme)}>
            <Moon />
            Toggle light / dark theme
            <CommandShortcut className="flex gap-1">
              <kbd className="rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-semibold">D</kbd>
            </CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={run(actions.onRefreshStatus)}>
            <RefreshCw />
            Refresh environment status
          </CommandItem>
          <CommandItem onSelect={run(actions.onOpenShortcuts)}>
            <Keyboard />
            Keyboard shortcuts
            <CommandShortcut className="flex gap-1">
              <kbd className="rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-semibold">?</kbd>
            </CommandShortcut>
          </CommandItem>
        </CommandGroup>

        <div className="flex items-center gap-1.5 border-t border-border/60 px-3 py-2 text-[10px] text-muted-foreground">
          <CornerDownLeft className="h-3 w-3" />
          select
          <span className="mx-1">·</span>
          <kbd className="rounded border border-border bg-muted px-1 font-mono">↑↓</kbd>
          navigate
          <span className="mx-1">·</span>
          <kbd className="rounded border border-border bg-muted px-1 font-mono">esc</kbd>
          close
        </div>
      </CommandList>

      {/* Live fallback: Enter with nothing selected runs the raw query. */}
      <BareQuerySearchHint lastPortal={lastSearch?.portal ?? "all"} lastLocation={lastSearch?.location ?? ""} />
    </CommandDialog>
  );
}
