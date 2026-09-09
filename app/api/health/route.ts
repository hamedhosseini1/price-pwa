import { NextResponse } from "next/server";
import { getSnapshot, getSamples, getStoreHealth } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  const { snap, stale } = await getSnapshot();
  return NextResponse.json({
    ok: Boolean(snap),
    stale,
    now: Date.now(),
    ...getStoreHealth(),
    sources: snap?.sourceStatus ?? {},
    items: snap?.items.length ?? 0,
    usdIrt: snap?.usdIrt ?? null,
  });
}
