"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { StatusStrip } from "@/components/job-search/status-strip";
import { SearchConsole } from "@/components/job-search/search-console";
import { TestBench } from "@/components/job-search/test-bench";
import { LatexPanel } from "@/components/job-search/latex-panel";
import { SalaryPanel } from "@/components/job-search/salary-panel";
import { WorkflowPipeline } from "@/components/job-search/workflow-pipeline";
import { RepoMap } from "@/components/job-search/repo-map";
import { UpdatesCard } from "@/components/job-search/updates-card";
import { DiscoverPanel } from "@/components/job-search/discover-panel";
import { InterviewPrepPanel } from "@/components/job-search/interview-prep-panel";
import { ShortlistButton } from "@/components/job-search/shortlist-button";
import { FitProfileDialog } from "@/components/job-search/fit-profile-dialog";
import { ShortcutHelp } from "@/components/job-search/shortcut-help";
import { CommandPalette } from "@/components/job-search/command-palette";
import { ShortlistProvider } from "@/lib/job-search/shortlist";
import { useHotkeys } from "@/hooks/use-hotkeys";
import { useTheme } from "next-themes";
import { useToast } from "@/hooks/use-toast";
import {
  Briefcase,
  Github,
  ExternalLink,
  RefreshCw,
  HeartHandshake,
  Sun,
  Moon,
  SlidersHorizontal,
  Keyboard,
  Command as CommandIcon,
} from "lucide-react";
import type { EnvStatus, PortalMeta } from "@/lib/job-search/shared-types";

const GITHUB_URL = "https://github.com/faisukhan01/job-finder";

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  // resolvedTheme is undefined during SSR → keep the label/theme-dependent
  // attrs stable across server & first client render to avoid hydration mismatch.
  const toggle = () => setTheme(resolvedTheme === "dark" ? "light" : "dark");
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={toggle}
      aria-label="Toggle dark mode"
      title="Toggle dark mode"
    >
      <Sun className="hidden h-3.5 w-3.5 dark:block" />
      <Moon className="h-3.5 w-3.5 dark:hidden" />
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}

export default function Home() {
  const { toast } = useToast();
  const { resolvedTheme, setTheme } = useTheme();
  const [status, setStatus] = useState<EnvStatus | null>(null);
  const [portals, setPortals] = useState<PortalMeta[]>([]);
  const [salaryCompanies, setSalaryCompanies] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fitOpen, setFitOpen] = useState(false);
  const [shortlistOpen, setShortlistOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  const loadStatus = useCallback(async (force = false) => {
    if (force) setRefreshing(true);
    try {
      const res = await fetch(`/api/status${force ? "?force=1" : ""}`);
      const data = (await res.json()) as EnvStatus;
      setStatus(data);
    } catch {
      toast({ title: "Could not load environment status", variant: "destructive" });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [toast]);

  useEffect(() => {
    loadStatus(false);
    fetch("/api/portals")
      .then((r) => r.json())
      .then((d) => setPortals(d.portals ?? []))
      .catch(() => setPortals([]));
    fetch("/api/salary")
      .then((r) => r.json())
      .then((d) => setSalaryCompanies((d.companies ?? []).map((c: { company: string }) => c.company)))
      .catch(() => setSalaryCompanies([]));
  }, [loadStatus]);

  const focusSearch = useCallback(() => {
    const el = document.getElementById("query");
    if (el instanceof HTMLElement) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.focus({ preventScroll: true });
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  }, [resolvedTheme, setTheme]);

  // Global single-key shortcuts (disabled while typing in fields) + ⌘K palette.
  useHotkeys([
    { key: "/", label: "Focus search", handler: focusSearch },
    { key: "s", label: "Open shortlist", handler: () => setShortlistOpen((v) => !v) },
    { key: "f", label: "Edit fit profile", handler: () => setFitOpen((v) => !v) },
    {
      key: "d",
      label: "Toggle dark mode",
      handler: toggleTheme,
    },
    { key: "?", label: "Shortcut help", handler: () => setShortcutsOpen((v) => !v) },
    { key: "k", label: "Command palette", meta: true, handler: () => setPaletteOpen((v) => !v) },
  ]);

  return (
    <ShortlistProvider>
      <div className="relative flex min-h-screen flex-col bg-background">
        {/* Hero backdrop */}
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-72 overflow-hidden">
          <div className="absolute -top-32 left-1/2 h-96 w-[42rem] -translate-x-1/2 rounded-full bg-emerald-500/10 blur-3xl dark:bg-emerald-400/10" />
          <div className="absolute -top-16 left-[12%] h-52 w-52 rounded-full bg-amber-500/10 blur-3xl" />
          <div className="absolute right-[10%] top-6 h-40 w-40 rounded-full bg-rose-500/5 blur-3xl" />
        </div>

        <main className="relative mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
          {/* Header */}
          <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-600/10 text-emerald-600 ring-1 ring-emerald-600/20 dark:text-emerald-400">
                <Briefcase className="h-6 w-6" />
              </span>
              <div>
                <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Job Finder</h1>
                <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                  Live job boards with location-aware routing — type any city + country (e.g.
                  Lahore, Pakistan) and results stay scoped to it. Rank by fit, star postings and
                  export a tracker CSV; the full <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">/setup → /scrape → /apply → /interview</code> pipeline lives in the repo.
                </p>
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPaletteOpen(true)}
                aria-label="Open command palette"
                title="Command palette (⌘K)"
                className="gap-1.5 pl-2 pr-2 sm:pr-2.5"
              >
                <CommandIcon className="h-3.5 w-3.5 text-muted-foreground" />
                <kbd className="hidden rounded border border-border bg-muted px-1 font-mono text-[10px] font-semibold sm:inline">⌘K</kbd>
              </Button>
              <ShortlistButton open={shortlistOpen} onOpenChange={setShortlistOpen} />
              <Button variant="outline" size="sm" onClick={() => setFitOpen(true)} title="Edit fit profile (F)">
                <SlidersHorizontal className="mr-1.5 h-3.5 w-3.5" />
                <span className="hidden sm:inline">Fit profile</span>
              </Button>
              <ThemeToggle />
              <Button variant="outline" size="sm" onClick={() => loadStatus(true)} disabled={refreshing}>
                <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
                <span className="hidden sm:inline">Refresh status</span>
                <span className="sm:hidden">Refresh</span>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
                  <Github className="mr-1.5 h-3.5 w-3.5" />
                  <span className="hidden sm:inline">GitHub</span>
                  <ExternalLink className="ml-1.5 h-3 w-3 opacity-60" />
                </a>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShortcutsOpen(true)}
                aria-label="Keyboard shortcuts"
                title="Keyboard shortcuts (?)"
                className="hidden text-muted-foreground md:inline-flex"
              >
                <Keyboard className="h-3.5 w-3.5" />
              </Button>
            </div>
          </header>

          {/* Meta badges */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {status?.repo.frameworkVersion ? (
              <Badge variant="secondary">framework v{status.repo.frameworkVersion}</Badge>
            ) : null}
            {status?.repo.branch ? (
              <Badge variant="outline" className="font-mono text-[11px]">
                {status.repo.branch}
                {status.repo.headCommit ? `@${status.repo.headCommit.split("—")[0]?.trim()}` : ""}
              </Badge>
            ) : null}
            {status?.repo.remoteUrl ? (
              <span className="font-mono text-[11px] text-muted-foreground">{status.repo.remoteUrl}</span>
            ) : null}
          </div>

          <Separator className="my-6" />

          {/* Environment status */}
          <section aria-labelledby="env-status">
            <div className="mb-3 flex items-center justify-between">
              <h2 id="env-status" className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                <span className="h-1 w-6 rounded-full bg-emerald-500" />
                Environment setup
              </h2>
              {status ? (
                <span className="text-[11px] text-muted-foreground">
                  checked {new Date(status.checkedAt).toLocaleTimeString()}
                </span>
              ) : null}
            </div>
            <StatusStrip status={status} loading={loading} />
          </section>

          <div className="mt-8 space-y-8">
            {/* Live search */}
            <section id="panel-search" aria-labelledby="live-search" className="scroll-mt-6">
              <SearchConsole portals={portals} />
            </section>

            {/* Discover: taxonomy browsing */}
            <section id="panel-discover" aria-label="Discover categories and occupations" className="scroll-mt-6">
              <DiscoverPanel />
            </section>

            {/* Verification + LaTeX */}
            <section id="panel-testbench" aria-label="Tool panels" className="grid grid-cols-1 gap-8 scroll-mt-6 xl:grid-cols-3">
              <div className="xl:col-span-2">
                <TestBench />
              </div>
              <div id="panel-latex" className="scroll-mt-6 xl:col-span-1">
                <LatexPanel />
              </div>
            </section>

            {/* Salary + workflow */}
            <section id="panel-salary" aria-label="Salary and workflow" className="grid grid-cols-1 gap-8 scroll-mt-6 xl:grid-cols-3">
              <div className="xl:col-span-1">
                <SalaryPanel hintCompanies={salaryCompanies} />
              </div>
              <div id="panel-workflow" className="scroll-mt-6 xl:col-span-2">
                <WorkflowPipeline />
              </div>
            </section>

            {/* Interview prep methodology */}
            <section id="panel-interview" aria-label="Interview prep" className="scroll-mt-6">
              <InterviewPrepPanel />
            </section>

            {/* Repo map + framework updates */}
            <section id="panel-repomap" aria-label="Repo map and framework updates" className="grid grid-cols-1 gap-8 scroll-mt-6 xl:grid-cols-3">
              <div className="xl:col-span-2">
                <RepoMap />
              </div>
              <div id="panel-updates" className="scroll-mt-6 xl:col-span-1">
                <UpdatesCard />
              </div>
            </section>
          </div>
        </main>

        <FitProfileDialog open={fitOpen} onOpenChange={setFitOpen} />
        <ShortcutHelp open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
        <CommandPalette
          open={paletteOpen}
          onOpenChange={setPaletteOpen}
          salaryCompanies={salaryCompanies}
          actions={{
            onFocusSearch: focusSearch,
            onOpenShortlist: () => setShortlistOpen(true),
            onOpenFitProfile: () => setFitOpen(true),
            onOpenShortcuts: () => setShortcutsOpen(true),
            onToggleTheme: toggleTheme,
            onRefreshStatus: () => loadStatus(true),
          }}
        />

        {/* Sticky footer */}
        <footer className="mt-auto border-t border-border/70 bg-muted/30">
          <div
            className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-2 px-4 py-4 text-xs text-muted-foreground sm:flex-row sm:px-6 lg:px-8"
            style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
          >
            <span className="flex items-center gap-1.5">
              <HeartHandshake className="h-3.5 w-3.5" />
              Independent open-source project — not affiliated with Anthropic or Claude Code.
            </span>
            <span className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setPaletteOpen(true)}
                className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-1.5 py-0.5 transition-colors hover:text-foreground"
                aria-label="Open command palette"
              >
                press
                <kbd className="rounded border border-border bg-muted px-1.5 py-px font-mono text-[10px] font-semibold">⌘K</kbd>
                for commands
              </button>
              <button
                type="button"
                onClick={() => setShortcutsOpen(true)}
                className="hidden items-center gap-1.5 whitespace-nowrap rounded-md px-1.5 py-0.5 transition-colors hover:text-foreground sm:inline-flex"
                aria-label="Show keyboard shortcuts"
              >
                press
                <kbd className="rounded border border-border bg-muted px-1.5 py-px font-mono text-[10px] font-semibold">?</kbd>
                for shortcuts
              </button>
              <span className="font-mono">
                job-finder · powered by ai-job-search v{status?.repo.frameworkVersion ?? "?"} CLI toolkit
              </span>
            </span>
          </div>
        </footer>
      </div>
    </ShortlistProvider>
  );
}
