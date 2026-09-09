/**
 * Shared helpers for the Chrome extension (popup + background + options).
 * Pure functions only — safe to import in Node/vitest (no top-level chrome use).
 */

export const DEFAULT_BASE = "http://localhost:3000";
export const DEFAULT_IDS = ["USD", "EUR", "GOLD18", "COIN_EMAMI", "BTC", "XAU", "BRENT"];

/** catalogId → flag ISO (mirrors lib/catalog.ts FLAGS; served by the app). */
export const FLAG_ISO = {
  USD: "us", EUR: "eu", GBP: "gb", AED: "ae", TRY: "tr", CAD: "ca", AUD: "au",
  CHF: "ch", JPY: "jp", CNY: "cn", RUB: "ru", SAR: "sa", KWD: "kw", QAR: "qa",
  MYR: "my", INR: "in", PKR: "pk", IQD: "iq", SYP: "sy", SEK: "se",
  OMR: "om", BHD: "bh", AFN: "af", THB: "th", AZN: "az", AMD: "am", GEL: "ge",
};

/** Resolve an artwork path to an absolute URL on the app server. */
export function artUrl(path, base) {
  if (!path) return null;
  if (/^https?:\/\//.test(path)) return path;
  return `${base.replace(/\/+$/, "")}${path.startsWith("/") ? "" : "/"}${path}`;
}

/** Flag image URL for a fiat item (null when none). */
export function flagImg(id, base) {
  const iso = FLAG_ISO[id];
  return iso ? `${base.replace(/\/+$/, "")}/flags/${iso}.png` : null;
}

/** Compact badge text, e.g. 232546 → "233K" (badge fits ~4 chars). */
export function badgeText(toman) {
  if (!Number.isFinite(toman) || toman <= 0) return "";
  if (toman >= 1_000_000) return `${trimNum(toman / 1_000_000)}M`;
  if (toman >= 1000) return `${trimNum(toman / 1000)}K`;
  return String(Math.round(toman));
}

function trimNum(v) {
  const r = Math.round(v * 10) / 10;
  return Number.isInteger(r) ? String(r) : String(r);
}

const FA = "۰۱۲۳۴۵۶۷۸۹";
export function toFa(s) {
  return String(s).replace(/[0-9]/g, (d) => FA[+d]);
}

export function groupThousands(n, fa = true) {
  const neg = n < 0;
  let [i, f] = String(Math.abs(n)).split(".");
  i = i.replace(/\B(?=(\d{3})+(?!\d))/g, fa ? "٬" : ",");
  const out = f != null ? `${i}${fa ? "٫" : "."}${f}` : i;
  return (neg ? (fa ? "−" : "-") : "") + (fa ? toFa(out) : out);
}

/** Display price with adaptive decimals (mirrors lib/format.ts logic). */
export function fmtPrice(v, fa = true) {
  if (!Number.isFinite(v)) return "—";
  const a = Math.abs(v);
  const frac = a >= 1000 ? 0 : a >= 100 ? 1 : a >= 1 ? 2 : a >= 0.01 ? 4 : 6;
  const fixed = v.toFixed(frac);
  // group thousands of the integer part
  const [i, f] = fixed.split(".");
  const gi = i.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const out = f != null ? `${gi}.${f}` : gi;
  return fa ? toFa(out).replace(/,/g, "٬").replace(/\./g, "٫") : out;
}

export function fmtPct(v, fa = true) {
  if (v == null || !Number.isFinite(v)) return "—";
  const sign = v > 0 ? "+" : v < 0 ? (fa ? "−" : "-") : "";
  const body = Math.abs(v).toFixed(2);
  const pct = fa ? "٪" : "%";
  return `${sign}${fa ? toFa(body).replace(".", "٫") : body}${pct}`;
}

/** Pick items of interest from a /api/prices snapshot, in DEFAULT_IDS order. */
export function pickItems(snapshot, ids = DEFAULT_IDS) {
  if (!snapshot || !Array.isArray(snapshot.items)) return [];
  const byId = Object.fromEntries(snapshot.items.map((i) => [i.id, i]));
  return ids.map((id) => byId[id]).filter(Boolean);
}

/** USD item's toman price (for the badge). */
export function usdToman(snapshot) {
  const usd = snapshot?.items?.find((i) => i.id === "USD");
  return usd?.priceIRT ?? snapshot?.usdIrt ?? null;
}

export async function fetchSnapshot(base) {
  const url = `${base.replace(/\/+$/, "")}/api/prices`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/* ── storage wrappers (work in extension, degrade in tests) ─────────────── */
export function storageGet(keys) {
  if (typeof chrome !== "undefined" && chrome.storage?.local) {
    return chrome.storage.local.get(keys);
  }
  return Promise.resolve({});
}

export function storageSet(obj) {
  if (typeof chrome !== "undefined" && chrome.storage?.local) {
    return chrome.storage.local.set(obj);
  }
  return Promise.resolve();
}
