/**
 * CoinGecko free API — crypto cross-check in USD (no key needed).
 *  - /simple/price for the snapshot (light, 1 call)
 *  - /coins/{id}/market_chart for history (used by history route)
 * Rate limit (free): ~5–15 calls/min → we call at most 1 snapshot call
 * per refresh + on-demand history calls.
 */
import { fetchJson, type SourceDump, type RawQuote } from "./http";
import { CATALOG, COINGECKO_MAP } from "../catalog";

const IDS = CATALOG.filter((c) => c.src.coingecko).map((c) => c.src.coingecko as string);

interface SimplePrice {
  [id: string]: { usd: number; usd_24h_change?: number };
}

export async function fetchCoinGecko(): Promise<SourceDump> {
  const started = Date.now();
  if (IDS.length === 0) return { source: "coingecko", quotes: {}, ms: 0 };
  const url =
    `https://api.coingecko.com/api/v3/simple/price?ids=${IDS.join(",")}` +
    `&vs_currencies=usd&include_24hr_change=true`;
  const res = await fetchJson<SimplePrice>(url, { timeoutMs: 20000 });
  const ms = Date.now() - started;
  if (!res.ok || !res.data) return { source: "coingecko", quotes: {}, ms, error: res.error };
  const now = Date.now();
  const quotes: Record<string, RawQuote> = {};
  for (const [id, v] of Object.entries(res.data)) {
    const cid = COINGECKO_MAP[id];
    if (!cid || typeof v?.usd !== "number" || !Number.isFinite(v.usd)) continue;
    quotes[cid] = {
      price: v.usd,
      unit: "USD",
      time: now,
      changePct: typeof v.usd_24h_change === "number" ? v.usd_24h_change : null,
    };
  }
  return { source: "coingecko", quotes, ms };
}

export interface MarketChart {
  prices: [number, number][];
}

/** History series for one coin, converted to [{t, price}]. */
export async function fetchCoinHistory(
  coingeckoId: string,
  days: number,
): Promise<{ t: number; price: number }[] | null> {
  const url =
    `https://api.coingecko.com/api/v3/coins/${coingeckoId}/market_chart` +
    `?vs_currency=usd&days=${days}`;
  const res = await fetchJson<MarketChart>(url, { timeoutMs: 20000 });
  if (!res.ok || !res.data?.prices) return null;
  return res.data.prices
    .filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]))
    .map(([t, price]) => ({ t, price }));
}

/** Pure parser (tests). */
export function parseSimplePrice(data: SimplePrice, now = Date.now()): Record<string, RawQuote> {
  const quotes: Record<string, RawQuote> = {};
  for (const [id, v] of Object.entries(data)) {
    const cid = COINGECKO_MAP[id];
    if (!cid || typeof v?.usd !== "number" || !Number.isFinite(v.usd)) continue;
    quotes[cid] = { price: v.usd, unit: "USD", time: now, changePct: v.usd_24h_change ?? null };
  }
  return quotes;
}
