/** Background SW: poll snapshot on alarm, mirror USD price onto the badge. */
import { DEFAULT_BASE, usdToman, badgeText, fetchSnapshot, storageGet } from "./lib.js";

const ALARM = "pp-refresh";

async function refresh(reason) {
  try {
    const cfg = await storageGet({ base: DEFAULT_BASE, minutes: 5 });
    const base = (cfg.base || DEFAULT_BASE).replace(/\/+$/, "");
    const snap = await fetchSnapshot(base);
    const t = usdToman(snap);
    const text = badgeText(t ?? NaN);
    await chrome.action.setBadgeText({ text });
    await chrome.action.setBadgeBackgroundColor({ color: "#0e7c7b" });
    await chrome.action.setTitle({
      title: t ? `دلار: ${Math.round(t).toLocaleString("en-US")} تومان` : "قیمت لحظه‌ای",
    });
  } catch {
    await chrome.action.setBadgeText({ text: "!" });
    await chrome.action.setBadgeBackgroundColor({ color: "#e5484d" });
  }
  void reason;
}

if (typeof chrome !== "undefined" && chrome.alarms) {
  chrome.runtime.onInstalled.addListener(() => {
    chrome.alarms.create(ALARM, { periodInMinutes: 5 });
    refresh("install");
  });
  chrome.runtime.onStartup.addListener(() => refresh("startup"));
  chrome.alarms.onAlarm.addListener((a) => {
    if (a.name === ALARM) refresh("alarm");
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && (changes.minutes || changes.base)) {
      storageGet({ minutes: 5 }).then((cfg) => {
        const m = Math.min(60, Math.max(1, Number(cfg.minutes) || 5));
        chrome.alarms.create(ALARM, { periodInMinutes: m });
        refresh("settings");
      });
    }
  });
}
