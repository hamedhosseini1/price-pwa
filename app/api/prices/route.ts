import { NextResponse } from "next/server";
import { getSnapshot } from "@/lib/store";

export const dynamic = "force-dynamic";

/** Aggregated live snapshot for the whole catalog. */
export async function GET() {
  try {
    const { snap, stale } = await getSnapshot();
    if (!snap) {
      return NextResponse.json(
        { error: "no-data", message: "Upstream sources unreachable on first load" },
        { status: 503 },
      );
    }
    return NextResponse.json(snap, {
      headers: {
        "Cache-Control": "public, max-age=10, stale-while-revalidate=30",
        "X-Snapshot-Stale": stale ? "1" : "0",
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: "internal", message: e instanceof Error ? e.message : "unknown" },
      { status: 500 },
    );
  }
}
