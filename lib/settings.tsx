"use client";
/**
 * Global UI settings persisted in localStorage:
 * theme (light/dark), currency (IRT/USD), digits (fa/en),
 * favorites (item ids), alerts (price targets).
 */
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

export type Theme = "light" | "dark";
export type Currency = "IRT" | "USD";
export type DigitMode = "fa" | "en";

export interface AlertRule {
  id: string; // item id
  dir: "above" | "below";
  target: number; // in currently selected currency at creation; stored with currency
  currency: Currency;
  createdAt: number;
  fired?: boolean;
}

interface Settings {
  theme: Theme;
  setTheme: (t: Theme) => void;
  currency: Currency;
  setCurrency: (c: Currency) => void;
  digits: DigitMode;
  setDigits: (d: DigitMode) => void;
  favorites: string[];
  toggleFavorite: (id: string) => void;
  alerts: AlertRule[];
  addAlert: (a: Omit<AlertRule, "createdAt">) => void;
  removeAlert: (id: string, target: number, dir: "above" | "below") => void;
  clearFiredAlerts: () => void;
}

const Ctx = createContext<Settings | null>(null);

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw != null ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("light");
  const [currency, setCurrencyState] = useState<Currency>("IRT");
  const [digits, setDigitsState] = useState<DigitMode>("fa");
  const [favorites, setFavorites] = useState<string[]>([]);
  const [alerts, setAlerts] = useState<AlertRule[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setThemeState(load<Theme>("pp-theme", "light"));
    setCurrencyState(load<Currency>("pp-currency", "IRT"));
    setDigitsState(load<DigitMode>("pp-digits", "fa"));
    setFavorites(load<string[]>("pp-favorites", []));
    setAlerts(load<AlertRule[]>("pp-alerts", []));
    setReady(true);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem("pp-theme", JSON.stringify(theme));
      document.querySelector('meta[name="theme-color"]')?.setAttribute(
        "content",
        theme === "dark" ? "#0b1220" : "#ffffff",
      );
    } catch {}
  }, [theme, ready]);

  const setTheme = (t: Theme) => setThemeState(t);
  const setCurrency = (c: Currency) => {
    setCurrencyState(c);
    try {
      localStorage.setItem("pp-currency", JSON.stringify(c));
    } catch {}
  };
  const setDigits = (d: DigitMode) => {
    setDigitsState(d);
    try {
      localStorage.setItem("pp-digits", JSON.stringify(d));
    } catch {}
  };
  const toggleFavorite = (id: string) =>
    setFavorites((f) => {
      const next = f.includes(id) ? f.filter((x) => x !== id) : [...f, id];
      try {
        localStorage.setItem("pp-favorites", JSON.stringify(next));
      } catch {}
      return next;
    });
  const addAlert = (a: Omit<AlertRule, "createdAt">) =>
    setAlerts((list) => {
      const next = [...list.filter((x) => !(x.id === a.id && x.dir === a.dir)), { ...a, createdAt: Date.now() }];
      try {
        localStorage.setItem("pp-alerts", JSON.stringify(next));
      } catch {}
      return next;
    });
  const removeAlert = (id: string, target: number, dir: "above" | "below") =>
    setAlerts((list) => {
      const next = list.filter((x) => !(x.id === id && x.target === target && x.dir === dir));
      try {
        localStorage.setItem("pp-alerts", JSON.stringify(next));
      } catch {}
      return next;
    });
  const clearFiredAlerts = () =>
    setAlerts((list) => {
      const next = list.filter((x) => !x.fired);
      try {
        localStorage.setItem("pp-alerts", JSON.stringify(next));
      } catch {}
      return next;
    });

  const value = useMemo(
    () => ({
      theme, setTheme, currency, setCurrency, digits, setDigits,
      favorites, toggleFavorite, alerts, addAlert, removeAlert, clearFiredAlerts,
    }),
    [theme, currency, digits, favorites, alerts],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSettings(): Settings {
  const s = useContext(Ctx);
  if (!s) throw new Error("useSettings outside provider");
  return s;
}

/** Mark alert rules as fired (called by price watcher). */
export function markAlertsFired(ids: string[]) {
  try {
    const list = load<AlertRule[]>("pp-alerts", []);
    const next = list.map((a) => (ids.includes(a.id) ? { ...a, fired: true } : a));
    localStorage.setItem("pp-alerts", JSON.stringify(next));
  } catch {}
}
