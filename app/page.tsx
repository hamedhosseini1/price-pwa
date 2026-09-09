"use client";
/** Dashboard: hero stats, favorites, category tabs, search, cards/table. */
import { useMemo, useState } from "react";
import Link from "next/link";
import { usePrices } from "@/hooks/usePrices";
import { useSettings } from "@/lib/settings";
import type { Category } from "@/lib/types";
import { CATEGORY_FA, CATEGORY_ORDER } from "@/lib/catalog";
import { formatNumber, timeAgo } from "@/lib/format";
import {
  Header, StatusBar, PriceCard, PriceTable, ChangePill,
  SearchBox, SkeletonGrid, PwaHelper,
} from "@/components/ui";
import { ItemIcon } from "@/components/icons";

const HERO_IDS = ["USD", "GOLD18", "BTC", "XAU"];

/** fa name, english name, or symbol/id (e.g. "BTC", "usd"). */
function matchesQuery(i: { fa: string; en: string; id: string }, needle: string): boolean {
  return (
    i.fa.includes(needle) ||
    i.en.toLowerCase().includes(needle.toLowerCase()) ||
    i.id.toLowerCase().includes(needle.toLowerCase())
  );
}

export default function Home() {
  const { snap, loading, online, stale, flash } = usePrices();
  const { currency, digits, favorites, alerts, clearFiredAlerts } = useSettings();
  const [tab, setTab] = useState<Category>("currency");
  const [q, setQ] = useState("");

  const items = snap?.items ?? [];
  const byId = useMemo(() => Object.fromEntries(items.map((i) => [i.id, i])), [items]);

  const filtered = useMemo(() => {
    const needle = q.trim();
    return items.filter((i) => {
      if (tab === "gold" ? !(i.category === "gold" || i.category === "metal") : i.category !== tab) {
        // gold tab merges metals for a richer view
        if (!(tab === "gold" && i.category === "metal")) return false;
      }
      if (!needle) return true;
      return matchesQuery(i, needle);
    });
  }, [items, tab, q]);

  // Global search: across ALL categories, ignoring the active tab.
  const searching = q.trim().length > 0;
  const searchResults = useMemo(() => {
    if (!searching) return [];
    const needle = q.trim();
    return items.filter((i) => matchesQuery(i, needle));
  }, [items, q, searching]);

  const favItems = favorites.map((id) => byId[id]).filter(Boolean);
  const fired = alerts.filter((a) => a.fired);
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const i of items) {
      const t = i.category === "metal" ? "gold" : i.category;
      c[t] = (c[t] ?? 0) + 1;
    }
    return c;
  }, [items]);

  return (
    <>
      <Header />
      <main className="container">
        {!online && <div className="offline-banner">اتصال اینترنت قطع است — آخرین قیمت‌های ذخیره‌شده نمایش داده می‌شود.</div>}
        {fired.length > 0 && (
          <div className="alert-banner">
            {fired.length} هشدار قیمت فعال شد ({fired.map((f) => byId[f.id]?.fa ?? f.id).join("، ")}) —{" "}
            <button className="btn small ghost" onClick={clearFiredAlerts} style={{ marginInlineStart: 8 }}>
              پاک کردن
            </button>
          </div>
        )}

        {/* hero */}
        <section className="hero">
          {loading || !snap
            ? Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="hero-card">
                  <div className="skel" style={{ width: "50%", height: 12 }} />
                  <div className="skel mt" style={{ width: "80%", height: 24 }} />
                </div>
              ))
            : HERO_IDS.map((id) => {
                const it = byId[id];
                if (!it) return null;
                const v = currency === "IRT" ? it.priceIRT : it.priceUSD;
                return (
                  <Link key={id} href={`/item/${id}`} className="hero-card">
                    <div className="label row-flex" style={{ gap: 8 }}>
                      <ItemIcon item={it} size={28} />
                      {it.fa}
                    </div>
                    <div className="value">{v == null ? "—" : formatNumber(v, digits)}</div>
                    <div className="sub">
                      <ChangePill value={it.changePct} />{" "}
                      <span style={{ color: "var(--muted)" }}>{currency === "IRT" ? "تومان" : "$"}</span>
                    </div>
                  </Link>
                );
              })}
        </section>

        {/* favorites */}
        {favItems.length > 0 && (
          <>
            <div className="section-title">
              <h2>★ علاقه‌مندی‌ها</h2>
              <span className="line" />
            </div>
            <div className="grid">
              {favItems.map((it) => (
                <PriceCard key={it.id} item={it} flash={flash[it.id]} />
              ))}
            </div>
          </>
        )}

        {/* tabs + search */}
        <div className="section-title">
          <h2>قیمت‌های لحظه‌ای</h2>
          <span className="line" />
          {snap && (
            <small style={{ color: "var(--muted)" }}>
              {timeAgo(snap.generatedAt, Date.now(), digits)}
              {snap.usdIrt ? ` · دلار ${formatNumber(snap.usdIrt, digits)} تومان` : ""}
            </small>
          )}
        </div>
        <div className="tabs" role="tablist">
          {CATEGORY_ORDER.map((c) => {
            const key = c === "metal" ? "gold" : c;
            if (c === "metal") return null; // merged into gold tab
            return (
              <button
                key={key}
                role="tab"
                className={`tab${tab === key ? " active" : ""}`}
                onClick={() => setTab(key as Category)}
              >
                {CATEGORY_FA[key as Category]}
                <span className="count-badge">{counts[key] ?? 0}</span>
              </button>
            );
          })}
        </div>
        <SearchBox value={q} onChange={setQ} />

        {loading || !snap ? (
          <SkeletonGrid />
        ) : searching ? (
          <>
            <div className="section-title">
              <h2>
                نتایج جستجو برای «{q.trim()}» ({formatNumber(searchResults.length, digits)})
              </h2>
              <span className="line" />
              <button className="btn ghost small" onClick={() => setQ("")}>
                پاک کردن ✕
              </button>
            </div>
            {searchResults.length === 0 ? (
              <div className="empty">
                <div className="big">∅</div>
                آیتمی یافت نشد.
              </div>
            ) : (
              <div className="grid">
                {searchResults.map((it) => (
                  <PriceCard key={it.id} item={it} flash={flash[it.id]} />
                ))}
              </div>
            )}
          </>
        ) : filtered.length === 0 ? (
          <div className="empty">
            <div className="big">∅</div>
            آیتمی یافت نشد.
          </div>
        ) : tab === "currency" ? (
          <PriceTable items={filtered} />
        ) : (
          <div className="grid">
            {filtered.map((it) => (
              <PriceCard key={it.id} item={it} flash={flash[it.id]} />
            ))}
          </div>
        )}
      </main>
      <StatusBar snap={snap} online={online} stale={stale} />
      <PwaHelper />
    </>
  );
}
