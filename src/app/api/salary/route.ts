import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import { REPO_ROOT, runPython, parseCliJson } from "@/lib/job-search/runner";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SALARY_FILE = `${REPO_ROOT}/salary_data.json`;

interface SalaryCategory {
  count?: number;
  index?: number;
}

interface SalaryEntry {
  company: string;
  city?: string | null;
  categories?: Record<string, SalaryCategory> | null;
}

function hasSalaryData(): boolean {
  return fs.existsSync(SALARY_FILE);
}

/** GET: availability + demo company directory (fast path, reads the JSON directly). */
export async function GET() {
  if (!hasSalaryData()) {
    return NextResponse.json({ available: false, companies: [], metadata: null });
  }
  try {
    const raw = JSON.parse(fs.readFileSync(SALARY_FILE, "utf8")) as {
      metadata?: Record<string, unknown>;
      companies?: SalaryEntry[];
    };
    return NextResponse.json({
      available: true,
      metadata: raw.metadata ?? null,
      companies: (raw.companies ?? []).map((c) => ({
        company: c.company,
        city: c.city ?? null,
      })),
    });
  } catch {
    return NextResponse.json({ available: false, companies: [], metadata: null });
  }
}

/** POST: fuzzy lookup through the repo's own salary_lookup.py (handles Danish chars, legal suffixes, misspellings). */
export async function POST(req: NextRequest) {
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const company = typeof body.company === "string" ? body.company.replace(/[\x00-\x1f\x7f]/g, " ").trim().slice(0, 120) : "";
  if (!company) {
    return NextResponse.json({ error: "Please enter a company name" }, { status: 400 });
  }
  if (!hasSalaryData()) {
    return NextResponse.json({ error: "salary_data.json not found in the repo root" }, { status: 404 });
  }

  const r = await runPython(["salary_lookup.py", company, "--json"], { timeoutMs: 30_000 });
  if (!r.ok && !r.stdout.trim()) {
    return NextResponse.json(
      { error: r.stderr.trim().slice(0, 300) || `salary_lookup.py exited with code ${r.code}` },
      { status: 500 },
    );
  }
  // The tool prints a plain-text hint (not JSON) when nothing matches.
  const missMatch = r.stdout.match(/No results found for ['“]?([^'”\n]+)/i);
  if (missMatch) {
    return NextResponse.json(
      { error: `No salary data matches "${missMatch[1].trim()}" — try a shorter name, or check the demo companies in the Salary panel.` },
      { status: 404 },
    );
  }
  // stdout may carry the error JSON on the non-TTY path; fall back to stderr.
  const parsed =
    parseCliJson<SalaryEntry[] | { error: string }>(r.stdout) ??
    parseCliJson<SalaryEntry[] | { error: string }>(r.stderr);
  if (!parsed) {
    return NextResponse.json(
      { error: r.code === 1 && r.stdout.trim() ? r.stdout.trim().slice(0, 300) : "salary_lookup.py returned no parsable output" },
      { status: r.code === 1 ? 404 : 500 },
    );
  }
  if (!Array.isArray(parsed)) {
    const msg = typeof (parsed as { error?: string }).error === "string" ? (parsed as { error: string }).error : "Lookup failed";
    return NextResponse.json({ error: msg }, { status: 404 });
  }

  let metadata: Record<string, unknown> | null = null;
  try {
    metadata = (JSON.parse(fs.readFileSync(SALARY_FILE, "utf8")) as { metadata?: Record<string, unknown> }).metadata ?? null;
  } catch {
    /* metadata is cosmetic */
  }

  return NextResponse.json({
    query: company,
    matches: parsed,
    metadata,
  });
}
