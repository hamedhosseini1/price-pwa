import { NextResponse } from "next/server";
import { getSnapshot, getSamples } from "@/lib/store";
import { CATALOG_BY_ID } from "@/lib/catalog";
import { fetchCoinHistory } from "@/lib/sources/coingecko";
import { fetchTgjuArchive } from "@/lib/sources/tgju";
import type { HistoryPoint, PriceUnit } from "@/lib/types";

export const dynamic = "force-dynamic";

type Range = "24h" | "7d" | "1m";
const RANGE_MS: Record<Range, number> = {
  "24h": 24 * 3600 * 1000,
  "7d": 7 * 24 * 3600 * 1000,
  "1m": 31 * 24 * 3600 * 1000,
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const id = decodeURIComponent(slug).toUpperCase();
  const entry = CATALOG_BY_ID[id];
  if (!entry) return NextResponse.json({ error: "unknown-item" }, { status: 404 });

  const url = new URL(_req.url);
  const range = (["24h", "7d", "1m"].includes(url.searchParams.get("range") ?? "")
    ? url.searchParams.get("range")
    : "24h") as Range;
  const currency = url.searchParams.get("currency") === "USD" ? "USD" : "IRT";

  const { snap } = await getSnapshot();
  const live = snap?.items.find((i) => i.id === id);
  const usdIrt = snap?.usdIrt ?? null;

  const since = Date.now() - RANGE_MS[range];
  const used: string[] = [];

  // 1) our own intraday sampler (native unit → requested currency)
  const pts: HistoryPoint[] = [];
  for (const s of getSamples(id, since)) {
    const v = currency === "IRT" ? s.irt : s.usd;
    if (v != null && v > 0) pts.push({ t: s.t, price: v });
  }
  if (pts.length) used.push("sampler");

  const conv = (v: number, from: PriceUnit): number | null => {
    if (from === currency) return v;
    if (usdIrt == null || !(usdIrt > 0)) return null;
    return from === "USD" ? v * usdIrt : v / usdIrt;
  };

  // 2) range backfill
  if (entry.src.coingecko && (range === "7d" || range === "1m" || pts.length < 2)) {
    const days = range === "24h" ? 1 : range === "7d" ? 7 : 30;
    const ch = await fetchCoinHistory(entry.src.coingecko, days);
    if (ch) {
      used.push("coingecko");
      for (const p of ch) {
        if (p.t < since) continue;
        const v = conv(p.price, "USD");
        if (v != null) pts.push({ t: p.t, price: v });
      }
    }
  } else if (range !== "24h" || pts.length < 2) {
    const slugs = entry.src.tgjuSlugs ?? [];
    // tgju archive is in toman (native IRT); ok for IRT-native items
    if (slugs.length && entry.nativeUnit === "IRT" && currency === "IRT") {
      const arch = await fetchTgjuArchive(slugs[0], range === "1m" ? 31 : 8);
      if (arch) {
        used.push("tgju-archive");
        for (const p of arch) if (p.t >= since) pts.push(p);
      }
    }
  }

  // 3) live point
  const liveV = live ? (currency === "IRT" ? live.priceIRT : live.priceUSD) : null;
  if (liveV != null && liveV > 0) pts.push({ t: Date.now(), price: liveV });

  pts.sort((a, b) => a.t - b.t);
  // dedupe to a sane resolution
  const maxPts = range === "24h" ? 300 : 400;
  const thin = pts.length > maxPts ? pts.filter((_, i) => i % Math.ceil(pts.length / maxPts) === 0) : pts;

  return NextResponse.json({
    id,
    range,
    unit: currency,
    nativeUnit: entry.nativeUnit,
    points: thin,
    sources: used,
  });
}
