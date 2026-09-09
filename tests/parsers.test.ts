import { describe, it, expect } from "vitest";
import { parseBrsDoc } from "../lib/sources/brsapi";
import { parseSimplePrice } from "../lib/sources/coingecko";
import { parseFrankfurter } from "../lib/sources/frankfurter";
import { parseNobitex } from "../lib/sources/nobitex";
import { extractBonbastParam, parseBonbastJson } from "../lib/sources/bonbast";

describe("brsapi parser", () => {
  const doc = {
    gold: [
      { symbol: "IR_GOLD_18K", price: 6214700, unit: "تومان", time_unix: 1747573140, change_percent: -1.53, change_value: -95100 },
      { symbol: "XAUUSD", price: 3201, unit: "دلار", time_unix: 1747427340, change_percent: -1.17, change_value: -38 },
    ],
    currency: [{ symbol: "USD", price: 86000, unit: "تومان", time_unix: 1747573140, change_percent: 0.8, change_value: 700 }],
    cryptocurrency: [{ symbol: "BTC", price: 97000, unit: "دلار", time_unix: 1747573140, change_percent: 2.1, change_value: 2000 }],
  };
  it("maps BrsApi symbols to catalog ids with units", () => {
    const q = parseBrsDoc(doc as never);
    expect(q["GOLD18"].price).toBe(6214700);
    expect(q["GOLD18"].unit).toBe("IRT");
    expect(q["XAU"].price).toBe(3201);
    expect(q["XAU"].unit).toBe("USD");
    expect(q["USD"].changePct).toBe(0.8);
    expect(q["BTC"].price).toBe(97000);
  });
  it("coerces string prices (crypto section serves strings)", () => {
    const q = parseBrsDoc({
      cryptocurrency: [
        { symbol: "BTC", price: "78571", unit: "دلار", time_unix: 1, change_percent: "2.1", change_value: "2000" },
        { symbol: "ETH", price: "2,490.5", unit: "دلار", time_unix: 1 },
      ],
    } as never);
    expect(q["BTC"]).toMatchObject({ price: 78571, unit: "USD", changePct: 2.1 });
    expect(q["ETH"].price).toBe(2490.5);
  });
  it("ignores unknown symbols and bad prices", () => {
    const q = parseBrsDoc({ gold: [{ symbol: "NOPE", price: 5 }, { symbol: "USD", price: NaN }] } as never);
    expect(q["USD"]).toBeUndefined();
  });
});

describe("coingecko parser", () => {
  it("maps coin ids", () => {
    const q = parseSimplePrice({ bitcoin: { usd: 78391, usd_24h_change: -0.15 }, nope: { usd: 1 } }, 123);
    expect(q["BTC"].price).toBe(78391);
    expect(q["BTC"].changePct).toBe(-0.15);
    expect(q["BTC"].time).toBe(123);
  });
});

describe("frankfurter parser", () => {
  it("inverts ECB rates to USD-per-unit", () => {
    const q = parseFrankfurter({ base: "USD", date: "2026-09-09", rates: { EUR: 0.85822, XXX: 2 } }, 1);
    expect(q["EUR"].price).toBeCloseTo(1 / 0.85822, 6);
    expect(q["EUR"].unit).toBe("USD");
  });
});

describe("nobitex parser", () => {
  it("reads rial legs and converts to toman", () => {
    const q = parseNobitex(
      { status: "ok", stats: { "btc-rls": { latest: "90000000000", dayOpen: "89000000000", dayLow: "88000000000", dayHigh: "91000000000" } } },
      7,
    );
    expect(q["BTC"].price).toBe(9000000000);
    expect(q["BTC"].unit).toBe("IRT");
    expect(q["BTC"].changePct).toBeCloseTo(((900 - 890) / 890) * 100, 6);
  });
});

describe("bonbast", () => {
  it("extracts the rotating /json param", () => {
    const html = `<script>$.post('/json', {param: "abc123,xyz,2026-09-09-15-41-27"}, function(json) {});</script>`;
    expect(extractBonbastParam(html)).toBe("abc123,xyz,2026-09-09-15-41-27");
    expect(extractBonbastParam("<html></html>")).toBeNull();
  });
  it("parses the /json payload (sell legs, toman; BTC/XAU in USD)", () => {
    const q = parseBonbastJson({ usd1: "2,325,000", usd2: "2,320,000", bitcoin: 97000, ounce: 3201, nope1: "5" }, 9);
    expect(q["USD"].price).toBe(2325000);
    expect(q["USD"].unit).toBe("IRT");
    expect(q["BTC"].unit).toBe("USD");
    expect(q["XAU"].price).toBe(3201);
  });
});
