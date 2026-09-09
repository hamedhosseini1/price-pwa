"use client";
/** Item detail: big price, chart (24h/7d/1m), stats, alerts, per-source table. */
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { usePrices } from "@/hooks/usePrices";
import { useSettings } from "@/lib/settings";
import type { HistoryPoint } from "@/lib/types";
import { CATEGORY_FA, CATALOG_BY_ID } from "@/lib/catalog";
import { formatNumber, formatPercent, formatTime, timeAgo } from "@/lib/format";
import { Header, StatusBar, ChangePill, PwaHelper } from "@/components/ui";
import { ItemIcon } from "@/components/icons";
import { DetailChart } from "@/components/charts";

type Range = "24h" | "7d" | "1m";

const SRC_FA: Record<string, string> = {
  brsapi: "BrsApi", tgju: "TGJU", coingecko: "CoinGecko",
  frankfurter: "ECB", nobitex: "Nobitex", bonbast: "Bonbast",
};

export default function ItemPage() {
  const { slug } = useParams<{ slug: string }>();
  const id = decodeURIComponent(slug ?? "").toUpperCase();
  const entry = CATALOG_BY_ID[id];
  const { snap, loading, online, stale } = usePrices();
  const { currency, digits, favorites, toggleFavorite, alerts, addAlert, removeAlert } = useSettings();
  const [range, setRange] = useState<Range>("24h");
  const [pts, setPts] = useState<HistoryPoint[] | null>(null);
  const [ptsLoading, setPtsLoading] = useState(false);
  const [target, setTarget] = useState("");
  const [dir, setDir] = useState<"above" | "below">("above");
  const [notif, setNotif] = useState<string | null>(null);

  const item = snap?.items.find((i) => i.id === id);

  useEffect(() => {
    let dead = false;
    setPtsLoading(true);
    fetch(`/api/history/${id}?range=${range}&currency=${currency}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!dead) setPts(j?.points ?? []);
      })
      .catch(() => {
        if (!dead) setPts([]);
      })
      .finally(() => {
        if (!dead) setPtsLoading(false);
      });
    return () => {
      dead = true;
    };
  }, [id, range, currency]);

  const v = item ? (currency === "IRT" ? item.priceIRT : item.priceUSD) : null;
  const fav = favorites.includes(id);
  const myAlerts = alerts.filter((a) => a.id === id);

  const askNotif = async () => {
    try {
      if (!("Notification" in window)) {
        setNotif("مرورگر شما از اعلان پشتیبانی نمی‌کند.");
        return;
      }
      const p = await Notification.requestPermission();
      setNotif(p === "granted" ? "اعلان‌ها فعال شد." : "دسترسی اعلان داده نشد؛ هشدارها فقط داخل اپ نمایش داده می‌شوند.");
    } catch {
      setNotif("خطا در فعال‌سازی اعلان.");
    }
  };

  if (!entry) {
    return (
      <>
        <Header />
        <main className="container">
          <div className="empty">
            <div className="big">؟</div>آیتم «{id}» شناخته نشد. <Link href="/">بازگشت به خانه</Link>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Header />
      <main className="container">
        <div className="breadcrumb">
          <Link href="/">خانه</Link> / {CATEGORY_FA[entry.category]} / {entry.fa}
        </div>

        <div className="panel">
          <div className="row-flex">
            {item ? <ItemIcon item={item} size={48} /> : <span className="badge" style={{ width: 48, height: 48, fontSize: "1rem" }}>{entry.badge}</span>}
            <div>
              <h1 style={{ margin: 0, fontSize: "1.3rem" }}>{entry.fa}</h1>
              <div style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
                {entry.en} · قیمت به {currency === "IRT" ? "تومان" : "دلار"}
              </div>
            </div>
            <span className="header-spacer" />
            <button className={`icon-btn${fav ? " active" : ""}`} onClick={() => toggleFavorite(id)} aria-label="علاقه‌مندی">
              {fav ? "★" : "☆"}
            </button>
          </div>

          {loading || !item ? (
            <div className="skel mt" style={{ height: 52 }} />
          ) : (
            <div className="row-flex mt">
              <span style={{ fontSize: "clamp(1.3rem, 6vw, 2rem)", fontWeight: 900, fontVariantNumeric: "tabular-nums", overflowWrap: "anywhere" }}>
                {v == null ? "—" : formatNumber(v, digits)}
                <span style={{ fontSize: "0.9rem", fontWeight: 400, color: "var(--muted)", marginInlineStart: 6 }}>
                  {currency === "IRT" ? "تومان" : "$"}
                </span>
              </span>
              <ChangePill value={item.changePct} />
              <small style={{ color: "var(--muted)" }}>
                {item.changePct != null && item.changeValue != null && (
                  <>
                    ({formatNumber(Math.abs(item.changeValue), digits)} {currency === "IRT" ? "تومان" : "$"})
                  </>
                )}
              </small>
            </div>
          )}

          <div className="row-flex mt">
            <div className="seg" role="group" aria-label="بازه نمودار">
              {(["24h", "7d", "1m"] as Range[]).map((r) => (
                <button key={r} className={range === r ? "active" : ""} onClick={() => setRange(r)}>
                  {r === "24h" ? "۲۴ ساعت" : r === "7d" ? "هفته" : "ماه"}
                </button>
              ))}
            </div>
          </div>
          <div className="mt">
            {ptsLoading || !pts ? <div className="skel" style={{ height: 260 }} /> : <DetailChart points={pts} />}
          </div>

          {item && (
            <div className="stat-row">
              <div className="stat"><div className="k">کف روز</div><div className="v">{item.low != null ? formatNumber(item.low, digits) : "—"}</div></div>
              <div className="stat"><div className="k">سقف روز</div><div className="v">{item.high != null ? formatNumber(item.high, digits) : "—"}</div></div>
              <div className="stat"><div className="k">تغییر ۲۴h</div><div className="v">{item.changePct != null ? formatPercent(item.changePct, digits) : "—"}</div></div>
              <div className="stat"><div className="k">آخرین به‌روزرسانی</div><div className="v">{formatTime(item.updatedAt, digits)}</div></div>
            </div>
          )}
        </div>

        {/* alerts */}
        <div className="panel">
          <h2>هشدار قیمت</h2>
          <p style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
            وقتی قیمت {entry.fa} به حد تعیین‌شده برسد، اعلان نمایش داده می‌شود (در همین دستگاه).
          </p>
          <div className="row-flex">
            <div className="seg">
              <button className={dir === "above" ? "active" : ""} onClick={() => setDir("above")}>بالاتر از</button>
              <button className={dir === "below" ? "active" : ""} onClick={() => setDir("below")}>پایین‌تر از</button>
            </div>
            <input
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder={`حد به ${currency === "IRT" ? "تومان" : "دلار"}`}
              inputMode="decimal"
              style={{ padding: "9px 14px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", maxWidth: 200 }}
            />
            <button
              className="btn accent small"
              onClick={() => {
                const t = parseFloat(target.replace(/[,٬]/g, ""));
                if (!Number.isFinite(t) || t <= 0) {
                  setNotif("حد معتبر وارد کنید.");
                  return;
                }
                addAlert({ id, dir, target: t, currency });
                setTarget("");
                setNotif("هشدار ثبت شد.");
              }}
            >
              ثبت هشدار
            </button>
            <button className="btn ghost small" onClick={askNotif}>فعال‌سازی اعلان مرورگر</button>
          </div>
          {notif && <p style={{ fontSize: "0.82rem", color: "var(--accent)" }}>{notif}</p>}
          {myAlerts.length > 0 && (
            <ul style={{ paddingInlineStart: 18, fontSize: "0.88rem" }}>
              {myAlerts.map((a, i) => (
                <li key={i}>
                  {a.dir === "above" ? "بالاتر از" : "پایین‌تر از"} {formatNumber(a.target, digits)}{" "}
                  {a.currency === "IRT" ? "تومان" : "دلار"}
                  {a.fired ? " (فعال شد ✓)" : ""}
                  <button
                    className="btn ghost small"
                    style={{ marginInlineStart: 8 }}
                    onClick={() => removeAlert(a.id, a.target, a.dir)}
                  >
                    حذف
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* sources */}
        <div className="panel">
          <h2>شفافیت منابع ({item?.sources.length ?? 0})</h2>
          {!item ? (
            <div className="skel" style={{ height: 80 }} />
          ) : (
            <div className="table-wrap">
              <div className="table-scroll">
                <table className="prices">
                  <thead>
                    <tr>
                      <th style={{ cursor: "default" }}>منبع</th>
                      <th className="num" style={{ cursor: "default" }}>قیمت (واحد اصلی)</th>
                      <th className="num" style={{ cursor: "default" }}>تغییر ۲۴h</th>
                      <th className="num" style={{ cursor: "default" }}>زمان</th>
                    </tr>
                  </thead>
                  <tbody>
                    {item.sources.map((s) => (
                      <tr key={s.source}>
                        <td style={{ fontWeight: 700 }}>{SRC_FA[s.source] ?? s.source}</td>
                        <td className="num">{formatNumber(s.price, digits)}</td>
                        <td className="num"><ChangePill value={s.changePct ?? null} /></td>
                        <td className="num" style={{ color: "var(--muted)", fontSize: "0.8rem" }}>{timeAgo(s.time, Date.now(), digits)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          <p style={{ fontSize: "0.78rem", color: "var(--muted)" }}>
            قیمت نهایی، میانگین وزنی منابع پس از حذف داده‌های پرت است. جزئیات روش در مستندات پروژه.
          </p>
        </div>
      </main>
      <StatusBar snap={snap} online={online} stale={stale} />
      <PwaHelper />
    </>
  );
}
