"use client";
/** Shared UI: header, status bar, cards, tables, pills, PWA helpers. */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { AggregatedItem, Snapshot } from "@/lib/types";
import { useSettings, type Currency } from "@/lib/settings";
import { formatNumber, formatPercent, formatSigned, timeAgo, type DigitMode } from "@/lib/format";
import { CATEGORY_FA } from "@/lib/catalog";
import { APP_VERSION } from "@/lib/version";
import { Sparkline } from "./charts";
import { ItemIcon, Logo } from "./icons";

/* ── Price + change primitives ─────────────────────────────────────────── */
export function Price({ value, currency, big }: { value: number | null; currency: Currency; big?: boolean }) {
  const { digits } = useSettings();
  if (value == null) return <span>—</span>;
  return (
    <span className={big ? "card-price" : undefined} style={big ? undefined : { fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>
      {formatNumber(value, digits)}
      <span className="unit">{currency === "IRT" ? "تومان" : "$"}</span>
    </span>
  );
}

export function ChangePill({ value }: { value: number | null }) {
  if (value == null) return <span className="pill flat">—</span>;
  const cls = value > 0 ? "up" : value < 0 ? "down" : "flat";
  const arrow = value > 0 ? "▲" : value < 0 ? "▼" : "●";
  return (
    <span className={`pill ${cls}`}>
      {arrow} {formatPercent(value)}
    </span>
  );
}

/* ── Header ────────────────────────────────────────────────────────────── */
export function Header() {
  const { theme, setTheme, currency, setCurrency, digits, setDigits } = useSettings();
  const path = usePathname();
  return (
    <header className="header">
      <div className="header-inner">
        <Link href="/" className="brand">
          <Logo size={36} />
          <span className="t">قیمت لحظه‌ای</span>
        </Link>
        <nav className="nav-links">
          <Link href="/" className={path === "/" ? "active" : ""}>خانه</Link>
          <Link href="/converter" className={path === "/converter" ? "active" : ""}>مبدل و مقایسه</Link>
        </nav>
        <span className="header-spacer" />
        <div className="seg" role="group" aria-label="واحد نمایش">
          <button className={currency === "IRT" ? "active" : ""} onClick={() => setCurrency("IRT")}>تومان</button>
          <button className={currency === "USD" ? "active" : ""} onClick={() => setCurrency("USD")}>دلار</button>
        </div>
        <div className="seg" role="group" aria-label="فرمت اعداد">
          <button className={digits === "fa" ? "active" : ""} onClick={() => setDigits("fa")}>۱۲۳</button>
          <button className={digits === "en" ? "active" : ""} onClick={() => setDigits("en")}>123</button>
        </div>
        <button
          className="icon-btn"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          aria-label="تغییر تم"
          title={theme === "dark" ? "حالت روشن" : "حالت تیره"}
        >
          {theme === "dark" ? "☀" : "◐"}
        </button>
      </div>
    </header>
  );
}

/* ── Price card ────────────────────────────────────────────────────────── */
export function PriceCard({
  item,
  flash,
}: {
  item: AggregatedItem;
  flash?: "up" | "down";
}) {
  const { currency, favorites, toggleFavorite } = useSettings();
  const fav = favorites.includes(item.id);
  const v = currency === "IRT" ? item.priceIRT : item.priceUSD;
  const rangePct =
    item.low != null && item.high != null && item.high > item.low && v != null
      ? Math.min(100, Math.max(0, ((v - item.low) / (item.high - item.low)) * 100))
      : null;
  return (
    <div className={`card${flash === "up" ? " flash-up" : flash === "down" ? " flash-down" : ""}`}>
      <div className="card-top">
        <ItemIcon item={item} />
        <div className="card-name">
          <Link href={`/item/${item.id}`}>{item.fa}</Link>
          <small>
            {item.en} · {CATEGORY_FA[item.category]}
          </small>
        </div>
        <button
          className={`icon-btn star${fav ? " active" : ""}`}
          onClick={() => toggleFavorite(item.id)}
          aria-label="علاقه‌مندی"
          title="افزودن به علاقه‌مندی‌ها"
          style={{ width: 32, height: 32 }}
        >
          {fav ? "★" : "☆"}
        </button>
      </div>
      <Price value={v} currency={currency} big />
      <div className="card-meta">
        <ChangePill value={item.changePct} />
        <span>۲۴ ساعت</span>
      </div>
      <Sparkline id={item.id} up={item.changePct == null ? null : item.changePct >= 0} />
      {rangePct != null && (
        <div>
          <div className="range">
            <div className="range-fill" style={{ width: `${rangePct}%` }} />
          </div>
          <div className="range-lh">
            <span>{item.low != null ? <MiniNum v={item.low} /> : "—"}</span>
            <span>کف/سقف روز</span>
            <span>{item.high != null ? <MiniNum v={item.high} /> : "—"}</span>
          </div>
        </div>
      )}
      <div className="card-meta">
        <span>{item.sources.length} منبع</span>·<span>{timeAgo(item.updatedAt)}</span>
      </div>
    </div>
  );
}

function MiniNum({ v }: { v: number }) {
  const { digits } = useSettings();
  return <>{formatNumber(v, digits)}</>;
}

/* ── Sortable table (currencies) ───────────────────────────────────────── */
type SortKey = "fa" | "price" | "change";
export function PriceTable({ items }: { items: AggregatedItem[] }) {
  const { currency, digits, favorites, toggleFavorite } = useSettings();
  const [key, setKey] = useState<SortKey>("price");
  const [dir, setDir] = useState<1 | -1>(-1);
  const val = (i: AggregatedItem) => (currency === "IRT" ? i.priceIRT : i.priceUSD) ?? -Infinity;
  const rows = [...items].sort((a, b) => {
    if (key === "fa") return dir * a.fa.localeCompare(b.fa, "fa");
    if (key === "change") return dir * ((a.changePct ?? -Infinity) - (b.changePct ?? -Infinity));
    return dir * (val(a) - val(b));
  });
  const th = (label: string, k: SortKey, cls = "") => (
    <th
      className={cls}
      onClick={() => {
        if (key === k) setDir(dir === 1 ? -1 : 1);
        else {
          setKey(k);
          setDir(-1);
        }
      }}
    >
      {label} {key === k ? (dir === 1 ? "↑" : "↓") : ""}
    </th>
  );
  return (
    <>
      <div className="only-desktop">
    <div className="table-wrap">
      <div className="table-scroll">
        <table className="prices">
          <thead>
            <tr>
              <th style={{ cursor: "default" }}>★</th>
              {th("نام ارز", "fa")}
              {th(`قیمت (${currency === "IRT" ? "تومان" : "دلار"})`, "price", "num")}
              {th("تغییر ۲۴h", "change", "num")}
              <th className="num col-src" style={{ cursor: "default" }}>منابع</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((i) => (
              <tr key={i.id}>
                <td>
                  <button
                    className={`icon-btn${favorites.includes(i.id) ? " active" : ""}`}
                    style={{ width: 28, height: 28, fontSize: "0.9rem" }}
                    onClick={() => toggleFavorite(i.id)}
                    aria-label="علاقه‌مندی"
                  >
                    {favorites.includes(i.id) ? "★" : "☆"}
                  </button>
                </td>
                <td>
                  <Link href={`/item/${i.id}`} style={{ fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 12 }}>
                    <ItemIcon item={i} size={32} />
                    <span style={{ width: 150, textAlign: "start" }}>
                      {i.fa}
                      <div style={{ fontSize: "0.72rem", color: "var(--muted)", fontWeight: 400 }}>{i.en}</div>
                    </span>
                  </Link>
                </td>
                <td className="num" style={{ fontWeight: 800 }}>
                  {val(i) === -Infinity ? "—" : formatNumber(val(i), digits)}
                </td>
                <td className="num">
                  <ChangePill value={i.changePct} />
                </td>
                <td className="num col-src" style={{ color: "var(--muted)", fontSize: "0.8rem" }}>
                  {formatNumber(i.sources.length, digits)} · {timeAgo(i.updatedAt, Date.now(), digits)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
      </div>
      {/* mobile: stacked cards instead of the wide table */}
      <div className="only-mobile">
        <div className="row-flex" style={{ marginBottom: 10 }}>
          <label style={{ fontSize: "0.82rem", color: "var(--muted)" }}>مرتب‌سازی:</label>
          <select
            value={key}
            onChange={(e) => setKey(e.target.value as SortKey)}
            style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)" }}
          >
            <option value="price">قیمت</option>
            <option value="change">تغییر ۲۴ ساعته</option>
            <option value="fa">نام</option>
          </select>
          <button className="btn ghost small" onClick={() => setDir(dir === 1 ? -1 : 1)} aria-label="جهت مرتب‌سازی">
            {dir === 1 ? "↑ صعودی" : "↓ نزولی"}
          </button>
        </div>
        <div className="grid">
          {rows.map((it) => (
            <PriceCard key={it.id} item={it} />
          ))}
        </div>
      </div>
    </>
  );
}

/* ── Status bar ────────────────────────────────────────────────────────── */
const SRC_FA: Record<string, string> = {
  brsapi: "BrsApi",
  tgju: "TGJU",
  coingecko: "CoinGecko",
  frankfurter: "ECB",
  nobitex: "Nobitex",
  bonbast: "Bonbast",
};

export function StatusBar({
  snap,
  online,
  stale,
}: {
  snap: Snapshot | null;
  online: boolean;
  stale: boolean;
}) {
  const { digits } = useSettings();
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((x) => x + 1), 10_000);
    return () => clearInterval(t);
  }, []);
  return (
    <footer className="statusbar">
      <div className="statusbar-inner">
        <span>
          <span className={`dot ${online ? "ok" : "bad"}`} />
          {online ? "متصل" : "آفلاین"}
        </span>
        {snap && (
          <span>
            به‌روزرسانی: {timeAgo(snap.generatedAt, Date.now(), digits)}
            {stale && <span style={{ color: "var(--gold)" }}> (ممکن است قدیمی باشد)</span>}
          </span>
        )}
        {snap &&
          Object.entries(snap.sourceStatus).map(([k, s]) => (
            <span key={k} className="src-dot" title={s.error ?? `${s.count} آیتم · ${s.ms}ms`}>
              <span className={`dot ${s.ok ? "ok" : "bad"}`} />
              {SRC_FA[k] ?? k}
            </span>
          ))}
        <span style={{ marginInlineStart: "auto" }}>
          {snap ? `${formatNumber(snap.items.length, digits)} آیتم` : "در حال اتصال…"}
          {` · نسخه ${APP_VERSION}`}
        </span>
      </div>
    </footer>
  );
}

/* ── Skeleton ──────────────────────────────────────────────────────────── */
export function SkeletonGrid({ n = 8 }: { n?: number }) {
  return (
    <div className="grid">
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="card">
          <div className="row-flex">
            <div className="skel" style={{ width: 40, height: 40, borderRadius: 12 }} />
            <div className="skel" style={{ width: "55%", height: 16 }} />
          </div>
          <div className="skel" style={{ width: "70%", height: 26 }} />
          <div className="skel" style={{ width: "40%", height: 14 }} />
          <div className="skel" style={{ width: "100%", height: 36 }} />
        </div>
      ))}
    </div>
  );
}

/* ── Search ────────────────────────────────────────────────────────────── */
export function SearchBox({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="search">
      <span className="s-icon">⌕</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="جستجو: دلار، سکه، بیت‌کوین، نفت…"
        aria-label="جستجوی آیتم‌ها"
      />
    </div>
  );
}

/* ── PWA: service worker + install prompt ──────────────────────────────── */
export function PwaHelper() {
  const [installEvt, setInstallEvt] = useState<Event & { prompt: () => void } | null>(null);
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
    const h = (e: Event) => {
      e.preventDefault();
      setInstallEvt(e as Event & { prompt: () => void });
    };
    window.addEventListener("beforeinstallprompt", h);
    return () => window.removeEventListener("beforeinstallprompt", h);
  }, []);
  if (!installEvt) return null;
  return (
    <button
      className="btn accent small"
      style={{ position: "fixed", bottom: 52, insetInlineStart: 16, zIndex: 60 }}
      onClick={() => {
        installEvt.prompt();
        setInstallEvt(null);
      }}
    >
      ⬇ نصب اپلیکیشن
    </button>
  );
}
