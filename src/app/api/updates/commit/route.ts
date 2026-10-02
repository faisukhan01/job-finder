import { NextRequest, NextResponse } from "next/server";
import { REPO_ROOT, runGit } from "@/lib/job-search/runner";
import type { UpdateCommitDetail } from "@/lib/job-search/shared-types";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Per-commit drill-down for the Framework updates card: `git show <sha>`
 * metadata + file-level --stat. SHA is strictly validated (7-40 hex chars,
 * resolved through git rev-parse --verify) so no git expression can be
 * injected — an invalid ref simply 400s.
 */

const SHA_RE = /^[0-9a-f]{7,40}$/i;

/** Small TTL cache — commit details are immutable once fetched. */
const cache = new Map<string, { data: UpdateCommitDetail; at: number }>();
const TTL_MS = 30 * 60 * 1000;
const MAX_CACHE = 40;

export async function GET(req: NextRequest) {
  const sha = (req.nextUrl.searchParams.get("sha") ?? "").trim().toLowerCase();

  if (!SHA_RE.test(sha)) {
    return NextResponse.json(
      { ok: false, error: "Invalid commit sha — expected 7-40 hex characters." },
      { status: 400 },
    );
  }

  const hit = cache.get(sha);
  if (hit && Date.now() - hit.at < TTL_MS) {
    return NextResponse.json(hit.data);
  }

  // Resolve the ref first — rev-parse --verify refuses ambiguous/injected input.
  const verify = await runGit(["rev-parse", "--verify", "--quiet", `${sha}^{commit}`], {
    cwd: REPO_ROOT,
    timeoutMs: 10_000,
  });
  if (verify.code !== 0 || !SHA_RE.test(verify.stdout.trim())) {
    return NextResponse.json(
      { ok: false, error: "Commit not found in this repository." },
      { status: 404 },
    );
  }
  const fullSha = verify.stdout.trim();

  // Metadata via unit-separator format (no parsing ambiguity).
  const meta = await runGit(
    ["show", "-s", "--format=%H%x1f%an%x1f%aI%x1f%s%x1f%b", fullSha],
    { cwd: REPO_ROOT, timeoutMs: 10_000 },
  );

  // File-level stat, capped — huge diffs would only bloat the card.
  const stat = await runGit(["show", "--format=", "--stat", fullSha], {
    cwd: REPO_ROOT,
    timeoutMs: 10_000,
  });

  if (meta.code !== 0) {
    return NextResponse.json({
      ok: false,
      sha,
      author: null,
      date: null,
      subject: null,
      body: null,
      stat: null,
      error: "git show failed for this commit.",
    } satisfies UpdateCommitDetail);
  }

  const parts = meta.stdout.split("\x1f").map((s) => s.trim());
  const body = (parts[4] ?? "").split("\n").filter(Boolean).slice(0, 12).join("\n") || null;
  const statLines = stat.stdout
    .split("\n")
    .map((l) => l.trimEnd())
    .filter(Boolean)
    .slice(0, 50);
  const data: UpdateCommitDetail = {
    ok: true,
    sha: fullSha.slice(0, 7),
    author: parts[1] ?? null,
    date: parts[2] ?? null,
    subject: parts[3] ?? null,
    body,
    stat: statLines.length > 0 ? statLines.join("\n") : null,
  };

  if (cache.size >= MAX_CACHE) cache.clear();
  cache.set(sha, { data, at: Date.now() });
  return NextResponse.json(data);
}
