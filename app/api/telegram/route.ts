import { NextResponse } from "next/server";
import { getSnapshot } from "@/lib/store";
import { TgClient } from "@/lib/telegram/client";
import {
  touchChat, getCurrency, setCurrency, getAlerts, addAlert, delAlert,
} from "@/lib/telegram/store";
import {
  parseCommand, resolveItem, itemCard, rowLine, mainMenu, categoryMenu,
  itemNav, HELP, parseAlertArgs, parseConvertArgs, convertText,
} from "@/lib/telegram/commands";
import { formatNumber } from "@/lib/format";

export const dynamic = "force-dynamic";

const QUICK: Record<string, string> = {
  usd: "USD", eur: "EUR", gold: "GOLD18", coin: "COIN_EMAMI",
  btc: "BTC", xau: "XAU", brent: "BRENT",
};
const TOP_IDS = ["USD", "EUR", "GOLD18", "COIN_EMAMI", "BTC", "XAU", "BRENT", "USDT"];

function token(): string {
  const t = process.env.TELEGRAM_BOT_TOKEN;
  if (!t) throw new Error("TELEGRAM_BOT_TOKEN not set");
  return t;
}

interface Update {
  message?: { chat: { id: number }; text?: string };
  callback_query?: { id: string; data?: string; message?: { chat: { id: number }; message_id: number } };
}

export async function POST(req: Request) {
  // verify Telegram secret (set as secret_token in setWebhook)
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (secret) {
    const got = req.headers.get("x-telegram-bot-api-secret-token");
    if (got !== secret) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  let update: Update;
  try {
    update = (await req.json()) as Update;
  } catch {
    return NextResponse.json({ error: "bad-json" }, { status: 400 });
  }
  try {
    await handle(update);
  } catch (e) {
    console.error("[telegram]", e instanceof Error ? e.message : e);
  }
  // always 200 so Telegram doesn't retry storms
  return NextResponse.json({ ok: true });
}

async function handle(u: Update): Promise<void> {
  const tg = new TgClient(token());
  if (u.callback_query) {
    const q = u.callback_query;
    const chat = String(q.message?.chat.id ?? "");
    if (!chat || !q.data) return;
    await touchChat(chat);
    await tg.answer(q.id);
    const cur = await getCurrency(chat);
    const [kind, ...rest] = q.data.split(":");
    const { snap } = await getSnapshot();
    const items = snap?.items ?? [];
    const byId = Object.fromEntries(items.map((i) => [i.id, i]));
    if (kind === "menu") {
      const m = mainMenu(cur);
      await tg.edit(Number(chat), q.message!.message_id, m.text, m.kb);
    } else if (kind === "cat") {
      const cat = rest[0];
      const list = items.filter((i) => (cat === "gold" ? i.category === "gold" || i.category === "metal" : i.category === cat));
      const m = categoryMenu(cat, list, cur);
      await tg.edit(Number(chat), q.message!.message_id, m.text, m.kb);
    } else if (kind === "item") {
      const it = byId[rest[0]];
      if (!it) return;
      await tg.edit(Number(chat), q.message!.message_id, itemCard(it), itemNav(it.id));
    } else if (kind === "cur") {
      const next = cur === "IRT" ? "USD" : "IRT";
      await setCurrency(chat, next);
      const m = mainMenu(next);
      await tg.edit(Number(chat), q.message!.message_id, m.text, m.kb);
    } else if (kind === "alerts") {
      await tg.edit(Number(chat), q.message!.message_id, await alertsText(chat), mainMenu(cur).kb);
    } else if (kind === "alert" && rest[0] === "new") {
      const id = rest[1];
      await tg.send(Number(chat), `برای «${id}» هشدار بساز:\n<code>/alert ${id} above 100000</code>\nجهت و حد را عوض کن (واحد فعلی: ${cur === "IRT" ? "تومان" : "دلار"}).`);
    }
    return;
  }
  const msg = u.message;
  if (!msg?.text) return;
  const chat = String(msg.chat.id);
  await touchChat(chat);
  const parsed = parseCommand(msg.text);
  if (!parsed) {
    // plain text → treat as search/price lookup
    await replyPrice(tg, chat, msg.text.trim());
    return;
  }
  const { cmd, args } = parsed;
  const cur = await getCurrency(chat);
  const { snap } = await getSnapshot();
  const items = snap?.items ?? [];
  const byId = Object.fromEntries(items.map((i) => [i.id, i]));

  switch (cmd) {
    case "start": {
      const m = mainMenu(cur);
      await tg.send(Number(chat), m.text, m.kb);
      break;
    }
    case "help":
      await tg.send(Number(chat), HELP);
      break;
    case "menu": {
      const m = mainMenu(cur);
      await tg.send(Number(chat), m.text, m.kb);
      break;
    }
    case "cur": {
      const next = cur === "IRT" ? "USD" : "IRT";
      await setCurrency(chat, next);
      await tg.send(Number(chat), `واحد نمایش شد: <b>${next === "IRT" ? "تومان" : "دلار"}</b>`);
      break;
    }
    case "all": {
      const lines = TOP_IDS.map((id) => byId[id]).filter(Boolean).map((it) => rowLine(it, cur));
      await tg.send(Number(chat), `⭐ <b>مهم‌ترین‌ها</b> (${cur === "IRT" ? "تومان" : "دلار"}):\n\n${lines.join("\n")}`);
      break;
    }
    case "search": {
      const q = args.join(" ").toLowerCase();
      const hits = items.filter(
        (i) => i.fa.includes(args.join(" ")) || i.en.toLowerCase().includes(q) || i.id.toLowerCase().includes(q),
      ).slice(0, 12);
      await tg.send(
        Number(chat),
        hits.length
          ? `🔎 نتایج «${args.join(" ")}»:\n\n${hits.map((it) => rowLine(it, cur)).join("\n")}`
          : "چیزی پیدا نشد. عبارت دیگری را امتحان کن.",
      );
      break;
    }
    case "price":
      await replyPrice(tg, chat, args.join(" "));
      break;
    case "convert": {
      const p = parseConvertArgs(args);
      if (!p.ok) {
        await tg.send(Number(chat), p.error);
        break;
      }
      const f = byId[p.from.id];
      const t = byId[p.to.id];
      if (!f || !t) {
        await tg.send(Number(chat), "قیمت لحظه‌ای یکی از آیتم‌ها در دسترس نیست.");
        break;
      }
      await tg.send(Number(chat), convertText(p.amount, f, t));
      break;
    }
    case "alert": {
      const p = parseAlertArgs(args);
      if (!p.ok) {
        await tg.send(Number(chat), p.error);
        break;
      }
      await addAlert(chat, { id: p.id, dir: p.dir, target: p.target, currency: cur, createdAt: Date.now() });
      const dirFa = p.dir === "above" ? "بالاتر از" : "پایین‌تر از";
      await tg.send(Number(chat), `🔔 ثبت شد: «${p.id}» وقتی ${dirFa} <b>${formatNumber(p.target, "fa")}</b> ${cur === "IRT" ? "تومان" : "دلار"} شود خبرت می‌کنم.`);
      break;
    }
    case "alerts":
      await tg.send(Number(chat), await alertsText(chat));
      break;
    case "delalert": {
      const n = parseInt(args[0] ?? "", 10);
      if (!Number.isFinite(n) || n < 1) {
        await tg.send(Number(chat), "شماره هشدار را بده: <code>/delalert 1</code>");
        break;
      }
      await delAlert(chat, n - 1);
      await tg.send(Number(chat), await alertsText(chat));
      break;
    }
    default: {
      if (QUICK[cmd]) {
        const it = byId[QUICK[cmd]];
        await tg.send(Number(chat), it ? itemCard(it) : "داده‌ای در دسترس نیست.");
      } else {
        await replyPrice(tg, chat, [cmd, ...args].join(" "));
      }
    }
  }
}

async function replyPrice(tg: TgClient, chat: string, q: string): Promise<void> {
  const entry = resolveItem(q);
  if (!entry) {
    // fallback: substring search
    const { snap } = await getSnapshot();
    const items = snap?.items ?? [];
    const cur = await getCurrency(chat);
    const hits = items.filter(
      (i) => i.fa.includes(q) || i.en.toLowerCase().includes(q.toLowerCase()) || i.id.toLowerCase() === q.toLowerCase(),
    ).slice(0, 5);
    await tg.send(
      Number(chat),
      hits.length
        ? hits.map((it) => rowLine(it, cur)).join("\n")
        : `«${q}» پیدا نشد. /help را ببین یا از /search استفاده کن.`,
    );
    return;
  }
  const { snap } = await getSnapshot();
  const it = snap?.items.find((i) => i.id === entry.id);
  await tg.send(Number(chat), it ? itemCard(it) : "داده‌ای در دسترس نیست.", itemNav(entry.id));
}

async function alertsText(chat: string): Promise<string> {
  const list = await getAlerts(chat);
  if (!list.length) return "🔔 هشداری نداری. مثال ساخت:\n<code>/alert BTC above 80000</code>";
  const rows = list.map((a, i) => {
    const dirFa = a.dir === "above" ? "بالاتر از" : "پایین‌تر از";
    return `${formatNumber(i + 1, "fa")}. <b>${a.id}</b> ${dirFa} ${formatNumber(a.target, "fa")} ${a.currency === "IRT" ? "تومان" : "دلار"}`;
  });
  return `🔔 <b>هشدارهای فعال (${formatNumber(list.length, "fa")}):</b>\n${rows.join("\n")}\n\nحذف: <code>/delalert شماره</code>`;
}
