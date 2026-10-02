import { NextResponse } from "next/server";
import { PORTALS } from "@/lib/job-search/portals";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    portals: PORTALS.map((p) => ({
      id: p.id,
      name: p.name,
      board: p.board,
      market: p.market,
      description: p.description,
      requiresLocation: p.requiresLocation,
      supportsJobAge: p.supportsJobAge,
    })),
  });
}
