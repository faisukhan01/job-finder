import { NextResponse } from "next/server";
import fs from "fs";
import os from "os";
import path from "path";
import { REPO_ROOT, execCli } from "@/lib/job-search/runner";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

interface CompileOutcome {
  ok: boolean;
  engine: string;
  pages: number | null;
  bytes: number | null;
  seconds: number;
  error: string | null;
}

async function compileOne(
  sourceRel: string,
  engine: "lualatex" | "xelatex",
  workDir: string,
): Promise<CompileOutcome> {
  const started = Date.now();
  const srcAbs = path.join(REPO_ROOT, sourceRel);
  const srcDir = path.dirname(srcAbs);
  const base = path.basename(srcAbs);

  // Copy the template's directory context (cls files, fonts) into the
  // temp workspace so the repo tree stays free of build artifacts.
  await execCli("cp", ["-r", `${srcDir}/.`, `${workDir}/`], { cwd: REPO_ROOT, timeoutMs: 30_000 });

  const r = await execCli(
    engine,
    ["-interaction=nonstopmode", "-halt-on-error", base],
    { cwd: workDir, timeoutMs: 240_000 },
  );

  const pdfBase = base.replace(/\.tex$/, ".pdf");
  const pdfPath = path.join(workDir, pdfBase);
  if (!r.ok || !fs.existsSync(pdfPath)) {
    const logPath = path.join(workDir, base.replace(/\.tex$/, ".log"));
    let error = `${engine} exited with code ${r.code}`;
    if (fs.existsSync(logPath)) {
      const log = fs.readFileSync(logPath, "utf8");
      const m = log.match(/^! (.*)$/m);
      if (m) error = m[1].trim();
    }
    return { ok: false, engine, pages: null, bytes: null, seconds: (Date.now() - started) / 1000, error };
  }

  // Page count via the repo's own verify tool semantics (pypdf, fallback pdfinfo).
  let pages: number | null = null;
  const v = await execCli(
    "python3",
    ["tools/verify_pdf.py", pdfPath, "--min-chars", "1"],
    { cwd: REPO_ROOT, timeoutMs: 30_000 },
  );
  const pm = v.stdout.match(/pages:\s*(\d+)/);
  if (pm) pages = parseInt(pm[1], 10);
  if (pages == null) {
    const info = await execCli("pdfinfo", [pdfPath], { cwd: workDir, timeoutMs: 15_000 });
    const im = info.stdout.match(/^Pages:\s*(\d+)$/m);
    if (im) pages = parseInt(im[1], 10);
  }

  return {
    ok: true,
    engine,
    pages,
    bytes: fs.statSync(pdfPath).size,
    seconds: (Date.now() - started) / 1000,
    error: null,
  };
}

export async function POST() {
  const workRoot = fs.mkdtempSync(path.join(os.tmpdir(), "aijs-latex-"));
  try {
    const [cv, cover] = await Promise.all([
      compileOne("cv/main_example.tex", "lualatex", fs.mkdtempSync(path.join(workRoot, "cv-"))),
      compileOne("cover_letters/cover_example.tex", "xelatex", fs.mkdtempSync(path.join(workRoot, "cover-"))),
    ]);
    return NextResponse.json({ cv, cover });
  } finally {
    // Cleanup is best-effort; tmp dirs vanish on reboot anyway.
    execCli("rm", ["-rf", workRoot], { cwd: "/tmp", timeoutMs: 15_000 });
  }
}
