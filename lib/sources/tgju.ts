/**
 * Tgju.org — domestic cross-check (no key, polite scraping).
 *  - Snapshot: ONE GET of https://www.tgju.org/ homepage. The market table
 *    embeds every row as:
 *      <tr data-market-row="slug" data-price="2,325,000">
 *        <th>دلار</th><td class="nf">2,325,000</td>
 *        <td class="nf"><span class="high">(2.56%) 58,000</span></td>
 *        <td>2,276,600</td><td>2,328,200</td><td>۱۸:۳۴:۵۳</td>
 *    Columns: current | change | low | high | time.
 *    ⚠️ All tgju homepage prices are in RIAL → divided by 10 to toman.
 *  - History: api.tgju.org/v1/market/indicator/summary-table-data/{slug}
 *    (DataTables JSON, full daily archive).
 *  - Politeness: single request per refresh (≥30s), browser UA, no JS run.
 *    robots.txt permits crawling (only /events, /shop… disallowed).
 */
import { fetchText, fetchJson, type SourceDump, type RawQuote } from "./http";
import { CATALOG } from "../catalog";
import { parsePrice } from "../format";

const FA_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const normTitle = (s: string) => {
  let out = s;
  for (let i = 0; i < 10; i++) out = out.split(String(i)).join(FA_DIGITS[i]);
  return out.replace(/\s+/g, " ").trim();
};

export interface TgjuRow {
  slug: string;
  title: string;
  price: number | null;
  changePct: number | null;
  changeValue: number | null;
  low: number | null;
  high: number | null;
}

/** Parse the homepage market table. Pure (tests use fixtures).
 *  NOTE: tgju `<tr>` tags carry a huge data-title attribute that itself
 *  contains `>` characters, so naive `<tr[^>]*>` matching fails. We scan
 *  tags with a quote-aware pattern instead. */
export function parseTgjuHome(html: string): TgjuRow[] {
  const rows: TgjuRow[] = [];
  const tagRe = /<tr((?:"[^"]*"|'[^']*'|[^>"'])*)>/g;
  let m: RegExpExecArray | null;
  while ((m = tagRe.exec(html)) !== null) {
    const attrs = m[1];
    const slugM = /data-market-row="([^"]+)"/.exec(attrs);
    if (!slugM) continue;
    const priceAttr = /data-price="([^"]*)"/.exec(attrs);
    const end = html.indexOf("</tr>", m.index);
    if (end === -1) continue;
    const body = html.slice(m.index + m[0].length, end);
    const slug = slugM[1];
    const th = /<th[^>]*>([\s\S]*?)<\/th>/.exec(body);
    const title = normTitle(stripTags(th?.[1] ?? ""));
    const tds: string[] = [];
    const tdRe = /<td[^>]*>([\s\S]*?)<\/td>/g;
    let tm: RegExpExecArray | null;
    while ((tm = tdRe.exec(body)) !== null) tds.push(stripTags(tm[1]).trim());
    // tds: [current, change, low, high, time, (chart)]
    // data-price attr is authoritative for the current price; fall back to td[0]
    const price = parsePrice(priceAttr?.[1] ?? "") ?? parsePrice(tds[0]);
    const ch = parseChangeCell(body);
    rows.push({
      slug,
      title,
      price,
      changePct: ch.pct,
      changeValue: ch.value,
      low: parsePrice(tds[2]),
      high: parsePrice(tds[3]),
    });
  }
  return rows;
}

function stripTags(s: string): string {
  return s.replace(/<[^>]*>/g, "");
}

function parseChangeCell(trBody: string): { pct: number | null; value: number | null } {
  // e.g. <span class="high">(2.56%) 58,000</span> or <span class="low">…</span> or "-"
  const m = /<span class="(high|low)"[^>]*>\(?\s*([\d.,]+)%\)?\s*([-\d.,٬۰-۹]+)?/.exec(trBody);
  if (!m) return { pct: null, value: null };
  const pct = parseFloat(m[2].replace(/,/g, ""));
  const value = m[3] != null ? parsePrice(m[3]) : null;
  const signed = m[1] === "low" ? -1 : 1;
  return {
    pct: Number.isFinite(pct) ? signed * pct : null,
    value: value != null ? signed * Math.abs(value) : null,
  };
}

/** Map rows → catalog ids. Slug allowlist wins; else longest title keyword wins.
 *  A slug match is never overwritten by a later title-only match (e.g. the
 *  free-market dollar row beats SANA rows that also contain "دلار").
 *  Unit rule: tgju quotes IRT-native items in RIAL (÷10 → toman);
 *  USD-native items (ounce, oil…) are already quoted in USD on tgju. */
export function mapTgjuRows(rows: TgjuRow[]): Record<string, RawQuote> {
  const out: Record<string, RawQuote> = {};
  const quality: Record<string, number> = {};
  const now = Date.now();
  for (const row of rows) {
    if (row.price == null || !(row.price > 0)) continue;
    let best: { entry: (typeof CATALOG)[number]; score: number } | null = null;
    for (const c of CATALOG) {
      if (c.src.tgjuSlugs?.includes(row.slug)) {
        best = { entry: c, score: 1000 };
        break; // slug is authoritative
      }
      for (const kw of c.src.tgjuTitles ?? []) {
        if (!kw || !row.title.includes(kw)) continue;
        // exact title match outranks partial ('تتر' beats 'تتر گلد' for USDT)
        const score = row.title === kw ? 500 : kw.length;
        if (!best || score > best.score) best = { entry: c, score };
      }
    }
    if (!best) continue;
    // SANA (official-rate) rows are NOT free-market prices → skip them
    // entirely, except rows explicitly allowlisted by slug (e.g. NIMA).
    if (row.slug.startsWith("sana_") && !(best.entry.src.tgjuSlugs?.includes(row.slug))) continue;
    if ((quality[best.entry.id] ?? -1) > best.score) continue; // keep stronger match
    quality[best.entry.id] = best.score;
    const nativeUSD = best.entry.nativeUnit === "USD";
    out[best.entry.id] = {
      price: nativeUSD ? row.price : row.price / 10,
      unit: nativeUSD ? "USD" : "IRT",
      time: now,
      changePct: row.changePct,
      changeValue: row.changeValue != null ? (nativeUSD ? row.changeValue : row.changeValue / 10) : null,
      low: row.low != null ? (nativeUSD ? row.low : row.low / 10) : null,
      high: row.high != null ? (nativeUSD ? row.high : row.high / 10) : null,
    };
  }
  return out;
}

export async function fetchTgju(): Promise<SourceDump> {
  const started = Date.now();
  const res = await fetchText("https://www.tgju.org/", { timeoutMs: 25000 });
  const ms = Date.now() - started;
  if (!res.ok || !res.data) return { source: "tgju", quotes: {}, ms, error: res.error };
  try {
    return { source: "tgju", quotes: mapTgjuRows(parseTgjuHome(res.data)), ms };
  } catch (e) {
    return { source: "tgju", quotes: {}, ms, error: e instanceof Error ? e.message : "parse-failed" };
  }
}

// ── Daily archive (history route) ────────────────────────────────────────────
interface ArchiveDoc {
  data?: (string | number)[][];
}

/**
 * Daily history for a tgju slug. Columns observed:
 * [?, ?, ?, close, changeHtml, changePctHtml, gregDate, jdate].
 * Uses the 4th price column (پایانی/close) + gregorian date.
 */
export async function fetchTgjuArchive(
  slug: string,
  limit = 31,
): Promise<{ t: number; price: number }[] | null> {
  const url = `https://api.tgju.org/v1/market/indicator/summary-table-data/${slug}`;
  const res = await fetchJson<ArchiveDoc>(url, {
    timeoutMs: 20000,
    headers: { Referer: "https://www.tgju.org/" },
  });
  if (!res.ok || !Array.isArray(res.data?.data)) return null;
  const pts: { t: number; price: number }[] = [];
  for (const row of res.data.data) {
    const price = parsePrice(String(row[3] ?? "")); // rial → toman below
    const t = Date.parse(String(row[6] ?? "") + "T12:00:00Z");
    if (price != null && price > 0 && Number.isFinite(t)) pts.push({ t, price: price / 10 });
    if (pts.length >= limit) break;
  }
  return pts.reverse(); // archive is newest-first → chronological
}
