import { describe, it, expect } from "vitest";
import {
  badgeText, fmtPrice, fmtPct, groupThousands, pickItems, usdToman,
  artUrl, flagImg, DEFAULT_BASE,
} from "../extension/lib.js";

describe("extension lib", () => {
  it("compacts badge text", () => {
    expect(badgeText(232546)).toBe("232.5K");
    expect(badgeText(233000)).toBe("233K");
    expect(badgeText(2500000)).toBe("2.5M");
    expect(badgeText(NaN)).toBe("");
  });
  it("formats prices like the app", () => {
    expect(fmtPrice(2325000, false)).toBe("2,325,000");
    expect(fmtPrice(2325000, true)).toBe("۲٬۳۲۵٬۰۰۰");
    expect(fmtPrice(0.00001234, false)).toBe("0.000012");
    expect(fmtPrice(NaN)).toBe("—");
  });
  it("formats percents", () => {
    expect(fmtPct(2.56, false)).toBe("+2.56%");
    expect(fmtPct(-0.5, true)).toContain("−");
    expect(fmtPct(null)).toBe("—");
  });
  it("groups thousands", () => {
    expect(groupThousands(1234567, false)).toBe("1,234,567");
  });
  it("picks snapshot items in order", () => {
    const snap = {
      usdIrt: 10,
      items: [
        { id: "BTC", priceIRT: 5 },
        { id: "USD", priceIRT: 10 },
      ],
    };
    expect(pickItems(snap, ["USD", "NOPE", "BTC"]).map((i) => i.id)).toEqual(["USD", "BTC"]);
    expect(usdToman(snap)).toBe(10);
    expect(usdToman({ items: [] })).toBeNull();
  });
  it("resolves artwork against the app server", () => {
    expect(DEFAULT_BASE).toBe("https://price-pwa.vercel.app");
    expect(artUrl("/coins/bitcoin.png", "http://localhost:3000")).toBe(
      "http://localhost:3000/coins/bitcoin.png",
    );
    expect(artUrl("https://x/y.png", "http://localhost:3000")).toBe("https://x/y.png");
    expect(artUrl(null, "http://localhost:3000")).toBeNull();
    expect(flagImg("USD", "http://localhost:3000")).toBe("http://localhost:3000/flags/us.png");
    expect(flagImg("BTC", "http://localhost:3000")).toBeNull();
  });
});
