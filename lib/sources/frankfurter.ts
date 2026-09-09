/**
 * Frankfurter (ECB reference rates) — fiat cross-check in USD, no key.
 *  https://api.frankfurter.dev/v1/latest?base=USD
 * Rates are "1 USD = X CODE" → USD price of 1 unit = 1 / rate.
 * NOTE: ECB updates once daily (~16:00 CET); intraday moves are NOT
 * reflected. Used only as a stabilizing cross-check, never primary.
 */
import { fetchJson, type SourceDump, type RawQuote } from "./http";
import { CATALOG } from "../catalog";

interface FrankDoc {
  base: string;
  date: string;
  rates: Record<string, number>;
}

const CODES = CATALOG.filter((c) => c.src.frankfurter).map((c) => c.src.frankfurter as string);

export async function fetchFrankfurter(): Promise<SourceDump> {
  const started = Date.now();
  const url = `https://api.frankfurter.dev/v1/latest?base=USD&symbols=${CODES.join(",")}`;
  const res = await fetchJson<FrankDoc>(url, { timeoutMs: 15000 });
  const ms = Date.now() - started;
  if (!res.ok || !res.data?.rates) return { source: "frankfurter", quotes: {}, ms, error: res.error };
  const now = Date.now();
  const quotes: Record<string, RawQuote> = {};
  for (const c of CATALOG) {
    const code = c.src.frankfurter;
    if (!code) continue;
    const rate = res.data.rates[code];
    if (typeof rate !== "number" || !(rate > 0)) continue;
    quotes[c.id] = { price: 1 / rate, unit: "USD", time: now, changePct: null };
  }
  return { source: "frankfurter", quotes, ms };
}

/** Pure parser (tests). */
export function parseFrankfurter(doc: FrankDoc, now = Date.now()): Record<string, RawQuote> {
  const quotes: Record<string, RawQuote> = {};
  for (const c of CATALOG) {
    const code = c.src.frankfurter;
    if (!code) continue;
    const rate = doc.rates?.[code];
    if (typeof rate !== "number" || !(rate > 0)) continue;
    quotes[c.id] = { price: 1 / rate, unit: "USD", time: now, changePct: null };
  }
  return quotes;
}
