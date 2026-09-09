/** Functional check: global search finds cross-category items. */
const { chromium } = require("playwright-core");

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto("http://localhost:3100/", { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(4000);
  await page.getByPlaceholder(/جستجو/).fill("نفت");
  await page.waitForTimeout(800);
  const header = await page.locator(".section-title h2").last().textContent();
  const cards = await page.locator(".grid .card .card-name").allTextContents();
  console.log("HEADER:", header);
  console.log("CARDS:", cards.map((c) => c.split("\n")[0]).join(" | "));
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
