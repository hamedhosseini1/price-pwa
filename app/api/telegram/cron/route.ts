import { NextResponse } from "next/server";
import { getSnapshot } from "@/lib/store";
import { TgClient, escapeHtml } from "@/lib/telegram/client";
import { allChats, getAlerts, delAlert, type AlertRule } from "@/lib/telegram/store";
import { CATALOG_BY_ID } from "@/lib/catalog";
import { formatNumber } from "@/lib/format";

export const dynamic = "force-dynamic";

/**
 * Alert checker — called by Vercel Cron (vercel.json → every 5 min).
 * Vercel sends `Authorization: Bearer $CRON_SECRET` automatically when set.
 * Fired rules are one-shot: notified once, then removed.
 */
export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
  }
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return NextResponse.json({ error: "bot-not-configured" }, { status: 503 });

  const tg = new TgClient(token);
  const { snap } = await getSnapshot();
  const byId = Object.fromEntries((snap?.items ?? []).map((i) => [i.id, i]));
  let checked = 0;
  let fired = 0;

  for (const chat of await allChats()) {
    const rules = await getAlerts(chat);
    if (!rules.length) continue;
    // iterate over a copy with original indices for deletion
    for (let idx = rules.length - 1; idx >= 0; idx--) {
      const r: AlertRule = rules[idx];
      const it = byId[r.id];
      if (!it) continue;
      checked++;
      const price = r.currency === "IRT" ? it.priceIRT : it.priceUSD;
      if (price == null) continue;
      const hit = r.dir === "above" ? price >= r.target : price <= r.target;
      if (!hit) continue;
      const entry = CATALOG_BY_ID[r.id];
      const dirFa = r.dir === "above" ? "بالاتر رفت از" : "پایین‌تر آمد از";
      try {
        await tg.send(
          Number(chat),
          `🔔 <b>هشدار قیمت!</b>\n${escapeHtml(entry?.fa ?? r.id)} ${dirFa} <b>${formatNumber(r.target, "fa")}</b> ${r.currency === "IRT" ? "تومان" : "دلار"} شد.\nقیمت فعلی: <b>${formatNumber(price, "fa")}</b>`,
        );
        fired++;
      } catch {
        /* one bad chat must not stop the sweep */
      }
      await delAlert(chat, idx);
    }
  }
  return NextResponse.json({ ok: true, checked, fired });
}
