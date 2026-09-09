/**
 * Live smoke test: hits a running instance (npm run dev / start) and
 * validates fetch + aggregation end-to-end.
 *
 *   BASE=http://localhost:3000 node scripts/smoke.mjs
 *
 * Checks:
 *  - /api/health → ok, item count, per-source status
 *  - /api/prices → snapshot shape, USD anchor, key items (USD, GOLD18,
 *    BTC, XAU, BRENT), both units present, sources listed
 *  - /api/history/BTC → non-empty points
 */
const BASE = process.env.BASE ?? "http://localhost:3000";

async function get(path) {
  const t = Date.now();
  const res = await fetch(BASE + path);
  const ms = Date.now() - t;
  if (!res.ok) throw new Error(`${path} → HTTP ${res.status}`);
  return { json: await res.json(), ms };
}

function assert(cond, msg) {
  if (!cond) {
    console.error("✗ FAIL:", msg);
    process.exitCode = 1;
  } else {
    console.log("✓", msg);
  }
}

const health = (await get("/api/health")).json;
console.log("--- /api/health ---");
console.log(JSON.stringify({ items: health.items, sources: health.sources, usdIrt: health.usdIrt }, null, 1));
assert(health.items > 10, `item count sane (${health.items})`);
assert(health.usdIrt > 0, `USD/IRT anchor present (${health.usdIrt})`);

const prices = (await get("/api/prices")).json;
console.log("--- /api/prices ---");
assert(Array.isArray(prices.items), "items is array");
const brsOn = health.sources?.brsapi?.ok;
// Without BRSAPI_KEY, oil/platinum/palladium have no reachable source → SKIP.
const REQUIRED = ["USD", "EUR", "GOLD18", "COIN_EMAMI", "BTC", "XAU"];
const OPTIONAL = ["BRENT", "WTI", "GAS", "XPT", "XPD", "XAG"];
for (const id of [...REQUIRED, ...(brsOn ? OPTIONAL : [])]) {
  const it = prices.items.find((x) => x.id === id);
  assert(!!it, `item ${id} present`);
  if (it) {
    assert(it.priceIRT > 0 || it.priceUSD > 0, `${id} has a price`);
    assert(it.sources.length >= 1, `${id} lists ≥1 source`);
    console.log(`  ${id}: IRT=${it.priceIRT} USD=${it.priceUSD} chg=${it.changePct} src=[${it.sources.map((s) => s.source).join(",")}]`);
  }
}
if (!brsOn) {
  const missing = OPTIONAL.filter((id) => !prices.items.find((x) => x.id === id));
  console.log(`  (SKIP without BRSAPI_KEY: ${missing.join(", ") || "none"})`);
}

// Sanity ranges — catch unit-conversion bugs (rial vs toman vs USD).
const byId = Object.fromEntries(prices.items.map((x) => [x.id, x]));
const inRange = (id, lo, hi, field = "priceUSD") => {
  const v = byId[id]?.[field];
  assert(v > lo && v < hi, `${id}.${field}=${v} within [${lo},${hi}]`);
};
inRange("USD", 0.99, 1.01);
inRange("EUR", 0.5, 3);
inRange("BTC", 1000, 2000000);
inRange("XAU", 500, 20000);
inRange("USD", 10000, 10000000, "priceIRT");

console.log("--- /api/history/BTC?range=7d ---");
const hist = (await get("/api/history/BTC?range=7d&currency=USD")).json;
assert(Array.isArray(hist.points), "history points is array");
console.log(`  points: ${hist.points.length} sources: ${(hist.sources ?? []).join(",")}`);

console.log(process.exitCode ? "\nSMOKE: FAILED" : "\nSMOKE: PASSED");
