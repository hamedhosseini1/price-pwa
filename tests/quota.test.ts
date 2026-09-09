import { describe, it, expect } from "vitest";
import { isDue } from "../lib/store";
import { parseTwelveData } from "../lib/sources/twelvedata";

describe("per-source TTL (quota safety)", () => {
  const now = Date.now();
  it("staggers brsapi behind keyless sources", () => {
    // defaults: tgju 45s, brsapi 150s, twelvedata 300s
    expect(isDue("tgju", now - 50_000, 0, now)).toBe(true);
    expect(isDue("tgju", now - 10_000, 0, now)).toBe(false);
    expect(isDue("brsapi", now - 100_000, 0, now)).toBe(false);
    expect(isDue("brsapi", now - 160_000, 0, now)).toBe(true);
    expect(isDue("twelvedata", now - 200_000, 0, now)).toBe(false);
    expect(isDue("twelvedata", now - 400_000, 0, now)).toBe(true);
  });
  it("suspension blocks refetch until expiry", () => {
    expect(isDue("brsapi", 0, now + 60_000, now)).toBe(false);
    expect(isDue("brsapi", 0, now - 1_000, now)).toBe(true);
  });
});

describe("twelvedata parser", () => {
  it("reads daily close", () => {
    const q = parseTwelveData("BRENT", { values: [{ datetime: "2026-09-09", close: "101.25" }] }, 5);
    expect(q).toMatchObject({ price: 101.25, unit: "USD", time: 5 });
    expect(parseTwelveData("BRENT", { values: [] })).toBeNull();
    expect(parseTwelveData("BRENT", { code: 429, message: "run out" } as never)).toBeNull();
  });
});
