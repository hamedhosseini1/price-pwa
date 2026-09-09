import { describe, it, expect } from "vitest";
import { parseTgjuHome, mapTgjuRows } from "../lib/sources/tgju";

const HTML = `
<table><tbody>
<tr data-market-row="price_dollar_rl" data-price="2,325,000">
<th>دلار</th><td class="nf">2,325,000</td>
<td class="nf"><span class="high">(2.56%) 58,000</span></td>
<td>2,276,600</td><td>2,328,200</td><td>۱۸:۳۴:۵۳</td></tr>
<tr data-market-row="price_cad" data-price="1,650,000">
<th>دلار کانادا</th><td class="nf">1,650,000</td>
<td class="nf"><span class="low">(0.41%) 6,800</span></td>
<td>1,640,000</td><td>1,660,000</td><td>۱۸:۳۴:۵۳</td></tr>
<tr data-market-row="geram18" data-price="62,147,000">
<th>طلای 18 عیار</th><td class="nf">62,147,000</td>
<td class="nf"><span class="low">(1.53%) 951,000</span></td>
<td>61,900,000</td><td>62,300,000</td><td>۱۸:۳۰:۰۰</td></tr>
<tr data-market-row="ons" data-price="3,201">
<th>انس طلا</th><td class="nf">3,201</td>
<td class="nf">-</td><td>3,190</td><td>3,210</td><td>۱۸:۰۰:۰۰</td></tr>
</tbody></table>`;

describe("tgju homepage parser", () => {
  it("extracts rows with prices and changes", () => {
    const rows = parseTgjuHome(HTML);
    expect(rows).toHaveLength(4);
    expect(rows[0]).toMatchObject({ slug: "price_dollar_rl", title: "دلار", price: 2325000 });
    expect(rows[0].changePct).toBeCloseTo(2.56);
    expect(rows[1].changePct).toBeCloseTo(-0.41);
    expect(rows[3].changePct).toBeNull();
  });

  it("maps rows to catalog ids (slug priority, longest-title fallback, rial→toman)", () => {
    const q = mapTgjuRows(parseTgjuHome(HTML));
    // 2,325,000 rial → 232,500 toman
    expect(q["USD"].price).toBe(232500);
    expect(q["USD"].unit).toBe("IRT");
    // 'دلار کانادا' must map to CAD (longer keyword wins over generic 'دلار')
    expect(q["CAD"].price).toBe(165000);
    expect(q["USD"].price).not.toBe(165000);
    // latin digits normalized → GOLD18
    expect(q["GOLD18"].price).toBe(6214700);
    // XAU is USD-denominated on tgju too → kept as USD (no rial conversion)
    expect(q["XAU"]).toMatchObject({ price: 3201, unit: "USD" });
  });

  it("survives data-title attributes containing '>' and prefers slug matches", () => {
    const html = `
<tr data-market-nameslug="price_dollar_rl" data-market-row="price_dollar_rl" data-title="<div class='tooltip-row'><span class='type high'>(2.56%) 58000</span></div>" class="pointer" data-price="2,325,000">
<th>دلار</th><td class="nf">2,325,000</td><td class="nf"><span class="high">(2.56%) 58,000</span></td><td>2,276,600</td><td>2,328,200</td><td>۱۸:۳۴:۵۳</td></tr>
<tr data-market-row="sana_buy_usd" data-title="x" data-price="1,294,782">
<th>دلار سنا</th><td class="nf">1,294,782</td><td class="nf">-</td><td>-</td><td>-</td><td>-</td></tr>`;
    const rows = parseTgjuHome(html);
    expect(rows).toHaveLength(2);
    const q = mapTgjuRows(rows);
    // slug match (free market) wins over the later title-only SANA row
    expect(q["USD"].price).toBe(232500);
  });
});
