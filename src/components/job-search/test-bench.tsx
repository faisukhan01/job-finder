"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  FlaskConical,
  Play,
  CheckCircle2,
  XCircle,
  Loader2,
  TerminalSquare,
  RefreshCw,
} from "lucide-react";
import type { SuiteId, SuiteResult, SuitesState } from "@/lib/job-search/shared-types";

const SUITE_META: Record<SuiteId, { label: string; description: string; est: string }> = {
  python: {
    label: "Python tool suite",
    description: "unittest discovery over tests/ — 503 tests for the salary, tracker, verify & guard tools",
    est: "~10s",
  },
  lint: {
    label: "Lint & security guards",
    description: "lint_skills, framework version guard, security_guards (permissions, gitignore, manifests)",
    est: "~3s",
  },
  typecheck: {
    label: "CLI typechecks",
    description: "tsc --noEmit inside each of the 6 portal CLI packages",
    est: "~20s",
  },
  cli: {
    label: "CLI test suites",
    description: "bun test inside each portal CLI (fixture/mock suites, no live portal hits)",
    est: "~40s",
  },
};

const SUITE_ORDER: SuiteId[] = ["python", "lint", "typecheck", "cli"];

export function TestBench() {
  const { toast } = useToast();
  const [suites, setSuites] = useState<Record<SuiteId, { running: boolean; result: SuiteResult | null }>>({
    python: { running: false, result: null },
    lint: { running: false, result: null },
    typecheck: { running: false, result: null },
    cli: { running: false, result: null },
  });
  const [activeOutput, setActiveOutput] = useState<SuiteId | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    fetch("/api/tests")
      .then((r) => r.json())
      .then((data: SuitesState) => {
        const next = { ...suites };
        for (const s of data.suites) {
          next[s.id] = { running: s.running, result: s.result };
        }
        setSuites(next);
        setHydrated(true);
      })
      .catch(() => setHydrated(true));
  }, []);

  async function runSuite(id: SuiteId) {
    setSuites((prev) => ({ ...prev, [id]: { running: true, result: prev[id].result } }));
    setActiveOutput(id);
    try {
      const res = await fetch("/api/tests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ suite: id }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: data.error || "Suite failed to start", variant: "destructive" });
        setSuites((prev) => ({ ...prev, [id]: { running: false, result: prev[id].result } }));
        return;
      }
      const result = data.result as SuiteResult;
      setSuites((prev) => ({ ...prev, [id]: { running: false, result } }));
      toast({
        title: `${SUITE_META[id].label}: ${result.ok ? "passed" : "failed"}`,
        description: `${result.summary} · ${(result.durationMs / 1000).toFixed(1)}s`,
      });
    } catch (e) {
      toast({ title: "Network error running suite", description: (e as Error).message, variant: "destructive" });
      setSuites((prev) => ({ ...prev, [id]: { running: false, result: prev[id].result } }));
    }
  }

  const anyRunning = SUITE_ORDER.some((id) => suites[id].running);
  const activeResult = activeOutput ? suites[activeOutput].result : null;

  return (
    <Card className="card-elevated">
      <CardHeader>
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <FlaskConical className="h-5 w-5" />
          </span>
          <div>
            <p className="eyebrow flex items-center gap-2">
              <span className="h-px w-6 bg-gradient-to-r from-primary to-transparent" />
              Verification
            </p>
            <CardTitle className="mt-0.5 text-xl font-semibold tracking-tight">Verification bench</CardTitle>
          </div>
        </div>
        <CardDescription>
          The repo&apos;s own CI checks, runnable on demand — identical to what GitHub Actions runs on every push.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {SUITE_ORDER.map((id) => {
            const meta = SUITE_META[id];
            const state = suites[id];
            const result = state.result;
            return (
              <div
                key={id}
                className={`card-elevated ring-gradient flex flex-col justify-between rounded-xl border p-3 transition-colors ${
                  activeOutput === id ? "border-emerald-500/60 bg-emerald-500/5" : "border-border/70"
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-sm font-semibold leading-tight">{meta.label}</span>
                    {state.running ? (
                      <Loader2 className="h-4 w-4 shrink-0 animate-spin text-amber-500" />
                    ) : result ? (
                      result.ok ? (
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                      ) : (
                        <XCircle className="h-4 w-4 shrink-0 text-rose-500" />
                      )
                    ) : null}
                  </div>
                  <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground">{meta.description}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {result && !state.running ? (
                      <Badge variant={result.ok ? "secondary" : "destructive"} className="text-[10px]">
                        {result.summary}
                      </Badge>
                    ) : state.running ? (
                      <Badge variant="outline" className="shimmer text-[10px]">
                        running…
                      </Badge>
                    ) : hydrated ? (
                      <Badge variant="outline" className="text-[10px] text-muted-foreground">
                        not run yet
                      </Badge>
                    ) : null}
                    {result ? <span className="text-[10px] text-muted-foreground">{(result.durationMs / 1000).toFixed(1)}s</span> : null}
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <Button
                    size="sm"
                    variant={result ? "outline" : "default"}
                    disabled={state.running || anyRunning}
                    onClick={() => runSuite(id)}
                    className="h-8 flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 text-xs text-white shadow-glow transition-transform hover:scale-[1.03] active:scale-95"
                  >
                    {state.running ? (
                      <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                    ) : (
                      <Play className="mr-1.5 h-3 w-3" />
                    )}
                    {result ? "Re-run" : "Run"}
                    <span className="ml-1 opacity-60">({meta.est})</span>
                  </Button>
                  {result ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setActiveOutput(id)}
                      className="h-8 px-2 text-xs"
                      aria-label={`Show ${meta.label} output`}
                    >
                      <TerminalSquare className="h-3.5 w-3.5" />
                    </Button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>

        {activeOutput ? (
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                Output — {SUITE_META[activeOutput].label}
              </span>
              {activeResult ? (
                <span className="text-[11px] tabular-nums text-muted-foreground">
                  finished {new Date(activeResult.finishedAt).toLocaleTimeString()}
                </span>
              ) : null}
            </div>
            <pre className="bg-dots scrollbar-thin max-h-80 overflow-auto rounded-xl border border-border/70 bg-muted/50 p-3 font-mono text-[11px] leading-relaxed text-foreground/90">
              {activeResult?.output || "No output captured."}
            </pre>
          </div>
        ) : (
          <div className="bg-dots flex items-center gap-2 rounded-xl border border-dashed border-border/70 px-4 py-6 text-xs text-muted-foreground">
            <RefreshCw className="h-3.5 w-3.5" />
            Run any suite above to see its raw console output here. Results are cached per server session.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
