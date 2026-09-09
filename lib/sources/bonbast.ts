/**
 * Bonbast.com — OPTIONAL secondary source, DISABLED BY DEFAULT.
 *
 * Why off by default: Bonbast's Terms of Service explicitly prohibit
 * scraping/crawling and redistribution of their data. Enable ONLY if you
 * have their permission (or a paid API subscription — see /webmaster):
 *   ENABLE_BONBAST=1
 *
 * Technical flow (reverse-engineered, verified 2026-09-09):
 *  1. GET https://www.bonbast.com/ → inline script contains
 *       .post('/json', {param: "HASH,SECRET,TIMESTAMP"}, …)
 *  2. POST https://www.bonbast.com/json  body {param} → JSON:
 *       { usd1, usd2, eur1, eur2, …, gol18, mithqal, ounce,
 *         azadi1, azadi12, emami1, emami12, …, bitcoin, last_modified, … }
 *     `*1` = sell, `*2` = buy. All IRR figures are in TOMAN.
 *     We use the SELL leg (*1) as the reference quote.
 */
import { fetchText, fetchJson, type SourceDump, type RawQuote } from "./http";
import { CATALOG } from "../catalog";
import { parsePrice } from "../format";

export function extractBonbastParam(html: string): string | null {
  const m = /\.post\(\s*['"]\/json['"]\s*,\s*\{param:\s*"([^"]+)"/.exec(html);
  return m?.[1] ?? null;
}

/** Pure parser for the /json payload (tests use fixtures). */
export function parseBonbastJson(doc: Record<string, unknown>, now = Date.now()): Record<string, RawQuote> {
  const out: Record<string, RawQuote> = {};
  for (const c of CATALOG) {
    const key = c.src.bonbast;
    if (!key) continue;
    // bitcoin/ounce are USD-denominated, everything else is toman.
    // Most keys have sell/buy legs (`usd1`/`usd2`); bitcoin & ounce are singular.
    const unit = key === "bitcoin" || key === "ounce" ? "USD" : ("IRT" as const);
    const v = parsePrice(
      (doc[`${key}1`] ?? doc[key]) as string | number | undefined,
    );
    if (v == null || !(v > 0)) continue;
    out[c.id] = { price: v, unit, time: now, changePct: null };
  }
  return out;
}

export async function fetchBonbast(enabled: boolean): Promise<SourceDump> {
  const started = Date.now();
  if (!enabled) {
    return { source: "bonbast", quotes: {}, ms: 0, error: "disabled (ToS: set ENABLE_BONBAST=1 only with permission)", skipped: true };
  }
  const home = await fetchText("https://www.bonbast.com/", { timeoutMs: 25000 });
  if (!home.ok || !home.data) {
    return { source: "bonbast", quotes: {}, ms: Date.now() - started, error: home.error };
  }
  const param = extractBonbastParam(home.data);
  if (!param) {
    return { source: "bonbast", quotes: {}, ms: Date.now() - started, error: "param-hash-not-found" };
  }
  const res = await fetchJson<Record<string, unknown>>("https://www.bonbast.com/json", {
    method: "POST",
    timeoutMs: 20000,
    headers: { "Content-Type": "application/json", Referer: "https://www.bonbast.com/" },
    body: JSON.stringify({ param }),
  });
  const ms = Date.now() - started;
  if (!res.ok || !res.data) return { source: "bonbast", quotes: {}, ms, error: res.error };
  try {
    return { source: "bonbast", quotes: parseBonbastJson(res.data), ms };
  } catch (e) {
    return { source: "bonbast", quotes: {}, ms, error: e instanceof Error ? e.message : "parse-failed" };
  }
}
