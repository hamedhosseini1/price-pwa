/**
 * Telegram webhook setup: verify token + point the bot at our webhook URL.
 *
 *   TELEGRAM_BOT_TOKEN=xxx TELEGRAM_WEBHOOK_SECRET=yyy \
 *     node scripts/telegram-setup.mjs [public-base-url]
 *
 * Defaults to https://price-pwa.vercel.app. Prints getMe + webhook info.
 */
import { TgClient } from "../lib/telegram/client.ts";

const token = process.env.TELEGRAM_BOT_TOKEN;
const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
const base = (process.argv[2] || "https://price-pwa.vercel.app").replace(/\/+$/, "");

if (!token || !secret) {
  console.error("need TELEGRAM_BOT_TOKEN and TELEGRAM_WEBHOOK_SECRET env vars");
  process.exit(1);
}

const tg = new TgClient(token);
const me = await tg.getMe();
console.log("bot:", `@${me.username} (id ${me.id})`);
await tg.setWebhook(`${base}/api/telegram`, secret);
console.log("webhook set →", `${base}/api/telegram`);
