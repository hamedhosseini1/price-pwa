/**
 * Bot dialogue: command parsing, message formatting (fa digits), keyboards.
 * Pure functions — fully unit-tested, no Telegram I/O here.
 */
import { CATALOG, CATEGORY_FA, type CatalogEntry } from "../catalog";
import { formatNumber, formatPercent, parsePrice, timeAgo } from "../format";
import { btn, escapeHtml, type TgKeyboard } from "./client";
import type { TgCurrency } from "./store";
import type { AggregatedItem } from "../types";

/** fa/en/id (case-insensitive) → catalog entry. */
const LOOKUP = new Map<string, CatalogEntry>();
for (const c of CATALOG) {
  LOOKUP.set(c.id.toLowerCase(), c);
  LOOKUP.set(c.en.toLowerCase(), c);
  LOOKUP.set(c.fa, c);
}
/** fa/en/id (case-insensitive) → catalog entry. Falls back to substring
 *  match in catalog order (so «دلار» → USD, «سکه» → سکه امامی). */
export function resolveItem(q: string): CatalogEntry | null {
  const n = q.trim();
  const exact = LOOKUP.get(n) ?? LOOKUP.get(n.toLowerCase());
  if (exact) return exact;
  const nl = n.toLowerCase();
  return CATALOG.find((c) => c.fa.includes(n) || c.en.toLowerCase().includes(nl)) ?? null;
}

export interface ParsedCmd {
  cmd: string;
  args: string[];
}

/** "/price دلار@MyBot" → {cmd:"price", args:["دلار"]} */
export function parseCommand(text: string): ParsedCmd | null {
  const t = text.trim();
  if (!t.startsWith("/")) return null;
  const [head, ...args] = t.slice(1).split(/\s+/);
  return { cmd: head.split("@")[0].toLowerCase(), args };
}

export function priceText(v: number | null, cur: TgCurrency): string {
  if (v == null) return "—";
  return `${formatNumber(v, "fa")}${cur === "IRT" ? " تومان" : " دلار"}`;
}

export function changeText(pct: number | null): string {
  if (pct == null) return "بدون تغییر";
  const arrow = pct > 0 ? "🔺" : pct < 0 ? "🔻" : "➖";
  return `${arrow} ${formatPercent(pct, "fa")}`;
}

export function itemCard(it: AggregatedItem): string {
  const name = escapeHtml(it.fa);
  const en = escapeHtml(it.en);
  const cat = CATEGORY_FA[it.category];
  const irt = it.priceIRT != null ? formatNumber(it.priceIRT, "fa") : "—";
  const usd = it.priceUSD != null ? formatNumber(it.priceUSD, "fa") : "—";
  const lines = [
    `<b>${name}</b>`,
    `${en} · ${cat}`,
    ``,
    `💰 <b>${irt}</b> تومان`,
    `💵 <b>${usd}</b> دلار`,
    `${changeText(it.changePct)} <i>(۲۴ ساعته)</i>`,
  ];
  if (it.low != null && it.high != null) {
    lines.push(`کف/سقف روز: ${formatNumber(it.low, "fa")} / ${formatNumber(it.high, "fa")}`);
  }
  const srcs = it.sources.map((s) => escapeHtml(srcName(s.source))).join("، ");
  lines.push(`📊 منابع (${formatNumber(it.sources.length, "fa")}): ${srcs}`);
  lines.push(`🕗 ${timeAgo(it.updatedAt)}`);
  return lines.join("\n");
}

const SRC_FA: Record<string, string> = {
  brsapi: "BrsApi", tgju: "TGJU", coingecko: "CoinGecko",
  frankfurter: "ECB", nobitex: "Nobitex", bonbast: "Bonbast", twelvedata: "TwelveData",
};
function srcName(s: string): string {
  return SRC_FA[s] ?? s;
}

export function rowLine(it: AggregatedItem, cur: TgCurrency): string {
  const v = cur === "IRT" ? it.priceIRT : it.priceUSD;
  const arrow = it.changePct == null ? "" : it.changePct > 0 ? "🔺" : it.changePct < 0 ? "🔻" : "";
  return `${arrow} <b>${escapeHtml(it.fa)}</b>: ${v != null ? formatNumber(v, "fa") : "—"}${cur === "IRT" ? "" : " $"} <i>(${formatPercent(it.changePct, "fa")})</i>`;
}

// ── keyboards ──────────────────────────────────────────────────────────────
export function mainMenu(cur: TgCurrency): { text: string; kb: TgKeyboard } {
  return {
    text: `👋 به ربات <b>قیمت لحظه‌ای</b> خوش آمدی!\nدسته را انتخاب کن یا دستور بفرست (مثلاً <code>/price دلار</code>). واحد فعلی: <b>${cur === "IRT" ? "تومان" : "دلار"}</b>`,
    kb: {
      inline_keyboard: [
        [btn("💵 ارزها", "cat:currency"), btn("🥇 طلا و سکه", "cat:gold")],
        [btn("₿ کریپتو", "cat:crypto"), btn("🛢 نفت و انرژی", "cat:oil")],
        [btn(cur === "IRT" ? "💱 نمایش دلاری" : "💱 نمایش تومانی", "cur:toggle")],
        [btn("🔔 هشدارهای من", "alerts:list")],
      ],
    },
  };
}

export function categoryMenu(
  cat: string,
  items: AggregatedItem[],
  cur: TgCurrency,
  limit = 14,
): { text: string; kb: TgKeyboard } {
  const rows: { text: string; callback_data: string }[][] = [];
  const shown = items.slice(0, limit);
  for (let i = 0; i < shown.length; i += 2) {
    const r = shown.slice(i, i + 2).map((it) => btn(it.fa, `item:${it.id}`));
    rows.push(r);
  }
  rows.push([btn("🏠 منوی اصلی", "menu:main")]);
  const title = cat === "gold" ? "طلا و سکه و فلزات" : (CATEGORY_FA[cat as keyof typeof CATEGORY_FA] ?? cat);
  return {
    text: `📂 <b>${title}</b> — واحد: ${cur === "IRT" ? "تومان" : "دلار"}\nبرای جزئیات، آیتم را بزن:`,
    kb: { inline_keyboard: rows },
  };
}

export function itemNav(id: string): TgKeyboard {
  return {
    inline_keyboard: [
      [btn("🔔 هشدار برای این آیتم", `alert:new:${id}`)],
      [btn("↩ بازگشت", "menu:main")],
    ],
  };
}

export const HELP = [
  `<b>راهنمای ربات قیمت لحظه‌ای</b>`,
  ``,
  `/price <i>نام</i> — قیمت (مثلاً <code>/price دلار</code> یا <code>/price btc</code>)`,
  `/usd /eur /gold /coin /btc /xau /brent — قیمت سریع`,
  `/all — مهم‌ترین‌ها یکجا`,
  `/search <i>عبارت</i> — جستجو در همه آیتم‌ها`,
  `/convert <i>مقدار از به</i> — مثلاً <code>/convert 100 USD EUR</code>`,
  `/alert <i>آیتم above|below حد</i> — مثلاً <code>/alert BTC above 80000</code> (به دلار)`,
  `/alerts — لیست هشدارها · /delalert <i>شماره</i> — حذف`,
  `/menu — منوی دکمه‌ای · /cur — تغییر واحد تومان/دلار`,
].join("\n");

// ── /alert + /convert parsing ──────────────────────────────────────────────
export interface AlertParsed {
  ok: true;
  id: string;
  dir: "above" | "below";
  target: number;
}
export interface AlertFailed {
  ok: false;
  error: string;
}

const DIR_FA: Record<string, "above" | "below"> = {
  above: "above", below: "below", بالا: "above", بالاتر: "above",
  "بالاتر از": "above", پایین: "below", "پایین‌تر": "below", "پایینتر": "below",
};

export function parseAlertArgs(args: string[]): AlertParsed | AlertFailed {
  // forms: [ID, DIR, TARGET] or [ID, TARGET, DIR]? accept [.., dir, target] and [.., target, dir]
  if (args.length < 3) {
    return { ok: false, error: "قالب درست: <code>/alert دلار above 240000</code> (جهت: above/below یا بالا/پایین)" };
  }
  const targetIdx = args.findIndex((a) => parsePrice(a) != null && /[0-9۰-۹]/.test(a));
  if (targetIdx < 0) return { ok: false, error: "حد عددی پیدا نشد. مثال: <code>/alert BTC above 80000</code>" };
  const target = parsePrice(args[targetIdx])!;
  const rest = args.filter((_, i) => i !== targetIdx);
  const dirRaw = rest[rest.length - 1];
  const dir = DIR_FA[dirRaw] ?? DIR_FA[dirRaw.toLowerCase()];
  if (!dir) return { ok: false, error: "جهت باید above/below (یا بالا/پایین) باشد." };
  const entry = resolveItem(rest.slice(0, -1).join(" ") || rest[0]);
  if (!entry) return { ok: false, error: `آیتم «${escapeHtml(rest.slice(0, -1).join(" "))}» پیدا نشد. با /search جستجو کن.` };
  return { ok: true, id: entry.id, dir, target };
}

export interface ConvertParsed {
  ok: true;
  amount: number;
  from: CatalogEntry;
  to: CatalogEntry;
}

export function parseConvertArgs(args: string[]): ConvertParsed | AlertFailed {
  // "100 USD EUR" | "100 دلار یورو" | "1 BTC USD"
  if (args.length < 3) {
    return { ok: false, error: "قالب درست: <code>/convert 100 USD EUR</code> یا <code>/convert ۱۰۰ دلار یورو</code>" };
  }
  const amount = parsePrice(args[0]);
  if (amount == null || !(amount > 0)) return { ok: false, error: "مقدار اول باید عدد باشد." };
  // from = middle part (maybe multiword), to = last token... try longest from-match
  const rest = args.slice(1);
  for (let len = rest.length - 1; len >= 1; len--) {
    const from = resolveItem(rest.slice(0, len).join(" "));
    const to = resolveItem(rest.slice(len).join(" "));
    if (from && to) return { ok: true, amount, from, to };
  }
  return { ok: false, error: "آیتم مبدأ/مقصد پیدا نشد. مثال: <code>/convert 100 USD EUR</code>" };
}

export function convertText(amount: number, from: AggregatedItem, to: AggregatedItem): string {
  if (from.priceUSD == null || to.priceUSD == null || !(to.priceUSD > 0)) {
    return "قیمت لحظه‌ای یکی از آیتم‌ها در دسترس نیست.";
  }
  const out = (amount * from.priceUSD) / to.priceUSD;
  const rate = from.priceUSD / to.priceUSD;
  return (
    `🔄 <b>${formatNumber(amount, "fa")} ${escapeHtml(from.fa)}</b>\n` +
    `≈ <b>${formatNumber(out, "fa")}</b> ${escapeHtml(to.fa)}\n` +
    `<i>۱ ${escapeHtml(from.fa)} ≈ ${formatNumber(rate, "fa")} ${escapeHtml(to.fa)}</i>`
  );
}
