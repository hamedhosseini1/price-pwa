import { describe, it, expect } from "vitest";
import {
  formatNumber,
  formatPercent,
  formatSigned,
  parsePrice,
  timeAgo,
} from "../lib/format";

describe("format", () => {
  it("groups thousands in fa and en", () => {
    expect(formatNumber(2325000, "en")).toBe("2,325,000");
    expect(formatNumber(2325000, "fa")).toBe("۲٬۳۲۵٬۰۰۰");
  });
  it("adapts fraction digits to magnitude", () => {
    expect(formatNumber(0.00001234, "en")).toBe("0.000012");
    expect(formatNumber(68.83, "en")).toBe("68.83");
  });
  it("signs changes", () => {
    expect(formatSigned(58, "en")).toBe("+58");
    expect(formatSigned(-58, "fa")).toContain("−");
    expect(formatPercent(2.56, "en")).toBe("+2.56%");
    expect(formatPercent(null)).toBe("—");
  });
  it("parses mixed digit formats", () => {
    expect(parsePrice("2,325,000")).toBe(2325000);
    expect(parsePrice("۲٬۳۲۵٬۰۰۰")).toBe(2325000);
    expect(parsePrice("68.83")).toBe(68.83);
    expect(parsePrice("-")).toBeNull();
    expect(parsePrice("abc")).toBeNull();
  });
  it("renders relative time", () => {
    const now = Date.now();
    expect(timeAgo(now - 5000, now)).toBe("لحظاتی پیش");
    expect(timeAgo(now - 180_000, now)).toContain("دقیقه پیش");
  });
});
