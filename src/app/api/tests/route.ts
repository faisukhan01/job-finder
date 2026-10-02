import { NextRequest, NextResponse } from "next/server";
import { getCachedSuite, isSuiteRunning, runSuite, type SuiteId } from "@/lib/job-search/status";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const VALID_SUITES: SuiteId[] = ["python", "lint", "typecheck", "cli"];

function isValidSuite(v: unknown): v is SuiteId {
  return typeof v === "string" && (VALID_SUITES as string[]).includes(v);
}

/** GET: current cached state for all suites (no execution). */
export async function GET() {
  return NextResponse.json({
    suites: VALID_SUITES.map((id) => ({
      id,
      running: isSuiteRunning(id),
      result: getCachedSuite(id),
    })),
  });
}

/** POST: run a suite (blocked while the same suite is already running). */
export async function POST(req: NextRequest) {
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const suite = body.suite;
  if (!isValidSuite(suite)) {
    return NextResponse.json({ error: `suite must be one of: ${VALID_SUITES.join(", ")}` }, { status: 400 });
  }
  if (isSuiteRunning(suite)) {
    return NextResponse.json({ error: `${suite} suite is already running`, running: true }, { status: 409 });
  }
  const result = await runSuite(suite);
  return NextResponse.json({ suite, running: false, result });
}
