import { NextRequest, NextResponse } from "next/server";
import { getEnvStatus } from "@/lib/job-search/status";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const force = req.nextUrl.searchParams.get("force") === "1";
  const status = await getEnvStatus(force);
  return NextResponse.json(status);
}
