/**
 * Vendor external artwork LOCALLY (no runtime CDN dependency):
 *  1. Country flags (flagcdn.com, w80)      → public/flags/{iso}.png
 *  2. Crypto logos (CoinGecko `image`)      → public/coins/{coingecko-id}.png
 *  3. Manifest catalogId → local URL        → lib/coin-icons.json
 *
 * Run once (and whenever you want fresh coin logos):  node scripts/fetch-assets.mjs
 * NOTE: keep FLAG_ISO / COINS in sync with lib/catalog.ts.
 */
import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const UA = "price-pwa/1.0 (asset-vendor)";

const FLAG_ISO = [
  "us", "eu", "gb", "ae", "tr", "ca", "au", "ch", "jp", "cn", "ru", "sa",
  "kw", "qa", "my", "in", "pk", "iq", "sy", "se", "om", "bh", "af",
  "th", "az", "am", "ge",
];
// coingeckoId → catalogId (mirrors lib/catalog.ts COINGECKO_MAP subset)
const COINS = {
  bitcoin: "BTC", ethereum: "ETH", tether: "USDT", ripple: "XRP", binancecoin: "BNB",
  solana: "SOL", "usd-coin": "USDC", dogecoin: "DOGE", cardano: "ADA", tron: "TRX",
  chainlink: "LINK", "avalanche-2": "AVAX", stellar: "XLM", "shiba-inu": "SHIB",
  polkadot: "DOT", litecoin: "LTC", uniswap: "UNI", filecoin: "FIL", cosmos: "ATOM",
};

async function dl(url, file) {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 100) throw new Error(`suspiciously small file for ${url}`);
  await fs.writeFile(file, buf);
  return buf.length;
}

async function main() {
  const flagsDir = path.join(ROOT, "public", "flags");
  const coinsDir = path.join(ROOT, "public", "coins");
  await fs.mkdir(flagsDir, { recursive: true });
  await fs.mkdir(coinsDir, { recursive: true });

  let ok = 0;
  for (const iso of new Set(FLAG_ISO)) {
    try {
      const n = await dl(`https://flagcdn.com/w80/${iso}.png`, path.join(flagsDir, `${iso}.png`));
      console.log(`flag ${iso}.png ${n}b`);
      ok++;
    } catch (e) {
      console.error(`flag ${iso} FAILED:`, e.message);
    }
  }

  // coin images: resolve via markets endpoint, then download
  const ids = Object.keys(COINS).join(",");
  const markets = await fetch(
    `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}&per_page=${Object.keys(COINS).length}&page=1&sparkline=false`,
    { headers: { "User-Agent": UA } },
  ).then((r) => {
    if (!r.ok) throw new Error(`markets HTTP ${r.status}`);
    return r.json();
  });
  const manifest = {};
  for (const c of markets) {
    const cid = COINS[c.id];
    if (!cid || typeof c.image !== "string") continue;
    const file = path.join(coinsDir, `${c.id}.png`);
    try {
      const n = await dl(c.image, file);
      console.log(`coin ${c.id}.png ${n}b`);
      manifest[cid] = `/coins/${c.id}.png`;
      ok++;
    } catch (e) {
      console.error(`coin ${c.id} FAILED:`, e.message);
    }
  }
  await fs.writeFile(path.join(ROOT, "lib", "coin-icons.json"), JSON.stringify(manifest, null, 2) + "\n");
  console.log(`manifest: ${Object.keys(manifest).length} coins → lib/coin-icons.json`);
  console.log(`done, ${ok} files`);
  if (ok < FLAG_ISO.length) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
