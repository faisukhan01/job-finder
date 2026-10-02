import fs from "fs";
import { REPO_ROOT, runBun, runGit, execCli, type ExecResult } from "./runner";
import { PORTALS, portalCliAbsPath } from "./portals";

export interface PortalInstallStatus {
  id: string;
  installed: boolean;
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
  portals: PortalInstallStatus[];
  toolchain: {
    lualatex: string | null;
    xelatex: string | null;
    pdftotext: boolean;
    pypdf: boolean;
    salaryData: boolean;
  };
  checkedAt: string;
}

interface CacheEntry {
  data: EnvStatus;
  expiresAt: number;
}

// Module-level cache survives route reloads within the same dev server.
const globalCache = globalThis as unknown as { __jobSearchStatusCache?: CacheEntry };
const CACHE_TTL_MS = 30_000;

function readFrameworkVersion(): string | null {
  try {
    const agents = fs.readFileSync(`${REPO_ROOT}/AGENTS.md`, "utf8");
    const m = agents.match(/framework_version:\s*([0-9.]+)/);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

async function which(bin: string): Promise<string | null> {
  const r = await execCli("which", [bin], { cwd: "/tmp", timeoutMs: 5_000 });
  return r.ok && r.stdout.trim() ? r.stdout.trim() : null;
}

async function pythonHas(module: string): Promise<boolean> {
  const r = await execCli(
    "python3",
    ["-c", `import importlib.util,sys; sys.exit(0 if importlib.util.find_spec('${module}') else 1)`],
    { cwd: REPO_ROOT, timeoutMs: 10_000 },
  );
  return r.ok;
}

async function gitWithFallback(): Promise<Pick<EnvStatus["repo"], "branch" | "headCommit" | "remoteUrl">> {
  const empty = { branch: null, headCommit: null, remoteUrl: null };
  if (!fs.existsSync(`${REPO_ROOT}/.git`)) return empty;
  const [branch, head, remote] = await Promise.all([
    runGit(["rev-parse", "--abbrev-ref", "HEAD"]),
    runGit(["log", "-1", "--format=%h %cs%n%s"]),
    runGit(["remote", "get-url", "origin"]),
  ]);
  const headLines = head.stdout.trim().split("\n");
  return {
    branch: branch.ok ? branch.stdout.trim() : null,
    headCommit: head.ok && headLines.length >= 2 ? `${headLines[0]} — ${headLines.slice(1).join(" ")}` : head.stdout.trim() || null,
    remoteUrl: remote.ok ? remote.stdout.trim() : null,
  };
}

export async function getEnvStatus(force = false): Promise<EnvStatus> {
  const cached = globalCache.__jobSearchStatusCache;
  if (!force && cached && cached.expiresAt > Date.now()) return cached.data;

  const cloned = fs.existsSync(`${REPO_ROOT}/.git`);

  const [repo, bunVer, pyVer, lualatex, xelatex, pdftotext, pypdf] = await Promise.all([
    gitWithFallback(),
    runBun(["--version"], { cwd: "/tmp", timeoutMs: 10_000 }),
    execCli("python3", ["--version"], { cwd: REPO_ROOT, timeoutMs: 10_000 }),
    which("lualatex"),
    which("xelatex"),
    which("pdftotext"),
    pythonHas("pypdf"),
  ]);

  const portals: PortalInstallStatus[] = PORTALS.map((p) => ({
    id: p.id,
    installed: fs.existsSync(`${portalCliAbsPath(p)}/node_modules`),
  }));

  const data: EnvStatus = {
    repo: {
      cloned,
      ...repo,
      frameworkVersion: readFrameworkVersion(),
    },
    runtimes: {
      bun: bunVer.ok ? bunVer.stdout.trim() : null,
      python: pyVer.stdout.trim().replace(/^Python\s*/i, "") || (pyVer.ok ? "unknown" : null),
    },
    portals,
    toolchain: {
      lualatex: lualatex,
      xelatex: xelatex,
      pdftotext: !!pdftotext,
      pypdf,
      salaryData: fs.existsSync(`${REPO_ROOT}/salary_data.json`),
    },
    checkedAt: new Date().toISOString(),
  };

  globalCache.__jobSearchStatusCache = { data, expiresAt: Date.now() + CACHE_TTL_MS };
  return data;
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

const suiteCache = globalThis as unknown as { __jobSearchSuiteCache?: Partial<Record<SuiteId, SuiteResult>> };
if (!suiteCache.__jobSearchSuiteCache) suiteCache.__jobSearchSuiteCache = {};

export function getCachedSuite(id: SuiteId): SuiteResult | null {
  const c = suiteCache.__jobSearchSuiteCache?.[id];
  return c && !c.running ? c : null;
}

export function isSuiteRunning(id: SuiteId): boolean {
  return suiteCache.__jobSearchSuiteCache?.[id]?.running === true;
}

function tail(s: string, max = 6_000): string {
  return s.length > max ? `…${s.slice(-max)}` : s;
}

function extractSummary(suite: SuiteId, out: string): string {
  if (suite === "python") {
    const ran = out.match(/Ran (\d+) tests?/);
    const ok = /^OK\b/m.test(out);
    const failures = out.match(/failures?:?\s*(\d+)/i);
    if (ran) return `${ran[1]} tests — ${ok ? "all passed" : `failures: ${failures?.[1] ?? "?"}`}`;
    return ok ? "passed" : "see output";
  }
  if (suite === "cli") {
    const counts = [...out.matchAll(/Ran (\d+) tests across (\d+) files?/g)];
    const total = counts.reduce((acc, m) => acc + parseInt(m[1], 10), 0);
    if (total > 0) return `${total} bun tests across ${counts.length} tools — all passed`;
    return out.includes("0 fail") ? "passed" : "see output";
  }
  if (suite === "lint") {
    const lines = out.split("\n").filter((l) => /OK/.test(l)).length;
    return lines > 0 ? `${lines} checks OK` : "see output";
  }
  return out.includes("error TS") ? "type errors found" : "clean";
}

async function runSuiteInternal(id: SuiteId): Promise<SuiteResult> {
  const started = Date.now();
  let out = "";
  let ok = true;

  if (id === "python") {
    const r = await execCli("python3", ["-m", "unittest", "discover", "-s", "tests", "-t", "."], {
      cwd: REPO_ROOT,
      timeoutMs: 180_000,
    });
    ok = r.ok;
    out = `${r.stdout}\n${r.stderr}`.trim();
  } else if (id === "lint") {
    const parts: string[] = [];
    for (const script of [
      ["tools/lint_skills.py", "Skill lint"],
      ["tools/check_framework_version.py", "Framework version guard"],
      ["tools/security_guards.py", "Security guards"],
    ] as const) {
      const r = await execCli("python3", [script[0]], { cwd: REPO_ROOT, timeoutMs: 60_000 });
      parts.push(`$ python3 ${script[0]}\n${(r.stdout + r.stderr).trim() || "(no output)"}\n`);
      if (!r.ok) ok = false;
    }
    out = parts.join("\n");
  } else if (id === "typecheck") {
    const parts: string[] = [];
    for (const p of PORTALS) {
      const r = await runBun(["run", "typecheck"], {
        cwd: portalCliAbsPath(p),
        timeoutMs: 90_000,
      });
      parts.push(`$ bun run typecheck  [${p.id}]\n${r.ok ? "clean" : (r.stdout + r.stderr).trim()}\n`);
      if (!r.ok) ok = false;
    }
    out = parts.join("\n");
  } else {
    const parts: string[] = [];
    for (const p of PORTALS) {
      const r = await runBun(["test", "--timeout", "30000"], {
        cwd: portalCliAbsPath(p),
        timeoutMs: 180_000,
      });
      const summaryLine =
        (r.stdout + r.stderr).split("\n").filter((l) => /Ran \d+ tests|fail/.test(l)).join(" | ") || "(no summary)";
      parts.push(`$ bun test  [${p.id}]\n${summaryLine}\n`);
      if (!r.ok) ok = false;
    }
    out = parts.join("\n");
  }

  return {
    suite: id,
    ok,
    summary: extractSummary(id, `${out}\n${ok ? "" : "FAILED"}`),
    output: tail(out),
    durationMs: Date.now() - started,
    finishedAt: new Date().toISOString(),
    running: false,
  };
}

export async function runSuite(id: SuiteId): Promise<SuiteResult> {
  const cache = suiteCache.__jobSearchSuiteCache!;
  if (cache[id]?.running) {
    return { ...(cache[id] as SuiteResult) };
  }
  const placeholder: SuiteResult = {
    suite: id,
    ok: false,
    summary: "running…",
    output: "",
    durationMs: 0,
    finishedAt: "",
    running: true,
  };
  cache[id] = placeholder;
  try {
    const result = await runSuiteInternal(id);
    cache[id] = result;
    return result;
  } catch (e) {
    const failed: SuiteResult = {
      suite: id,
      ok: false,
      summary: "crashed",
      output: tail(String(e)),
      durationMs: 0,
      finishedAt: new Date().toISOString(),
      running: false,
    };
    cache[id] = failed;
    return failed;
  }
}

export type { ExecResult };
