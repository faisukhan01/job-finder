"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  GitBranch,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  ArrowUpCircle,
  Clock,
  ChevronDown,
  GitCommitHorizontal,
  Loader2,
  User,
} from "lucide-react";
import type { UpdatesResponse, UpdateCommitDetail } from "@/lib/job-search/shared-types";

export function UpdatesCard() {
  const [data, setData] = useState<UpdatesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedSha, setExpandedSha] = useState<string | null>(null);
  const [commitDetails, setCommitDetails] = useState<Map<string, UpdateCommitDetail>>(new Map());
  const [commitLoading, setCommitLoading] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const check = useCallback(async (force = false) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/updates${force ? "?force=1" : ""}`);
      const json = (await res.json()) as UpdatesResponse;
      if (!mountedRef.current) return;
      if (!res.ok || !json.ok) {
        setError(json.error ?? `Update check failed (${res.status})`);
        if (json.checkedAt) setData(json);
      } else {
        setData(json);
      }
    } catch {
      if (mountedRef.current) setError("Network error");
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    check();
  }, [check]);

  /** Expand/collapse a commit row, lazily fetching its drill-down detail. */
  const toggleCommit = useCallback(async (sha: string) => {
    if (expandedSha === sha) {
      setExpandedSha(null);
      return;
    }
    setExpandedSha(sha);
    if (commitDetails.has(sha)) return;
    setCommitLoading(sha);
    try {
      const res = await fetch(`/api/updates/commit?sha=${encodeURIComponent(sha)}`);
      const json = (await res.json()) as UpdateCommitDetail;
      if (!mountedRef.current) return;
      setCommitDetails((prev) => new Map(prev).set(sha, json));
    } catch {
      if (mountedRef.current) {
        setCommitDetails((prev) =>
          new Map(prev).set(sha, { ok: false, sha, author: null, date: null, subject: null, body: null, stat: null, error: "Network error" }),
        );
      }
    } finally {
      if (mountedRef.current) setCommitLoading(null);
    }
  }, [expandedSha, commitDetails]);

  const status = data?.status;
  const upToDate = status === "up_to_date";
  const behind = status === "behind";
  const failed = status === "error" || error != null;

  return (
    <Card className="card-elevated flex h-full flex-col overflow-hidden">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <GitBranch className="h-5 w-5" />
            </span>
            <div>
              <p className="eyebrow flex items-center gap-2">
                <span className="h-px w-6 bg-gradient-to-r from-primary to-transparent" />
                Framework updates
              </p>
              <CardTitle className="mt-0.5 text-xl font-semibold tracking-tight">Framework updates</CardTitle>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => check(true)}
            disabled={loading}
            className="h-7 gap-1.5 rounded-full border-border/80 px-3 text-xs"
            aria-label="Check for upstream framework updates now"
          >
            <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
            Check now
          </Button>
        </div>
        <CardDescription>
          Runs the repo&apos;s own <code className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">check_upstream_updates.py</code>{" "}
          against <code className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">origin/master</code>.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1">
        {loading && !data ? (
          <div className="space-y-2">
            <div className="shimmer h-16 animate-pulse rounded-lg bg-muted/60" />
            <div className="shimmer h-8 animate-pulse rounded-lg bg-muted/40" />
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="flex h-full flex-col gap-3"
          >
            <div
              className={`flex items-start gap-3 rounded-lg border px-3.5 py-3 ${
                failed
                  ? "border-destructive/40 bg-destructive/5"
                  : upToDate
                    ? "border-emerald-500/40 bg-emerald-500/[0.06]"
                    : "border-amber-500/40 bg-amber-500/[0.06]"
              }`}
            >
              {failed ? (
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
              ) : upToDate ? (
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <ArrowUpCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
              )}
              <div className="min-w-0">
                <p className="text-sm font-semibold">
                  {failed
                    ? "Update check failed"
                    : upToDate
                      ? "Up to date with origin/master"
                      : `${data?.behindCount ?? 0} commit${(data?.behindCount ?? 0) === 1 ? "" : "s"} behind`}
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                  {failed
                    ? (error ?? data?.error ?? "The check could not complete — see details below.")
                    : upToDate
                      ? "All framework files match the upstream master branch."
                      : "New commits are available upstream. Review them with the repo's upstream_triage tool before pulling."}
                </p>
              </div>
            </div>

            {behind && data && data.commits.length > 0 ? (
              <div className="overflow-hidden rounded-lg border border-border/70">
                <div className="flex items-center justify-between gap-2 border-b border-border/70 bg-muted/40 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <span>Upstream commits</span>
                  <span className="normal-case tracking-normal opacity-70">click a commit for its file diff</span>
                </div>
                <ul className="max-h-72 divide-y divide-border/50 overflow-y-auto scrollbar-thin">
                  {data.commits.map((c) => {
                    const expanded = expandedSha === c.sha;
                    const detail = commitDetails.get(c.sha);
                    return (
                      <li key={c.sha}>
                        <button
                          type="button"
                          onClick={() => toggleCommit(c.sha)}
                          aria-expanded={expanded}
                          aria-label={`Show file diff for commit ${c.sha}: ${c.subject}`}
                          className={`flex w-full items-baseline gap-2 px-3 py-1.5 text-left text-xs transition-colors hover:bg-muted/50 ${expanded ? "bg-muted/50" : ""}`}
                        >
                          <code className="shrink-0 font-mono text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                            {c.sha}
                          </code>
                          <span className="min-w-0 flex-1 truncate text-foreground/90">{c.subject}</span>
                          {commitLoading === c.sha ? (
                            <Loader2 className="h-3 w-3 shrink-0 animate-spin text-muted-foreground" />
                          ) : null}
                          <ChevronDown
                            className={`h-3 w-3 shrink-0 text-muted-foreground transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
                          />
                        </button>
                        {expanded ? (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            transition={{ duration: 0.22 }}
                            className="overflow-hidden border-t border-border/40 bg-muted/20"
                          >
                            {!detail ? (
                              <div className="flex items-center gap-2 px-3 py-2 text-[11px] text-muted-foreground">
                                <Loader2 className="h-3 w-3 animate-spin" /> loading commit details…
                              </div>
                            ) : !detail.ok ? (
                              <div className="flex items-center gap-2 px-3 py-2 text-[11px] text-destructive">
                                <AlertTriangle className="h-3 w-3" /> {detail.error ?? "Could not load this commit."}
                              </div>
                            ) : (
                              <div className="space-y-1.5 px-3 py-2">
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
                                  <span className="inline-flex items-center gap-1">
                                    <GitCommitHorizontal className="h-3 w-3" />
                                    <code className="font-mono">{detail.sha}</code>
                                  </span>
                                  {detail.author ? (
                                    <span className="inline-flex items-center gap-1">
                                      <User className="h-3 w-3" /> {detail.author}
                                    </span>
                                  ) : null}
                                  {detail.date ? (
                                    <span className="inline-flex items-center gap-1">
                                      <Clock className="h-3 w-3" />
                                      {new Date(detail.date).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}
                                    </span>
                                  ) : null}
                                </div>
                                {detail.body ? (
                                  <p className="whitespace-pre-wrap text-[11px] leading-relaxed text-foreground/80">{detail.body}</p>
                                ) : null}
                                {detail.stat ? (
                                  <pre className="max-h-40 overflow-auto whitespace-pre rounded border border-border/50 bg-background/60 px-2 py-1.5 font-mono text-[10px] leading-relaxed text-foreground/80 scrollbar-thin">
                                    {detail.stat}
                                  </pre>
                                ) : null}
                              </div>
                            )}
                          </motion.div>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}

            {behind && data?.diffStat ? (
              <div className="overflow-hidden rounded-lg border border-border/70">
                <div className="flex items-center justify-between gap-2 border-b border-border/70 bg-muted/40 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <span>Changed files (HEAD..origin/master)</span>
                  <span className="normal-case tracking-normal opacity-70">diff --stat</span>
                </div>
                <pre className="max-h-44 overflow-auto whitespace-pre px-3 py-2 font-mono text-[10px] leading-relaxed text-foreground/80 scrollbar-thin">
                  {data.diffStat}
                </pre>
              </div>
            ) : null}

            {data?.details ? (
              <pre className="max-h-32 overflow-auto whitespace-pre-wrap rounded-lg border border-border/70 bg-muted/30 px-3 py-2 font-mono text-[10px] leading-relaxed text-muted-foreground scrollbar-thin">
                {data.details}
              </pre>
            ) : null}

            {data ? (
              <p className="mt-auto flex items-center gap-1.5 text-[10px] text-muted-foreground/70">
                <Clock className="h-3 w-3" />
                checked{" "}
                {new Date(data.checkedAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                {data.cached ? <Badge variant="outline" className="ml-1 h-4 px-1.5 text-[9px]">cached</Badge> : null}
              </p>
            ) : null}
          </motion.div>
        )}
      </CardContent>
    </Card>
  );
}
