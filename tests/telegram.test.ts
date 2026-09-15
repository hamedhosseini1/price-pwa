import { describe, it, expect } from "vitest";
import {
  parseCommand, resolveItem, parseAlertArgs, parseConvertArgs,
  itemCard, mainMenu, categoryMenu, HELP,
} from "../lib/telegram/commands";

const item = (over = {}) => ({
  id: "USD", fa: "دلار آمریکا", en: "US Dollar", category: "currency" as const,
  badge: "$", nativeUnit: "IRT" as const, priceIRT: 232500, priceUSD: 1.0,
  changePct: 2.65, changeValue: 6000, low: 230000, high: 233000,
  updatedAt: Date.now(), sources: [{ source: "brsapi", price: 232500, unit: "IRT" as const, time: Date.now() }],
  ...over,
});

describe("telegram commands", () => {
  it("parses /commands with bot-name suffix", () => {
    expect(parseCommand("/price@MyBot دلار")).toEqual({ cmd: "price", args: ["دلار"] });
    expect(parseCommand("/ALERT btc above 80000")).toEqual({ cmd: "alert", args: ["btc", "above", "80000"] });
    expect(parseCommand("hello")).toBeNull();
  });
  it("resolves fa/en/id", () => {
    expect(resolveItem("دلار آمریکا")?.id).toBe("USD");
    expect(resolveItem("bitcoin")?.id).toBe("BTC");
    expect(resolveItem("BTC")?.id).toBe("BTC");
    expect(resolveItem("nope")).toBeNull();
  });
  it("parses alert args (fa digits, fa direction, short names)", () => {
    expect(parseAlertArgs(["دلار", "بالا", "۲۴۰٬۰۰۰"])).toMatchObject({ ok: true, id: "USD", dir: "above", target: 240000 });
    expect(parseAlertArgs(["BTC", "above", "80000"])).toMatchObject({ ok: true, id: "BTC", dir: "above", target: 80000 });
    expect(resolveItem("دلار")?.id).toBe("USD");
    expect(resolveItem("سکه")?.id).toBe("COIN_EMAMI");
    expect(parseAlertArgs(["BTC", "above"])).toMatchObject({ ok: false });
    expect(parseAlertArgs(["BTC", "sideways", "5"])).toMatchObject({ ok: false });
  });
  it("parses convert args incl. multiword fa names", () => {
    const ok = parseConvertArgs(["100", "USD", "EUR"]);
    expect(ok).toMatchObject({ ok: true, amount: 100 });
    if (ok.ok) {
      expect(ok.from.id).toBe("USD");
      expect(ok.to.id).toBe("EUR");
    }
    const fa = parseConvertArgs(["۱۰۰", "دلار", "یورو"]);
    if (fa.ok) {
      expect(fa.amount).toBe(100);
      expect(fa.from.id).toBe("USD");
      expect(fa.to.id).toBe("EUR");
    } else {
      throw new Error("fa convert should parse");
    }
    expect(parseConvertArgs(["100", "USD"])).toMatchObject({ ok: false });
  });
  it("formats item cards with both units", () => {
    const html = itemCard(item());
    expect(html).toContain("دلار آمریکا");
    expect(html).toContain("۲۳۲٬۵۰۰");
    expect(html).toContain("BrsApi");
  });
  it("builds menus", () => {
    const m = mainMenu("IRT");
    expect(m.kb.inline_keyboard.flat().map((b) => b.callback_data)).toContain("cat:crypto");
    const c = categoryMenu("crypto", [item({ id: "BTC", fa: "بیت‌کوین" })], "IRT");
    expect(c.kb.inline_keyboard[0][0].callback_data).toBe("item:BTC");
    expect(HELP).toContain("/alert");
  });
});
