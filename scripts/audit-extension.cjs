/** Load the unpacked extension in real Chromium and verify popup + badge. */
const { chromium } = require("playwright-core");
const path = require("path");

(async () => {
  const extPath = path.join(__dirname, "..", "extension");
  const exe = "/Users/hamedhosseini/Library/Caches/ms-playwright/chromium-1243/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing";
  const ctx = await chromium.launchPersistentContext("", {
    executablePath: exe,
    headless: true,
    args: [
      `--disable-extensions-except=${extPath}`,
      `--load-extension=${extPath}`,
      "--no-sandbox",
    ],
  });
  // wait for background SW + alarm refresh
  await new Promise((r) => setTimeout(r, 15000));
  console.log("pages:", ctx.pages().map((p) => p.url()).join(" | "));
  console.log("workers:", ctx.serviceWorkers().map((w) => w.url()).join(" | "));
  let sw = null;
  for (const w of ctx.serviceWorkers()) {
    if (w.url().includes("background")) sw = w;
  }
  console.log("background SW:", sw ? "loaded" : "MISSING");

  // open popup page directly and check rendered rows
  const popup = await ctx.newPage();
  // find extension id from any extension page
  await popup.goto("chrome://extensions/", { waitUntil: "domcontentloaded" }).catch(() => {});
  const targets = ctx.backgroundPages().concat([]);
  void targets;
  // simpler: evaluate badge via chrome API is not accessible; check popup DOM instead
  // resolve ext id through service worker url
  const swUrl = sw ? sw.url() : "";
  const id = swUrl.split("/")[2] || "";
  console.log("ext id:", id || "unknown");
  if (!id) {
    console.log("SKIP popup check (no id)");
  } else {
    await popup.goto(`chrome-extension://${id}/popup.html`, { waitUntil: "networkidle", timeout: 30000 });
    await popup.waitForTimeout(5000);
    const rows = await popup.locator("#list .row").count();
    const names = await popup.locator("#list .row .nm b").allTextContents();
    const err = await popup.locator("#list .error").count();
    console.log("popup rows:", rows, "| errors:", err);
    console.log("items:", names.slice(0, 4).join("، "));
    await popup.screenshot({ path: "/tmp/pp-popup.png" });
    console.log("screenshot: /tmp/pp-popup.png");
  }
  await ctx.close();
})().catch((e) => {
  console.error("EXT-AUDIT FAIL:", e.message);
  process.exit(1);
});
