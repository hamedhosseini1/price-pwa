"use client";
/**
 * Live snapshot hook: polls /api/prices, tracks online status,
 * evaluates local price alerts, and exposes a price-flash signal.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { Snapshot } from "@/lib/types";
import { useSettings, markAlertsFired } from "@/lib/settings";

const POLL_MS = 30_000;

export interface FlashMap {
  [id: string]: "up" | "down";
}

export function usePrices() {
  const { currency, alerts } = useSettings();
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [online, setOnline] = useState(true);
  const [stale, setStale] = useState(false);
  const [flash, setFlash] = useState<FlashMap>({});
  const prevRef = useRef<Record<string, number>>({});
  const alertsRef = useRef(alerts);
  alertsRef.current = alerts;
  const currencyRef = useRef(currency);
  currencyRef.current = currency;

  const checkAlerts = useCallback((s: Snapshot) => {
    const rules = alertsRef.current.filter((a) => !a.fired);
    if (!rules.length) return;
    const cur = currencyRef.current;
    const fired: string[] = [];
    for (const r of rules) {
      const item = s.items.find((i) => i.id === r.id);
      if (!item) continue;
      // rule target was stored in rule.currency; compare in same unit
      const price = r.currency === "IRT" ? item.priceIRT : item.priceUSD;
      if (price == null) continue;
      const hit = r.dir === "above" ? price >= r.target : price <= r.target;
      if (hit) {
        fired.push(r.id);
        notifyAlert(item.fa, price, r.dir, cur);
      }
    }
    if (fired.length) {
      markAlertsFired(fired);
      // refresh alert state in context by touching storage event
      window.dispatchEvent(new Event("pp-alerts-changed"));
    }
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/prices", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const s = (await res.json()) as Snapshot;
      setSnap(s);
      setStale(res.headers.get("X-Snapshot-Stale") === "1");
      // flash detection vs previous prices (prefer current currency, fallback other)
      const f: FlashMap = {};
      for (const it of s.items) {
        const v = it.priceIRT ?? it.priceUSD ?? null;
        const p = prevRef.current[it.id];
        if (v != null && p != null && v !== p) f[it.id] = v > p ? "up" : "down";
        if (v != null) prevRef.current[it.id] = v;
      }
      setFlash(f);
      checkAlerts(s);
    } catch {
      /* keep last snapshot; status bar shows staleness */
      setStale(true);
    } finally {
      setLoading(false);
    }
  }, [checkAlerts]);

  useEffect(() => {
    setOnline(navigator.onLine);
    const on = () => {
      setOnline(true);
      void load();
    };
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    void load();
    const t = setInterval(load, POLL_MS);
    // clear flash after animation
    const tf = setInterval(() => setFlash({}), 2500);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
      clearInterval(t);
      clearInterval(tf);
    };
  }, [load]);

  return { snap, loading, online, stale, flash, refresh: load };
}

function notifyAlert(name: string, price: number, dir: "above" | "below", cur: string) {
  const msg = dir === "above" ? `از حد تعیین‌شده بالاتر رفت` : `به حد تعیین‌شده رسید`;
  try {
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(`هشدار قیمت ${name}`, { body: `${msg}`, tag: `alert-${name}` });
    }
  } catch {}
}
