import { execFile } from "child_process";

/** Absolute path of the cloned ai-job-search repository inside this sandbox. */
export const REPO_ROOT = "/home/z/my-project/ai-job-search";

/** Bun binary location in this sandbox. */
export const BUN_BIN = "/usr/local/bin/bun";

export interface ExecResult {
  ok: boolean;
  stdout: string;
  stderr: string;
  code: number | null;
  timedOut: boolean;
}

/**
 * Run a CLI command and capture stdout/stderr with a hard timeout.
 * Never throws - always resolves with an ExecResult so callers can
 * decide how to surface failures (portals get blocked, tests fail, etc).
 */
export function execCli(
  bin: string,
  args: string[],
  opts: { cwd: string; timeoutMs?: number; env?: NodeJS.ProcessEnv },
): Promise<ExecResult> {
  return new Promise((resolve) => {
    const child = execFile(
      bin,
      args,
      {
        cwd: opts.cwd,
        timeout: opts.timeoutMs ?? 60_000,
        maxBuffer: 32 * 1024 * 1024,
        encoding: "utf8",
        env: { ...process.env, ...opts.env },
      },
      (err, stdout, stderr) => {
        const anyErr = err as (Error & { killed?: boolean; signal?: string }) | null;
        const timedOut = !!anyErr?.killed;
        resolve({
          ok: !err,
          stdout: stdout || "",
          stderr: stderr || "",
          code: child.exitCode ?? (err ? 1 : 0),
          timedOut,
        });
      },
    );
  });
}

export function runBun(
  args: string[],
  opts: { cwd: string; timeoutMs?: number },
): Promise<ExecResult> {
  return execCli(BUN_BIN, args, opts);
}

export function runPython(
  args: string[],
  opts: { cwd?: string; timeoutMs?: number } = {},
): Promise<ExecResult> {
  return execCli("python3", args, {
    cwd: opts.cwd ?? REPO_ROOT,
    timeoutMs: opts.timeoutMs ?? 120_000,
  });
}

export function runGit(
  args: string[],
  opts: { cwd?: string; timeoutMs?: number } = {},
): Promise<ExecResult> {
  return execCli("git", args, {
    cwd: opts.cwd ?? REPO_ROOT,
    timeoutMs: opts.timeoutMs ?? 15_000,
  });
}

/**
 * Parse CLI stdout as JSON. Some CLIs may prepend non-JSON noise,
 * so fall back to extracting the outermost JSON object.
 */
export function parseCliJson<T = unknown>(stdout: string): T | null {
  const trimmed = stdout.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    const start = trimmed.search(/[[{]/);
    if (start === -1) return null;
    try {
      return JSON.parse(trimmed.slice(start)) as T;
    } catch {
      return null;
    }
  }
}

/** Defensive string field getter. */
export function pickStr(obj: Record<string, unknown>, keys: string[]): string | null {
  for (const k of keys) {
    const v = obj?.[k];
    if (typeof v === "string" && v.trim().length > 0) return v.trim();
  }
  return null;
}
