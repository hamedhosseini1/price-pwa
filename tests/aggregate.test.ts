import { describe, it, expect } from "vitest";
import { aggregateItem, buildSnapshot, computeUsdIrt } from "../lib/aggregate";
import { CATALOG_BY_ID } from "../lib/catalog";
import type { SourceDump } from "../lib/sources/http";

const dump = (source: string, quotes: SourceDump["quotes"]): SourceDump => ({
  source,
  quotes,
  ms: 10,
});

describe("computeUsdIrt", () => {
  it("prefers brsapi USD, falls back to tether/tgju", () => {
    const d = [
      dump("tgju", { USD: { price: 232400, unit: "IRT", time: 1 } }),
      dump("brsapi", { USD: { price: 232500, unit: "IRT", time: 1 } }),
    ];
    expect(computeUsdIrt(d)).toMatchObject({ rate: 232500, source: "brsapi" });
    expect(computeUsdIrt([])).toMatchObject({ rate: null, source: null });
  });
});

describe("aggregateItem", () => {
  const T = 1_000;
  it("weighted-means IRT quotes and converts to USD", () => {
    const d = [
      dump("brsapi", { USD: { price: 232500, unit: "IRT", time: T } }),
      dump("brsapi", { GOLD18: { price: 62147000 / 10, unit: "IRT", time: T, changePct: -1.5 } }),
      dump("tgju", { GOLD18: { price: 6214700, unit: "IRT", time: T, changePct: -1.6 } }),
    ];
    const { rate } = computeUsdIrt(d);
    const it = aggregateItem(CATALOG_BY_ID["GOLD18"], d, rate);
    // weights 3 (brs) vs 2 (tgju), equal prices → same price
    expect(it.priceIRT).toBe(6214700);
    expect(it.priceUSD).toBeCloseTo(6214700 / 232500, 6);
    expect(it.changePct).toBeCloseTo(-1.55);
    expect(it.sources).toHaveLength(2);
  });

  it("drops outliers deviating >2.5% from median", () => {
    const d = [
      dump("brsapi", { USD: { price: 100, unit: "IRT", time: T } }),
      dump("brsapi", { EUR: { price: 100, unit: "IRT", time: T } }),
      dump("tgju", { EUR: { price: 101, unit: "IRT", time: T } }),
      dump("coingecko", { EUR: { price: 150, unit: "IRT", time: T } }),
    ];
    const it = aggregateItem(CATALOG_BY_ID["EUR"], d, 100);
    // (100*3 + 101*2) / 5 = 100.4, outlier 150 excluded
    expect(it.priceIRT).toBeCloseTo(100.4, 6);
  });

  it("handles per-100 JPY quotes", () => {
    const d = [
      dump("brsapi", { USD: { price: 100, unit: "IRT", time: T } }),
      dump("brsapi", { JPY: { price: 200, unit: "IRT", time: T } }),
    ];
    const it = aggregateItem(CATALOG_BY_ID["JPY"], d, 100);
    expect(it.priceIRT).toBe(2);
  });

  it("2-quote huge disagreement keeps the higher-weight quote", () => {
    const d = [
      dump("brsapi", { BRENT: { price: 101.37, unit: "USD", time: T } }),
      dump("tgju", { BRENT: { price: 200, unit: "USD", time: T } }),
    ];
    const it = aggregateItem(CATALOG_BY_ID["BRENT"], d, 100);
    expect(it.priceUSD).toBeCloseTo(101.37, 6); // brsapi weight 3 wins
  });

  it("marks items with no quotes unavailable", () => {
    const it = aggregateItem(CATALOG_BY_ID["XPT"], [], null);
    expect(it.unavailable).toBe(true);
  });
});

describe("buildSnapshot", () => {
  it("attaches icon URLs when provided", () => {
    const snap = buildSnapshot(
      [dump("coingecko", { BTC: { price: 10, unit: "USD", time: 1 } })],
      { icons: { BTC: "https://example.com/btc.png" } },
    );
    expect(snap.items.find((i) => i.id === "BTC")?.icon).toBe("https://example.com/btc.png");
  });
  it("filters unavailable items and reports source status", () => {
    const snap = buildSnapshot([dump("brsapi", { USD: { price: 10, unit: "IRT", time: 1 } })]);
    expect(snap.usdIrt).toBe(10);
    expect(snap.items.find((i) => i.id === "USD")).toBeDefined();
    expect(snap.items.find((i) => i.id === "XPT")).toBeUndefined();
    expect(snap.sourceStatus["brsapi"].ok).toBe(true);
  });
});
