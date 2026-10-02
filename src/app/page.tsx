"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  Sun,
  Moon,
  SlidersHorizontal,
  Keyboard,
  Command as CommandIcon,
  MapPin,
  ShieldCheck,
  Sparkles,
  Star,
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
      variant="ghost"
      size="icon"
      onClick={toggle}
      aria-label="Toggle dark mode"
      title="Toggle dark mode"
      className="h-9 w-9 rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
    >
      <Sun className="hidden h-4 w-4 dark:block" />
      <Moon className="h-4 w-4 dark:hidden" />
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
        {/* ── Aurora backdrop (fixed, behind everything) ── */}
        <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
          <div className="aurora-blob absolute -top-40 left-[8%] h-[26rem] w-[26rem] bg-emerald-500/[0.13] dark:bg-emerald-400/[0.09]" />
          <div className="aurora-blob aurora-blob-2 absolute -top-24 right-[4%] h-[20rem] w-[20rem] bg-teal-500/[0.10] dark:bg-teal-400/[0.07]" />
          <div className="aurora-blob aurora-blob-3 absolute left-[38%] top-[34rem] h-[18rem] w-[22rem] bg-lime-400/[0.07] dark:bg-lime-300/[0.05]" />
        </div>

        {/* ── Sticky glass navigation ── */}
        <header className="sticky top-0 z-50 border-b border-border/60 glass-strong">
          <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
            <a href="#" className="group flex items-center gap-3" aria-label="Job Finder home">
              <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-glow transition-transform duration-300 group-hover:scale-105 group-hover:rotate-3">
                <Briefcase className="h-5 w-5" />
              </span>
              <span className="flex flex-col leading-none">
                <span className="text-[15px] font-bold tracking-tight">Job Finder</span>
                <span className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  Control Center
                </span>
              </span>
            </a>

            <nav aria-label="Primary" className="hidden items-center gap-1 lg:flex">
              <a href="#panel-search" className="link-underline rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">Search</a>
              <a href="#panel-discover" className="link-underline rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">Discover</a>
              <a href="#panel-salary" className="link-underline rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">Salary</a>
              <a href="#panel-workflow" className="link-underline rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">Workflow</a>
            </nav>

            <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPaletteOpen(true)}
                aria-label="Open command palette"
                title="Command palette (⌘K)"
                className="h-9 gap-1.5 rounded-full px-2.5 text-muted-foreground hover:text-foreground"
              >
                <CommandIcon className="h-4 w-4" />
                <kbd className="hidden rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-semibold sm:inline">⌘K</kbd>
              </Button>
              <span className="hidden sm:block"><ShortlistButton open={shortlistOpen} onOpenChange={setShortlistOpen} /></span>
              <Button variant="ghost" size="sm" onClick={() => setFitOpen(true)} title="Edit fit profile (F)" className="hidden h-9 rounded-full text-muted-foreground hover:text-foreground md:inline-flex">
                <SlidersHorizontal className="mr-1.5 h-4 w-4" />
                <span className="hidden lg:inline">Fit profile</span>
              </Button>
              <ThemeToggle />
              <Button variant="ghost" size="icon" onClick={() => loadStatus(true)} disabled={refreshing} aria-label="Refresh status" title="Refresh status" className="hidden h-9 w-9 rounded-full text-muted-foreground hover:text-foreground sm:inline-flex">
                <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              </Button>
              <Button size="sm" asChild className="h-9 rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 shadow-glow transition-transform hover:scale-[1.03] active:scale-95">
                <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
                  <Github className="mr-1.5 h-4 w-4" />
                  <span className="hidden sm:inline">GitHub</span>
                  <ExternalLink className="ml-1 h-3 w-3 opacity-70" />
                </a>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShortcutsOpen(true)}
                aria-label="Keyboard shortcuts"
                title="Keyboard shortcuts (?)"
                className="hidden h-9 w-9 rounded-full text-muted-foreground hover:text-foreground md:inline-flex"
              >
                <Keyboard className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </header>

        <main className="relative z-10 mx-auto w-full max-w-7xl flex-1 px-4 pb-16 sm:px-6 lg:px-8">
          {/* ── Aurora hero ── */}
          <section className="pt-10 sm:pt-14" aria-label="Introduction">
            <div className="flex flex-col items-start gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-2xl">
                <span className="eyebrow inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/[0.06] px-3 py-1.5 text-primary dark:text-emerald-300">
                  <Sparkles className="h-3 w-3" />
                  Live job boards · location-aware
                </span>
                <h1 className="mt-4 text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl">
                  Find your next role,{" "}
                  <span className="gradient-text">anywhere on Earth.</span>
                </h1>
                <p className="mt-4 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
                  Search six live boards in parallel — type any{" "}
                  <span className="font-medium text-foreground">city + country</span> (e.g.{" "}
                  <span className="font-medium text-emerald-700 dark:text-emerald-300">Lahore, Pakistan</span>) and
                  results stay scoped to it. Rank by fit, star postings, export a tracker — all through the real CLI toolkit.
                </p>
                <div className="mt-6 flex flex-wrap items-center gap-2">
                  <Button size="lg" onClick={focusSearch} className="h-11 rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 px-6 shadow-glow transition-transform hover:scale-[1.03] active:scale-95">
                    Start searching
                  </Button>
                  <Button size="lg" variant="outline" onClick={() => setFitOpen(true)} className="h-11 rounded-full px-5">
                    <SlidersHorizontal className="mr-2 h-4 w-4" />
                    Tune fit profile
                  </Button>
                </div>
              </div>

              {/* Feature stat cards */}
              <dl className="grid w-full max-w-md shrink-0 grid-cols-2 gap-3 sm:grid-cols-2">
                <div className="card-elevated ring-gradient rounded-2xl border bg-card/80 p-4 backdrop-blur-sm">
                  <dt className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5 text-primary" /> Routing
                  </dt>
                  <dd className="mt-1.5 text-2xl font-bold tabular-nums">6 → smart</dd>
                  <p className="mt-0.5 text-xs text-muted-foreground">Boards filtered per location</p>
                </div>
                <div className="card-elevated ring-gradient rounded-2xl border bg-card/80 p-4 backdrop-blur-sm">
                  <dt className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    <ShieldCheck className="h-3.5 w-3.5 text-primary" /> Guard
                  </dt>
                  <dd className="mt-1.5 text-2xl font-bold tabular-nums">0 leaks</dd>
                  <p className="mt-0.5 text-xs text-muted-foreground">Off-country jobs auto-hidden</p>
                </div>
                <div className="card-elevated ring-gradient col-span-2 rounded-2xl border bg-card/80 p-4 backdrop-blur-sm">
                  <dt className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    <Star className="h-3.5 w-3.5 text-primary" /> Pipeline
                  </dt>
                  <dd className="mt-1.5 text-sm font-medium leading-snug text-muted-foreground">
                    Rank by fit → shortlist → deadline tracking → CSV tracker & LaTeX CV, powered by the{" "}
                    <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs text-foreground">/setup → /scrape → /apply → /interview</code> pipeline in the repo.
                  </dd>
                </div>
              </dl>
            </div>

            {/* Meta badges */}
            <div className="mt-8 flex flex-wrap items-center gap-2">
              {status?.repo.frameworkVersion ? (
                <Badge variant="secondary" className="rounded-full">framework v{status.repo.frameworkVersion}</Badge>
              ) : null}
              {status?.repo.branch ? (
                <Badge variant="outline" className="rounded-full font-mono text-[11px]">
                  {status.repo.branch}
                  {status.repo.headCommit ? `@${status.repo.headCommit.split("—")[0]?.trim()}` : ""}
                </Badge>
              ) : null}
              {status?.repo.remoteUrl ? (
                <span className="font-mono text-[11px] text-muted-foreground">{status.repo.remoteUrl}</span>
              ) : null}
            </div>
          </section>

          {/* ── Environment status ── */}
          <section aria-labelledby="env-status" className="mt-12">
            <div className="mb-4 flex items-end justify-between">
              <div>
                <p className="eyebrow flex items-center gap-2">
                  <span className="h-px w-6 bg-gradient-to-r from-primary to-transparent" />
                  Environment setup
                </p>
                <h2 id="env-status" className="mt-1 text-xl font-semibold tracking-tight">System readiness</h2>
              </div>
              {status ? (
                <span className="text-[11px] tabular-nums text-muted-foreground">
                  checked {new Date(status.checkedAt).toLocaleTimeString()}
                </span>
              ) : null}
            </div>
            <StatusStrip status={status} loading={loading} />
          </section>

          <div className="mt-14 space-y-16">
            {/* Live search */}
            <section id="panel-search" aria-labelledby="live-search" className="scroll-mt-24">
              <SearchConsole portals={portals} />
            </section>

            {/* Discover: taxonomy browsing */}
            <section id="panel-discover" aria-label="Discover categories and occupations" className="scroll-mt-24">
              <DiscoverPanel />
            </section>

            {/* Verification + LaTeX */}
            <section id="panel-testbench" aria-label="Tool panels" className="grid grid-cols-1 gap-8 scroll-mt-24 xl:grid-cols-3">
              <div className="xl:col-span-2">
                <TestBench />
              </div>
              <div id="panel-latex" className="scroll-mt-24 xl:col-span-1">
                <LatexPanel />
              </div>
            </section>

            {/* Salary + workflow */}
            <section id="panel-salary" aria-label="Salary and workflow" className="grid grid-cols-1 gap-8 scroll-mt-24 xl:grid-cols-3">
              <div className="xl:col-span-1">
                <SalaryPanel hintCompanies={salaryCompanies} />
              </div>
              <div id="panel-workflow" className="scroll-mt-24 xl:col-span-2">
                <WorkflowPipeline />
              </div>
            </section>

            {/* Interview prep methodology */}
            <section id="panel-interview" aria-label="Interview prep" className="scroll-mt-24">
              <InterviewPrepPanel />
            </section>

            {/* Repo map + framework updates */}
            <section id="panel-repomap" aria-label="Repo map and framework updates" className="grid grid-cols-1 gap-8 scroll-mt-24 xl:grid-cols-3">
              <div className="xl:col-span-2">
                <RepoMap />
              </div>
              <div id="panel-updates" className="scroll-mt-24 xl:col-span-1">
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
        <footer className="relative z-10 mt-auto border-t border-border/70 bg-muted/40">
          <div
            className="mx-auto flex w-full max-w-7xl flex-col items-center justify-between gap-3 px-4 py-5 text-xs text-muted-foreground sm:flex-row sm:px-6 lg:px-8"
            style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}
          >
            <span className="flex items-center gap-1.5">
              <span className="flex h-5 w-5 items-center justify-center rounded-md bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
                <Briefcase className="h-3 w-3" />
              </span>
              Independent open-source project — not affiliated with Anthropic or Claude Code.
            </span>
            <span className="flex flex-wrap items-center justify-center gap-3">
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
                job-finder · ai-job-search v{status?.repo.frameworkVersion ?? "?"}
              </span>
            </span>
          </div>
        </footer>
      </div>
    </ShortlistProvider>
  );
}
