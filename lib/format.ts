/**
 * Number / date formatting helpers with fa/en digit support.
 * fa → Intl 'fa-IR' (Persian digits, ٬ separators), en → 'en-US'.
 */

export type DigitMode = "fa" | "en";

const LOCALE: Record<DigitMode, string> = { fa: "fa-IR", en: "en-US" };

/** Choose fraction digits based on magnitude so small crypto prices stay readable. */
export function fractionDigits(value: number): number {
  const a = Math.abs(value);
  if (a === 0) return 0;
  if (a >= 1000) return 0;
  if (a >= 100) return 1;
  if (a >= 1) return 2;
  if (a >= 0.01) return 4;
  return 6;
}

export function formatNumber(value: number, digits: DigitMode = "fa", frac?: number): string {
  if (!Number.isFinite(value)) return "—";
  const f = frac ?? fractionDigits(value);
  return new Intl.NumberFormat(LOCALE[digits], {
    maximumFractionDigits: f,
    minimumFractionDigits: 0,
  }).format(value);
}

/** Signed number with explicit + / − (for change values). */
export function formatSigned(value: number, digits: DigitMode = "fa"): string {
  if (!Number.isFinite(value)) return "—";
  const abs = formatNumber(Math.abs(value), digits);
  if (value > 0) return `+${abs}`;
  if (value < 0) return digits === "fa" ? `−${abs}` : `-${abs}`;
  return abs;
}

export function formatPercent(value: number | null | undefined, digits: DigitMode = "fa"): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const sign = value > 0 ? "+" : value < 0 ? (digits === "fa" ? "−" : "-") : "";
  const body = new Intl.NumberFormat(LOCALE[digits], {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(Math.abs(value));
  return `${sign}${body}٪`.replace("٪", digits === "fa" ? "٪" : "%");
}

export function formatTime(ts: number, digits: DigitMode = "fa"): string {
  return new Intl.DateTimeFormat(LOCALE[digits], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(ts));
}

export function formatDateTime(ts: number, digits: DigitMode = "fa"): string {
  return new Intl.DateTimeFormat(LOCALE[digits], {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(ts));
}

/** "۳ دقیقه پیش" / "3 min ago"-style relative label (fa only, UI is Persian). */
export function timeAgo(ts: number, now = Date.now(), digits: DigitMode = "fa"): string {
  const s = Math.max(0, Math.round((now - ts) / 1000));
  const n = (v: number) => new Intl.NumberFormat(LOCALE[digits]).format(v);
  if (s < 10) return "لحظاتی پیش";
  if (s < 60) return `${n(s)} ثانیه پیش`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${n(m)} دقیقه پیش`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${n(h)} ساعت پیش`;
  return `${n(Math.floor(h / 24))} روز پیش`;
}

/** Parse strings like "2,325,000", "۲٬۳۲۵٬۰۰۰" or "68.83" into a number. */
export function parsePrice(raw: string | number | null | undefined): number | null {
  if (raw == null) return null;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  const faDigits = "۰۱۲۳۴۵۶۷۸۹";
  let s = raw.trim();
  for (let i = 0; i < 10; i++) s = s.split(faDigits[i]).join(String(i));
  s = s.replace(/[٬,،\s]/g, "").replace(/٫/g, ".");
  if (!/^[-+]?\d*\.?\d+$/.test(s)) return null;
  const v = parseFloat(s);
  return Number.isFinite(v) ? v : null;
}
