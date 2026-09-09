/** Popup: key prices from our own /api/prices (never hits upstreams directly). */
import {
  DEFAULT_BASE, pickItems, fetchSnapshot, artUrl, flagImg,
  fmtPrice, fmtPct, storageGet, storageSet,
} from "./lib.js";

const $ = (s) => document.querySelector(s);

async function render() {
  const cfg = await storageGet({ base: DEFAULT_BASE, currency: "IRT", digits: "fa" });
  const base = (cfg.base || DEFAULT_BASE).replace(/\/+$/, "");
  const cur = cfg.currency === "USD" ? "USD" : "IRT";
  const fa = cfg.digits !== "en";
  $("#cur-irt").classList.toggle("active", cur === "IRT");
  $("#cur-usd").classList.toggle("active", cur === "USD");

  const list = $("#list");
  try {
    const snap = await fetchSnapshot(base);
    const items = pickItems(snap);
    if (!items.length) throw new Error("empty");
    list.innerHTML = "";
    for (const it of items) {
      const v = cur === "IRT" ? it.priceIRT : it.priceUSD;
      const row = document.createElement("div");
      row.className = "row";
      const src = artUrl(it.icon, base) || flagImg(it.id, base);
      const art = src
        ? `<img src="${src}" alt="" loading="lazy" onerror="this.outerHTML='<span class=\\'badge\\'>${it.badge.slice(0, 2)}</span>'">`
        : `<span class="badge">${it.badge.slice(0, 2)}</span>`;
      const ch = it.changePct;
      const cls = ch == null ? "flat" : ch > 0 ? "up" : ch < 0 ? "down" : "flat";
      const arrow = ch == null ? "" : ch > 0 ? "▲ " : ch < 0 ? "▼ " : "";
      row.innerHTML = `${art}
        <div class="nm"><b>${it.fa}</b><small>${it.en}</small></div>
        <div class="pr"><b>${fmtPrice(v, fa)} <small>${cur === "IRT" ? "تومان" : "$"}</small></b>
        <span class="pill ${cls}">${arrow}${fmtPct(ch, fa)}</span></div>`;
      list.appendChild(row);
    }
    const t = new Date(snap.generatedAt);
    $("#updated").textContent = `به‌روزرسانی: ${t.toLocaleTimeString(fa ? "fa-IR" : "en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`;
  } catch {
    list.innerHTML = `<div class="error"><b>اتصال برقرار نشد</b>
      سرور اپ (${base}) در دسترس نیست.<br>اول <code>npm run dev</code> را اجرا کنید.</div>`;
    $("#updated").textContent = "";
  }

  $("#open-app").onclick = (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: base + "/" });
  };
  $("#open-opt").onclick = (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  };
  $("#cur-irt").onclick = () => storageSet({ currency: "IRT" }).then(render);
  $("#cur-usd").onclick = () => storageSet({ currency: "USD" }).then(render);
}

render();
