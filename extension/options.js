/** Options page: base URL, currency, digits, badge interval. */
import { DEFAULT_BASE, storageGet, storageSet } from "./lib.js";

const $ = (s) => document.querySelector(s);

async function init() {
  const cfg = await storageGet({ base: DEFAULT_BASE, currency: "IRT", digits: "fa", minutes: 5 });
  $("#base").value = cfg.base || DEFAULT_BASE;
  $("#currency").value = cfg.currency || "IRT";
  $("#digits").value = cfg.digits || "fa";
  $("#minutes").value = String(cfg.minutes || 5);
  $("#save").onclick = async () => {
    await storageSet({
      base: $("#base").value.trim().replace(/\/+$/, "") || DEFAULT_BASE,
      currency: $("#currency").value,
      digits: $("#digits").value,
      minutes: Number($("#minutes").value) || 5,
    });
    $("#msg").textContent = "ذخیره شد ✓";
    setTimeout(() => ($("#msg").textContent = ""), 2000);
  };
}

init();
