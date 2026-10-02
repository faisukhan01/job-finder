import { NextRequest, NextResponse } from "next/server";
import { REPO_ROOT, runPython, runGit } from "@/lib/job-search/runner";
import type { UpdateStatus } from "@/lib/job-search/shared-types";

export const dynamic = "force-dynamic";
export const maxDuration = 90;

interface CacheEntry {
  data: unknown;
  at: number;
}

/** Upstream state changes at most daily — cache for 10 minutes. */
const cache = new Map<string, CacheEntry>();
const TTL_MS = 10 * 60 * 1000;

function cacheGet(): CacheEntry | null {
  const hit = cache.get("updates");
  if (hit && Date.now() - hit.at < TTL_MS) return hit;
  cache.delete("updates");
  return null;
}

function cacheSet(data: unknown): void {
  cache.set("updates", { data, at: Date.now() });
}

async function checkUpstream(): Promise<{
  status: UpdateStatus;
  behindCount: number;
  commits: { sha: string; subject: string }[];
  diffStat: string | null;
  details: string | null;
  error: string | null;
}> {
  // 1) The framework's own tool (fetches origin + compares framework files).
  const tool = await runPython(["tools/check_upstream_updates.py"], { cwd: REPO_ROOT, timeoutMs: 60_000 });
  const toolOut = `${tool.stdout}\n${tool.stderr}`.trim();
  const upToDate = /\[OK\] All framework files are up to date/i.test(toolOut);

  // 2) Commit-level triage: how many commits is the clone behind?
  const count = await runGit(["rev-list", "--count", "HEAD..origin/master"], { cwd: REPO_ROOT, timeoutMs: 15_000 });
  const behindCount = Number.parseInt(count.stdout.trim(), 10);

  let commits: { sha: string; subject: string }[] = [];
  let diffStat: string | null = null;
  if (Number.isFinite(behindCount) && behindCount > 0) {
    const log = await runGit(["log", "HEAD..origin/master", "--oneline", "-n", "12"], { cwd: REPO_ROOT, timeoutMs: 15_000 });
    commits = log.stdout
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [sha, ...rest] = line.split(" ");
        return { sha: sha.slice(0, 7), subject: rest.join(" ") };
      });

    // Per-commit context is nice, but a file-level diff --stat shows the blast
    // radius at a glance (framework files vs docs). Cap the output — huge
    // diffs would only bloat the card.
    const diff = await runGit(["diff", "--stat", "HEAD..origin/master"], { cwd: REPO_ROOT, timeoutMs: 15_000 });
    const lines = diff.stdout.split("\n").map((l) => l.trimEnd()).filter(Boolean);
    diffStat = lines.length > 0 ? lines.slice(0, 40).join("\n") : null;
  }

  if (!Number.isFinite(behindCount)) {
    return {
      status: "error",
      behindCount: 0,
      commits: [],
      diffStat: null,
      details: toolOut || null,
      error: "git rev-list failed — is the clone a valid git repo?",
    };
  }

  const status: UpdateStatus = behindCount === 0 && upToDate ? "up_to_date" : behindCount > 0 ? "behind" : "up_to_date";
  return {
    status,
    behindCount: Number.isFinite(behindCount) ? behindCount : 0,
    commits,
    diffStat,
    // When the file-level tool flags drift despite 0 commits behind, surface it.
    details: !upToDate && behindCount === 0 ? toolOut.split("\n").filter(Boolean).slice(-6).join("\n") : null,
    error: tool.code !== 0 && !upToDate && behindCount === 0 ? "check_upstream_updates.py exited non-zero" : null,
  };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const force = searchParams.get("force") === "1";

  const cached = force ? null : cacheGet();
  if (cached) {
    return NextResponse.json({ ...(cached.data as object), checkedAt: new Date(cached.at).toISOString(), cached: true });
  }

  const result = await checkUpstream();
  const payload = { ...result, ok: result.status !== "error", checkedAt: new Date().toISOString(), cached: false };
  cacheSet(payload);
  return NextResponse.json(payload);
}
