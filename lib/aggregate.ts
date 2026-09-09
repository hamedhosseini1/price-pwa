/**
 * Aggregation: normalize quotes → drop outliers → weighted mean.
 *
 *  1. Every quote is converted to the item's NATIVE unit and to per-1-unit
 *     (catalog `per`, e.g. JPY per 100). USD↔IRT conversion uses the live
 *     USD/IRT rate computed first from USD-quoting sources.
 *  2. Outlier rejection: with ≥3 quotes, drop any quote deviating more than
 *     OUTLIER_PCT (default 2.5%) from the median. Prevents a single stale
 *     source from skewing the average.
 *  3. Weighted mean with per-source weights (brsapi 3, tgju/coingecko/
 *     nobitex 2, frankfurter/bonbast 1).
 *  4. Change %: median of reported per-source changePct (same unit basis);
 *     falls back to null.
 */
import type { AggregatedItem, PriceUnit, Quote, Snapshot } from "./types";
import { CATALOG, type CatalogEntry } from "./catalog";
import type { RawQuote, SourceDump } from "./sources/http";

export const WEIGHTS: Record<string, number> = {
  brsapi: 3,
  tgju: 2,
  coingecko: 2,
  nobitex: 2,
  frankfurter: 1,
  bonbast: 1,
  twelvedata: 1,
};

export const OUTLIER_PCT = Number(process.env.OUTLIER_PCT ?? 2.5);

const median = (xs: number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/** Convert a raw quote to {priceNative} in the item's native unit, per-1-unit. */
function toNative(entry: CatalogEntry, q: RawQuote, usdIrt: number | null): number | null {
  let perOne = q.price / (q.per && q.per > 0 ? q.per : 1) / entry.per;
  if (!Number.isFinite(perOne) || !(perOne > 0)) return null;
  if (q.unit === entry.nativeUnit) return perOne;
  if (usdIrt == null || !(usdIrt > 0)) return null;
  return q.unit === "USD" ? perOne * usdIrt : perOne / usdIrt;
}

/** Compute the live USD→IRT (toman) anchor from USD-quoting sources. */
export function computeUsdIrt(dumps: SourceDump[]): { rate: number | null; source: string | null } {
  // Prefer BrsApi USD, then USDT_IRT, then tgju USD — median of available.
  const cands: { v: number; src: string }[] = [];
  for (const d of dumps) {
    const usd = d.quotes["USD"];
    if (usd && usd.unit === "IRT" && usd.price > 0) cands.push({ v: usd.price, src: d.source });
    const tether = d.quotes["USDT_IRT"];
    if (tether && tether.unit === "IRT" && tether.price > 0) cands.push({ v: tether.price, src: d.source });
  }
  if (cands.length === 0) return { rate: null, source: null };
  // Sanity filter: drop candidates >8% away from the median (protects the
  // anchor — every cross-currency conversion depends on it).
  const medAll = median(cands.map((c) => c.v));
  const sane = cands.filter((c) => (Math.abs(c.v - medAll) / medAll) * 100 <= 8);
  const pool = sane.length >= 1 ? sane : cands;
  // Majority vote on source priority: brsapi > tgju > others, then median.
  const prio: Record<string, number> = { brsapi: 0, tgju: 1 };
  pool.sort((a, b) => (prio[a.src] ?? 9) - (prio[b.src] ?? 9));
  const topSrc = pool[0].src;
  const topVals = pool.filter((c) => c.src === topSrc).map((c) => c.v);
  return { rate: median(topVals), source: topSrc };
}

export function aggregateItem(
  entry: CatalogEntry,
  dumps: SourceDump[],
  usdIrt: number | null,
): AggregatedItem {
  const natives: { price: number; weight: number; source: string }[] = [];
  const sources: Quote[] = [];
  const changes: number[] = [];
  let low: number | null = null;
  let high: number | null = null;
  let updatedAt = 0;

  for (const d of dumps) {
    const q = d.quotes[entry.id];
    if (!q) continue;
    const native = toNative(entry, q, usdIrt);
    if (native == null) continue;
    const w = WEIGHTS[d.source] ?? 1;
    natives.push({ price: native, weight: w, source: d.source });
    sources.push({ source: d.source, price: native, unit: entry.nativeUnit, time: q.time, changePct: q.changePct ?? null, changeValue: q.changeValue ?? null });
    if (q.changePct != null && Number.isFinite(q.changePct)) changes.push(q.changePct);
    // low/high → native unit
    const conv = (v: number | null | undefined) => {
      if (v == null || !Number.isFinite(v)) return null;
      let x = v / (q.per && q.per > 0 ? q.per : 1) / entry.per;
      if (q.unit !== entry.nativeUnit) {
        if (usdIrt == null || !(usdIrt > 0)) return null;
        x = q.unit === "USD" ? x * usdIrt : x / usdIrt;
      }
      return x;
    };
    const l = conv(q.low);
    const h = conv(q.high);
    if (l != null) low = low == null ? l : Math.min(low, l);
    if (h != null) high = high == null ? h : Math.max(high, h);
    updatedAt = Math.max(updatedAt, q.time);
  }

  // Outlier rejection vs median (3+ quotes), plus a hard guard for the
  // 2-quote case: if the two quotes disagree by >15%, averaging them would
  // produce a fiction (e.g. one frozen feed) → keep the higher-weight quote.
  let kept = natives;
  if (natives.length >= 3) {
    const med = median(natives.map((n) => n.price));
    const filtered = natives.filter((n) => (Math.abs(n.price - med) / med) * 100 <= OUTLIER_PCT);
    if (filtered.length >= 2) kept = filtered;
  } else if (natives.length === 2) {
    const [a, b] = natives;
    const dev = (Math.abs(a.price - b.price) / Math.min(a.price, b.price)) * 100;
    if (dev > 15) kept = [a.weight >= b.weight ? a : b];
  }

  let priceNative: number | null = null;
  if (kept.length > 0) {
    const wSum = kept.reduce((a, n) => a + n.weight, 0);
    priceNative = kept.reduce((a, n) => a + n.price * n.weight, 0) / wSum;
  }

  const toBoth = (p: number | null): { irt: number | null; usd: number | null } => {
    if (p == null) return { irt: null, usd: null };
    if (entry.nativeUnit === "IRT") {
      return { irt: p, usd: usdIrt ? p / usdIrt : null };
    }
    return { usd: p, irt: usdIrt ? p * usdIrt : null };
  };
  const { irt, usd } = toBoth(priceNative);

  return {
    id: entry.id,
    fa: entry.fa,
    en: entry.en,
    category: entry.category,
    badge: entry.badge,
    nativeUnit: entry.nativeUnit,
    priceIRT: irt,
    priceUSD: usd,
    changePct: changes.length ? median(changes) : null,
    changeValue: null, // derived below from changePct × price when possible
    low,
    high,
    updatedAt,
    sources,
    unavailable: priceNative == null,
  };
}

export function buildSnapshot(
  dumps: SourceDump[],
  extra?: { icons?: Record<string, string> },
): Snapshot {
  const { rate: usdIrt, source: usdIrtSource } = computeUsdIrt(dumps);
  const items = CATALOG.map((entry) => {
    const it = aggregateItem(entry, dumps, usdIrt);
    if (it.changePct != null) {
      const base = entry.nativeUnit === "IRT" ? it.priceIRT : it.priceUSD;
      it.changeValue = base != null ? (base * it.changePct) / 100 : null;
    }
    const icon = extra?.icons?.[entry.id];
    if (icon) it.icon = icon;
    return it;
  }).filter((it) => !it.unavailable);

  const sourceStatus: Snapshot["sourceStatus"] = {};
  for (const d of dumps) {
    sourceStatus[d.source] = {
      ok: !d.error,
      ms: d.ms,
      count: Object.keys(d.quotes).length,
      ...(d.error ? { error: d.error } : {}),
    };
  }
  return { generatedAt: Date.now(), usdIrt, usdIrtSource, items, sourceStatus };
}
