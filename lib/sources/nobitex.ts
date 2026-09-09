/**
 * Nobitex — crypto in IRT (public endpoint, no key).
 *  POST https://api.nobitex.ir/market/stats  (empty JSON body → all markets)
 *  stats keys look like "btc-rls" / "btc-irt" (rial) and "btc-usdt".
 * We take the IRT/Rial leg, convert rial → toman (/10), and compute the
 * 24h change from dayOpen when available.
 * NOTE: api.nobitex.ir does not resolve from some networks (observed
 * NXDOMAIN); failures degrade gracefully and are reported in sourceStatus.
 */
import { fetchJson, type SourceDump, type RawQuote } from "./http";
import { CATALOG } from "../catalog";

interface MarketStat {
  latest?: string | number;
  dayOpen?: string | number;
  dayLow?: string | number;
  dayHigh?: string | number;
  dayChange?: string | number;
}
interface StatsDoc {
  status?: string;
  stats?: Record<string, MarketStat>;
}

const norm = (s: string) => s.toLowerCase().replace(/[-_]/g, "");

/** catalog nobitex "BTC-IRT" → accepted stats-key variants. */
function variants(nob: string): string[] {
  const [base] = norm(nob).split("irt");
  return [`${base}irt`, `${base}rls`];
}

const WANT: { id: string; keys: string[] }[] = CATALOG.filter((c) => c.src.nobitex).map((c) => ({
  id: c.id,
  keys: variants(c.src.nobitex as string),
}));

const num = (v: string | number | undefined): number | null => {
  if (v == null) return null;
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
};

/** Pure parser (tests use fixtures). */
export function parseNobitex(doc: StatsDoc, now = Date.now()): Record<string, RawQuote> {
  const out: Record<string, RawQuote> = {};
  const stats = doc?.stats ?? {};
  const byKey: Record<string, MarketStat> = {};
  for (const [k, v] of Object.entries(stats)) byKey[norm(k)] = v;
  for (const w of WANT) {
    const st = w.keys.map((k) => byKey[k]).find(Boolean);
    if (!st) continue;
    const latestRial = num(st.latest);
    if (latestRial == null || !(latestRial > 0)) continue;
    const open = num(st.dayOpen);
    out[w.id] = {
      price: latestRial / 10, // rial → toman
      unit: "IRT",
      time: now,
      changePct: open ? ((latestRial - open) / open) * 100 : null,
      changeValue: open ? (latestRial - open) / 10 : null,
      low: (() => { const v = num(st.dayLow); return v != null ? v / 10 : null; })(),
      high: (() => { const v = num(st.dayHigh); return v != null ? v / 10 : null; })(),
    };
  }
  return out;
}

export async function fetchNobitex(): Promise<SourceDump> {
  const started = Date.now();
  const res = await fetchJson<StatsDoc>("https://api.nobitex.ir/market/stats", {
    method: "POST",
    timeoutMs: 20000,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  const ms = Date.now() - started;
  if (!res.ok || !res.data) return { source: "nobitex", quotes: {}, ms, error: res.error };
  try {
    return { source: "nobitex", quotes: parseNobitex(res.data), ms };
  } catch (e) {
    return { source: "nobitex", quotes: {}, ms, error: e instanceof Error ? e.message : "parse-failed" };
  }
}
