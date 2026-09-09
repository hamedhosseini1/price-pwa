/**
 * BrsApi.ir — PRIMARY source (free tier, requires free API key).
 *
 *  - Snapshot: Gold_Currency.php (gold/coins + 28 fiats + 19 cryptos)
 *              + Commodity.php (XAU/XAG/XPT/XPD + Brent/WTI/gas)
 *  - Free quota: 1500 req/day → our 30–60s refresh uses ~3–6k/day for 2
 *    endpoints, so the default REFRESH (60s when only BrsApi) stays in quota.
 *  - Key from env BRSAPI_KEY. Without a key this source is skipped and the
 *    aggregator falls back to tgju + coingecko + frankfurter.
 *
 * Docs: https://brsapi.ir/free-api-gold-currency-webservice/
 */
import { fetchJson, type SourceDump, type RawQuote } from "./http";
import { BRS_MAP } from "../catalog";
import { parsePrice } from "../format";

interface BrsItem {
  symbol: string;
  price: number | string;
  unit?: string;
  time_unix?: number;
  date?: string;
  time?: string;
  change_percent?: number | string | null;
  change_value?: number | string | null;
}

type BrsDoc = Record<string, BrsItem[]>;

const BASE = "https://api.brsapi.ir/Market";

function toQuotes(doc: BrsDoc, now: number): Record<string, RawQuote> {
  const out: Record<string, RawQuote> = {};
  for (const items of Object.values(doc)) {
    if (!Array.isArray(items)) continue;
    for (const it of items) {
      const id = BRS_MAP[it.symbol];
      // NOTE: BrsApi mixes types — fiat/gold prices are JSON numbers but
      // crypto prices are JSON strings ("78571"). Coerce via parsePrice.
      const price = typeof it.price === "number" ? it.price : parsePrice(it.price);
      if (!id || price == null || !(price > 0)) continue;
      const unit: "IRT" | "USD" = it.unit === "دلار" ? "USD" : "IRT";
      const pct = typeof it.change_percent === "number" ? it.change_percent : parsePrice(it.change_percent ?? "");
      const cval = typeof it.change_value === "number" ? it.change_value : parsePrice(it.change_value ?? "");
      out[id] = {
        price,
        unit,
        time: it.time_unix ? it.time_unix * 1000 : now,
        changePct: pct,
        changeValue: cval,
      };
    }
  }
  return out;
}

export async function fetchBrsApi(key: string | undefined): Promise<SourceDump> {
  const started = Date.now();
  if (!key) {
    return { source: "brsapi", quotes: {}, ms: 0, error: "missing-key (set BRSAPI_KEY)", skipped: true };
  }
  const [gold, commodity] = await Promise.all([
    fetchJson<BrsDoc>(`${BASE}/Gold_Currency.php?key=${encodeURIComponent(key)}`, { timeoutMs: 20000 }),
    fetchJson<BrsDoc>(`${BASE}/Commodity.php?key=${encodeURIComponent(key)}`, { timeoutMs: 20000 }),
  ]);
  const ms = Date.now() - started;
  const now = Date.now();
  if (!gold.ok && !commodity.ok) {
    const err429 = gold.error === "HTTP 429" || commodity.error === "HTTP 429";
    return {
      source: "brsapi",
      quotes: {},
      ms,
      error: err429 ? "HTTP 429" : (gold.error ?? commodity.error ?? "fetch-failed"),
    };
  }
  const quotes = {
    ...(gold.ok && gold.data ? toQuotes(gold.data, now) : {}),
    ...(commodity.ok && commodity.data ? toQuotes(commodity.data, now) : {}),
  };
  const partial = !gold.ok || !commodity.ok;
  return {
    source: "brsapi",
    quotes,
    ms,
    error: partial ? `partial (${!gold.ok ? "gold:" + gold.error : ""} ${!commodity.ok ? "commodity:" + commodity.error : ""}`.trim() : undefined,
  };
}

/** Pure parser (used by tests with fixtures). */
export function parseBrsDoc(doc: BrsDoc, now = Date.now()): Record<string, RawQuote> {
  return toQuotes(doc, now);
}
