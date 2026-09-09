"use client";
/** Converter (any → any at live rates) + side-by-side normalized comparison. */
import { useEffect, useMemo, useState } from "react";
import { usePrices } from "@/hooks/usePrices";
import { useSettings } from "@/lib/settings";
import { CATALOG } from "@/lib/catalog";
import { formatNumber } from "@/lib/format";
import { Header, StatusBar, PwaHelper } from "@/components/ui";
import { CompareChart, type CmpSeries } from "@/components/charts";
import type { HistoryPoint } from "@/lib/types";

export default function ConverterPage() {
  const { snap, loading, online, stale } = usePrices();
  const { currency, digits } = useSettings();
  const [amount, setAmount] = useState("1");
  const [from, setFrom] = useState("USD");
  const [to, setTo] = useState("EUR");
  const [cmp, setCmp] = useState<string[]>(["BTC", "XAU", "USD"]);
  const [range, setRange] = useState<"7d" | "1m">("7d");
  const [series, setSeries] = useState<CmpSeries[]>([]);
  const [cmpLoading, setCmpLoading] = useState(false);

  const byId = useMemo(() => Object.fromEntries((snap?.items ?? []).map((i) => [i.id, i])), [snap]);

  // conversion always in a common unit (USD), then displayed in chosen currency
  const result = useMemo(() => {
    const a = parseFloat(amount.replace(/[,٬]/g, ""));
    const f = byId[from];
    const t = byId[to];
    if (!Number.isFinite(a) || !f || !t) return null;
    const fUsd = f.priceUSD;
    const tUsd = t.priceUSD;
    if (fUsd == null || tUsd == null || tUsd <= 0) return null;
    const outUsd = (a * fUsd) / tUsd;
    const usdIrt = snap?.usdIrt;
    const out = currency === "IRT" ? (usdIrt ? outUsd * usdIrt : null) : outUsd;
    const rateSame = fUsd / tUsd; // 1 from = X to (unit-agnostic)
    return { out, rateSame };
  }, [amount, from, to, byId, currency, snap?.usdIrt]);

  useEffect(() => {
    let dead = false;
    setCmpLoading(true);
    Promise.all(
      cmp.map((id) =>
        fetch(`/api/history/${id}?range=${range}&currency=${currency}`, { cache: "no-store" })
          .then((r) => (r.ok ? r.json() : null))
          .then((j) => ({
            label: byId[id]?.fa ?? id,
            points: (j?.points ?? []) as HistoryPoint[],
          }))
          .catch(() => ({ label: id, points: [] as HistoryPoint[] })),
      ),
    )
      .then((s) => {
        if (!dead) setSeries(s.filter((x) => x.points.length > 1));
      })
      .finally(() => {
        if (!dead) setCmpLoading(false);
      });
    return () => {
      dead = true;
    };
  }, [cmp, range, currency, snap?.generatedAt]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleCmp = (id: string) =>
    setCmp((c) => (c.includes(id) ? c.filter((x) => x !== id) : c.length >= 4 ? c : [...c, id]));

  const opts = CATALOG.filter((c) => byId[c.id]);

  return (
    <>
      <Header />
      <main className="container">
        <div className="breadcrumb">خانه / مبدل و مقایسه</div>

        <div className="panel">
          <h2>مبدل قیمت (نرخ لحظه‌ای)</h2>
          {loading || !snap ? (
            <div className="skel" style={{ height: 120 }} />
          ) : (
            <>
              <div className="row-flex">
                <div className="field" style={{ flex: "1 1 160px" }}>
                  <label>مقدار</label>
                  <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" dir="ltr" style={{ textAlign: "center" }} />
                </div>
                <div className="field" style={{ flex: "2 1 200px" }}>
                  <label>از</label>
                  <select value={from} onChange={(e) => setFrom(e.target.value)}>
                    {opts.map((c) => (
                      <option key={c.id} value={c.id}>{c.fa}</option>
                    ))}
                  </select>
                </div>
                <div className="field" style={{ flex: "2 1 200px" }}>
                  <label>به</label>
                  <select value={to} onChange={(e) => setTo(e.target.value)}>
                    {opts.map((c) => (
                      <option key={c.id} value={c.id}>{c.fa}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="stat" style={{ marginTop: 8 }}>
                <div className="k">نتیجه ({currency === "IRT" ? "تومان" : "دلار"})</div>
                <div className="v" style={{ fontSize: "1.5rem" }}>
                  {result?.out == null ? "—" : formatNumber(result.out, digits)}
                </div>
                {result && (
                  <div className="k">
                    ۱ {byId[from]?.fa} ≈ {formatNumber(result.rateSame, digits)} {byId[to]?.fa}
                  </div>
                )}
              </div>
              <p style={{ fontSize: "0.78rem", color: "var(--muted)" }}>
                محاسبه با نرخ‌های میانگین لحظه‌ای همین اپ انجام می‌شود، نه نرخ ثابت.
              </p>
            </>
          )}
        </div>

        <div className="panel">
          <div className="row-flex">
            <h2 style={{ margin: 0 }}>مقایسه روند (نرمالایزشده درصدی)</h2>
            <span className="header-spacer" />
            <div className="seg">
              <button className={range === "7d" ? "active" : ""} onClick={() => setRange("7d")}>هفته</button>
              <button className={range === "1m" ? "active" : ""} onClick={() => setRange("1m")}>ماه</button>
            </div>
          </div>
          <div className="row-flex mt" style={{ gap: 6 }}>
            {opts.map((c) => (
              <button
                key={c.id}
                className={`tab${cmp.includes(c.id) ? " active" : ""}`}
                onClick={() => toggleCmp(c.id)}
                style={{ fontSize: "0.8rem", padding: "6px 12px" }}
              >
                {c.fa}
              </button>
            ))}
          </div>
          <div className="mt">{cmpLoading ? <div className="skel" style={{ height: 280 }} /> : <CompareChart series={series} />}</div>
          <p style={{ fontSize: "0.78rem", color: "var(--muted)" }}>
            حداکثر ۴ آیتم. محور عمودی «درصد تغییر نسبت به ابتدای بازه» است تا مقایسه مقیاس‌های متفاوت معنادار باشد.
          </p>
        </div>
      </main>
      <StatusBar snap={snap} online={online} stale={stale} />
      <PwaHelper />
    </>
  );
}
