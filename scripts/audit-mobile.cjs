/** One-shot responsive audit: viewport 440px, report overflow + header layout. */
const { chromium } = require("playwright-core");

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 440, height: 1400 } });
  await page.goto("http://localhost:3100/", { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(4000);
  const report = await page.evaluate(() => {
    const vw = window.innerWidth;
    const bad = [];
    document.querySelectorAll("*").forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width > vw + 1 && r.width < 3000) {
        bad.push(`${el.tagName}.${String(el.className).split(" ")[0]}=${Math.round(r.width)}`);
      }
    });
    const header = document.querySelector(".header-inner");
    const hr = header.getBoundingClientRect();
    const kids = [...header.children].map((c) => {
      const r = c.getBoundingClientRect();
      return `${c.tagName}.${String(c.className).split(" ")[0]} x=${Math.round(r.x)} y=${Math.round(r.y)} w=${Math.round(r.width)} h=${Math.round(r.height)}`;
    });
    const cs = getComputedStyle(header);
    return {
      vw, docSW: document.documentElement.scrollWidth,
      headerH: Math.round(hr.height), flexWrap: cs.flexWrap,
      kids, offenders: bad.slice(0, 15),
    };
  });
  console.log(JSON.stringify(report, null, 1));
  await page.screenshot({ path: "/tmp/pp-pw.png" });
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
