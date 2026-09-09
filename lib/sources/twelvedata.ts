/**
 * TwelveData — OPTIONAL independent cross-check for oil (needs free key).
 *  https://twelvedata.com (free tier: 8 credits/min, 800 credits/day)
 *  Uses /time_series daily close (1 credit per symbol) for BRENT/USD + WTI/USD.
 *  Own TTL (5 min) keeps usage at ~576 credits/day worst case.
 *  Without TWELVEDATA_KEY this source is skipped silently.
 */
import { fetchJson, type SourceDump, type RawQuote } from "./http";

interface TDSeries {
  status?: string;
  code?: number;
  message?: string;
  values?: { datetime: string; close: string }[];
}

const SYMBOLS: Record<string, string> = { BRENT: "BRENT/USD", WTI: "WTI/USD" };

export function parseTwelveData(
  id: string,
  doc: TDSeries,
  now = Date.now(),
): RawQuote | null {
  const close = parseFloat(doc?.values?.[0]?.close ?? "");
  if (!Number.isFinite(close) || !(close > 0)) return null;
  void id;
  return { price: close, unit: "USD", time: now, changePct: null };
}

export async function fetchTwelveData(key: string | undefined): Promise<SourceDump> {
  const started = Date.now();
  if (!key) return { source: "twelvedata", quotes: {}, ms: 0, error: "missing-key (set TWELVEDATA_KEY)", skipped: true };
  const now = Date.now();
  const quotes: Record<string, RawQuote> = {};
  let firstError: string | undefined;
  for (const [id, symbol] of Object.entries(SYMBOLS)) {
    const url =
      `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(symbol)}` +
      `&interval=1day&outputsize=1&apikey=${encodeURIComponent(key)}`;
    const res = await fetchJson<TDSeries>(url, { timeoutMs: 15000 });
    if (!res.ok || !res.data) {
      firstError = firstError ?? res.error;
      if (res.status === 429) {
        return { source: "twelvedata", quotes, ms: Date.now() - started, error: "HTTP 429" };
      }
      continue;
    }
    const q = parseTwelveData(id, res.data, now);
    if (q) quotes[id] = q;
    else firstError = firstError ?? "bad-payload";
  }
  return {
    source: "twelvedata",
    quotes,
    ms: Date.now() - started,
    error: Object.keys(quotes).length ? undefined : firstError,
  };
}
