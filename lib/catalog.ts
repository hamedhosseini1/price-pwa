/**
 * Master catalog of every price item.
 *
 * Each item declares how to find it in every upstream source:
 *  - brs:      symbol in BrsApi free API (Gold_Currency.php / Commodity.php)
 *  - tgju:     row slugs + title keywords on tgju.org homepage table
 *  - frankfurter: ISO code for ECB cross-check (fiat → USD)
 *  - coingecko: coin id for crypto cross-check (USD)
 *  - nobitex:  `SRC-DST` market symbol (crypto → IRT, when reachable)
 *  - bonbast:  key prefix in bonbast homepage (optional, off by default)
 *
 * `per`: nominal size of one quoted unit (e.g. JPY is quoted per 100 yen).
 */
import type { Category, PriceUnit } from "./types";

export interface CatalogEntry {
  id: string;
  fa: string;
  en: string;
  category: Category;
  badge: string;
  nativeUnit: PriceUnit;
  per: number;
  decimals?: number;
  src: {
    brs?: string;
    tgjuSlugs?: string[];
    tgjuTitles?: string[];
    frankfurter?: string;
    coingecko?: string;
    nobitex?: string;
    bonbast?: string;
  };
}

const C = (
  id: string,
  fa: string,
  en: string,
  category: Category,
  badge: string,
  nativeUnit: PriceUnit,
  src: CatalogEntry["src"],
  per = 1,
): CatalogEntry => ({ id, fa, en, category, badge, nativeUnit, per, src });

export const CATALOG: CatalogEntry[] = [
  // ── Fiat currencies (native: IRT/toman, free market) ──────────────────────
  C("USD", "دلار آمریکا", "US Dollar", "currency", "$", "IRT", {
    brs: "USD", tgjuSlugs: ["price_dollar_rl"], tgjuTitles: ["دلار"], frankfurter: "USD", bonbast: "usd",
  }),
  C("USDT_IRT", "دلار تتر", "Tether (IRT)", "currency", "₮", "IRT", {
    brs: "USDT_IRT", tgjuSlugs: ["crypto-tether-irr"], tgjuTitles: ["تتر"],
  }),
  C("EUR", "یورو", "Euro", "currency", "€", "IRT", {
    brs: "EUR", tgjuSlugs: ["price_eur"], tgjuTitles: ["یورو"], frankfurter: "EUR", bonbast: "eur",
  }),
  C("GBP", "پوند انگلیس", "British Pound", "currency", "£", "IRT", {
    brs: "GBP", tgjuSlugs: ["price_gbp"], tgjuTitles: ["پوند"], frankfurter: "GBP", bonbast: "gbp",
  }),
  C("AED", "درهم امارات", "UAE Dirham", "currency", "د.إ", "IRT", {
    brs: "AED", tgjuSlugs: ["price_aed"], tgjuTitles: ["درهم"], bonbast: "aed",
  }),
  C("TRY", "لیر ترکیه", "Turkish Lira", "currency", "₺", "IRT", {
    brs: "TRY", tgjuSlugs: ["price_try"], tgjuTitles: ["لیر ترکیه", "لیر"], frankfurter: "TRY", bonbast: "try",
  }),
  C("CAD", "دلار کانادا", "Canadian Dollar", "currency", "C$", "IRT", {
    brs: "CAD", tgjuSlugs: ["price_cad"], tgjuTitles: ["کانادا"], frankfurter: "CAD", bonbast: "cad",
  }),
  C("AUD", "دلار استرالیا", "Australian Dollar", "currency", "A$", "IRT", {
    brs: "AUD", tgjuSlugs: ["price_aud"], tgjuTitles: ["استرالیا"], frankfurter: "AUD", bonbast: "aud",
  }),
  C("CHF", "فرانک سوئیس", "Swiss Franc", "currency", "Fr", "IRT", {
    brs: "CHF", tgjuSlugs: ["price_chf"], tgjuTitles: ["فرانک"], frankfurter: "CHF", bonbast: "chf",
  }),
  C("JPY", "ین ژاپن (۱۰۰ ین)", "Japanese Yen (100)", "currency", "¥", "IRT", {
    brs: "JPY", tgjuSlugs: ["price_jpy"], tgjuTitles: ["ین"], frankfurter: "JPY", bonbast: "jpy",
  }, 100),
  C("CNY", "یوآن چین", "Chinese Yuan", "currency", "¥", "IRT", {
    brs: "CNY", tgjuSlugs: ["price_cny"], tgjuTitles: ["یوآن", "یوان"], frankfurter: "CNY", bonbast: "cny",
  }),
  C("RUB", "روبل روسیه", "Russian Ruble", "currency", "₽", "IRT", {
    brs: "RUB", tgjuSlugs: ["price_rub"], tgjuTitles: ["روبل"], bonbast: "rub",
  }),
  C("SAR", "ریال عربستان", "Saudi Riyal", "currency", "﷼", "IRT", {
    brs: "SAR", tgjuSlugs: ["price_sar"], tgjuTitles: ["عربستان"], bonbast: "sar",
  }),
  C("KWD", "دینار کویت", "Kuwaiti Dinar", "currency", "د.ک", "IRT", {
    brs: "KWD", tgjuSlugs: ["price_kwd"], tgjuTitles: ["کویت"], bonbast: "kwd",
  }),
  C("QAR", "ریال قطر", "Qatari Riyal", "currency", "ر.ق", "IRT", {
    brs: "QAR", tgjuSlugs: ["price_qar"], tgjuTitles: ["قطر"], bonbast: "qar",
  }),
  C("MYR", "رینگیت مالزی", "Malaysian Ringgit", "currency", "RM", "IRT", {
    brs: "MYR", tgjuSlugs: ["price_myr"], tgjuTitles: ["رینگیت", "مالزی"], bonbast: "myr",
  }),
  C("INR", "روپیه هند", "Indian Rupee", "currency", "₹", "IRT", {
    brs: "INR", tgjuTitles: ["روپیه هند", "هند"], frankfurter: "INR", bonbast: "inr",
  }),
  C("PKR", "روپیه پاکستان", "Pakistani Rupee", "currency", "₨", "IRT", {
    brs: "PKR", tgjuTitles: ["پاکستان"],
  }),
  C("IQD", "دینار عراق", "Iraqi Dinar", "currency", "د.ع", "IRT", {
    brs: "IQD", tgjuTitles: ["عراق"], bonbast: "iqd",
  }),
  C("SYP", "لیر سوریه", "Syrian Pound", "currency", "£S", "IRT", {
    brs: "SYP", tgjuTitles: ["سوریه"],
  }),
  C("SEK", "کرون سوئد", "Swedish Krona", "currency", "kr", "IRT", {
    brs: "SEK", tgjuTitles: ["کرون سوئد", "سوئد"], frankfurter: "SEK", bonbast: "sek",
  }),
  C("OMR", "ریال عمان", "Omani Rial", "currency", "ر.ع", "IRT", {
    brs: "OMR", tgjuTitles: ["عمان"], bonbast: "omr",
  }),
  C("BHD", "دینار بحرین", "Bahraini Dinar", "currency", "د.ب", "IRT", {
    brs: "BHD", tgjuTitles: ["بحرین"], bonbast: "bhd",
  }),
  C("AFN", "افغانی", "Afghan Afghani", "currency", "؋", "IRT", {
    brs: "AFN", tgjuTitles: ["افغانی", "افغانستان"], bonbast: "afn",
  }),
  C("THB", "بات تایلند", "Thai Baht", "currency", "฿", "IRT", {
    brs: "THB", tgjuTitles: ["بات", "تایلند"], frankfurter: "THB", bonbast: "thb",
  }),
  C("AZN", "منات آذربایجان", "Azerbaijani Manat", "currency", "₼", "IRT", {
    brs: "AZN", tgjuTitles: ["منات", "آذربایجان"], bonbast: "azn",
  }),
  C("AMD", "درام ارمنستان", "Armenian Dram", "currency", "֏", "IRT", {
    brs: "AMD", tgjuTitles: ["درام", "ارمنستان"], bonbast: "amd",
  }),
  C("GEL", "لاری گرجستان", "Georgian Lari", "currency", "₾", "IRT", {
    brs: "GEL", tgjuTitles: ["لاری", "گرجستان"],
  }),
  // NIMA official rate — mapped from tgju SANA/NIMA section (best effort)
  C("NIMA", "دلار نیما", "NIMA Rate", "currency", "نیما", "IRT", {
    tgjuSlugs: ["nima_sell_usd"],
  }),

  // ── Gold & coins ───────────────────────────────────────────────────────────
  C("GOLD18", "طلای ۱۸ عیار (گرم)", "18K Gold (gram)", "gold", "Au", "IRT", {
    brs: "IR_GOLD_18K", tgjuSlugs: ["geram18"], tgjuTitles: ["۱۸ عیار"], bonbast: "gol18",
  }),
  C("GOLD24", "طلای ۲۴ عیار (گرم)", "24K Gold (gram)", "gold", "Au", "IRT", {
    brs: "IR_GOLD_24K", tgjuSlugs: ["geram24"], tgjuTitles: ["۲۴ عیار"],
  }),
  C("MELTED", "طلای آب‌شده نقدی (مثقال)", "Melted Gold (mithqal)", "gold", "مثقال", "IRT", {
    brs: "IR_GOLD_MELTED", tgjuTitles: ["آب‌شده"],
  }),
  C("MITHQAL", "مثقال طلا", "Gold Mithqal", "gold", "مثقال", "IRT", {
    tgjuSlugs: ["mesghal"], tgjuTitles: ["مثقال", "مظنه"], bonbast: "mithqal",
  }),
  C("XAU", "انس جهانی طلا", "Gold Ounce (XAU)", "gold", "XAU", "USD", {
    brs: "XAUUSD", tgjuSlugs: ["ons"], tgjuTitles: ["انس طلا"], bonbast: "ounce",
  }),
  C("XAG_IR", "نقره داخلی (گرم)", "Silver (domestic, gram)", "gold", "Ag", "IRT", {
    tgjuTitles: ["نقره"],
  }),
  C("COIN_EMAMI", "سکه امامی", "Emami Coin", "gold", "سکه", "IRT", {
    brs: "IR_COIN_EMAMI", tgjuTitles: ["امامی"], bonbast: "emami",
  }),
  C("COIN_BAHAR", "سکه بهار آزادی", "Bahar Azadi Coin", "gold", "سکه", "IRT", {
    brs: "IR_COIN_BAHAR", tgjuTitles: ["بهار آزادی"], bonbast: "azadi",
  }),
  C("COIN_HALF", "نیم‌سکه", "Half Coin", "gold", "½", "IRT", {
    brs: "IR_COIN_HALF", tgjuTitles: ["نیم"], bonbast: "azadi1_2",
  }),
  C("COIN_QUARTER", "ربع‌سکه", "Quarter Coin", "gold", "¼", "IRT", {
    brs: "IR_COIN_QUARTER", tgjuTitles: ["ربع"], bonbast: "azadi1_4",
  }),
  C("COIN_1G", "سکه گرمی", "Gram Coin", "gold", "1g", "IRT", {
    brs: "IR_COIN_1G", tgjuTitles: ["گرمی"], bonbast: "azadi1g",
  }),

  // ── Precious metals, global (native USD) ───────────────────────────────────
  C("XAG", "انس جهانی نقره", "Silver Ounce (XAG)", "metal", "XAG", "USD", {
    brs: "XAGUSD", tgjuTitles: ["انس نقره"],
  }),
  C("XPT", "انس پلاتین", "Platinum Ounce (XPT)", "metal", "XPT", "USD", {
    brs: "XPTUSD",
  }),
  C("XPD", "انس پالادیوم", "Palladium Ounce (XPD)", "metal", "XPD", "USD", {
    brs: "XPDUSD",
  }),

  // ── Crypto (native USD; IRT derived via live USD/IRT) ─────────────────────
  // NOTE: tgju crypto rows flip between USD and RIAL quoting (observed BTC
  // served as ~1.8e11, i.e. rial, then as 78950 USD) → NOT mapped. Crypto is
  // covered by brsapi + coingecko + nobitex.
  C("BTC", "بیت‌کوین", "Bitcoin", "crypto", "₿", "USD", {
    brs: "BTC", coingecko: "bitcoin", nobitex: "BTC-IRT", bonbast: "bitcoin",
  }),
  C("ETH", "اتریوم", "Ethereum", "crypto", "Ξ", "USD", {
    brs: "ETH", coingecko: "ethereum", nobitex: "ETH-IRT",
  }),
  C("USDT", "تتر", "Tether", "crypto", "₮", "USD", {
    brs: "USDT", coingecko: "tether", nobitex: "USDT-IRT",
  }),
  C("XRP", "ریپل", "XRP", "crypto", "XRP", "USD", {
    brs: "XRP", coingecko: "ripple", nobitex: "XRP-IRT",
  }),
  C("BNB", "بایننس‌کوین", "BNB", "crypto", "BNB", "USD", {
    brs: "BNB", coingecko: "binancecoin", nobitex: "BNB-IRT",
  }),
  C("SOL", "سولانا", "Solana", "crypto", "SOL", "USD", {
    brs: "SOL", coingecko: "solana", nobitex: "SOL-IRT",
  }),
  C("USDC", "یو‌اس‌دی کوین", "USD Coin", "crypto", "USDC", "USD", {
    brs: "USDC", coingecko: "usd-coin",
  }),
  C("DOGE", "دوج‌کوین", "Dogecoin", "crypto", "Ð", "USD", {
    brs: "DOGE", coingecko: "dogecoin", nobitex: "DOGE-IRT",
  }),
  C("ADA", "کاردانو", "Cardano", "crypto", "ADA", "USD", {
    brs: "ADA", coingecko: "cardano", nobitex: "ADA-IRT",
  }),
  C("TRX", "ترون", "TRON", "crypto", "TRX", "USD", {
    brs: "TRX", coingecko: "tron", nobitex: "TRX-IRT",
  }),
  C("LINK", "چین‌لینک", "Chainlink", "crypto", "LINK", "USD", {
    brs: "LINK", coingecko: "chainlink",
  }),
  C("AVAX", "آوالانچ", "Avalanche", "crypto", "AVAX", "USD", {
    brs: "AVAX", coingecko: "avalanche-2",
  }),
  C("XLM", "استلار", "Stellar", "crypto", "XLM", "USD", {
    brs: "XLM", coingecko: "stellar", nobitex: "XLM-IRT",
  }),
  C("SHIB", "شیبا اینو", "Shiba Inu", "crypto", "SHIB", "USD", {
    brs: "SHIB", coingecko: "shiba-inu", nobitex: "SHIB-IRT",
  }),
  C("DOT", "پولکادات", "Polkadot", "crypto", "DOT", "USD", {
    brs: "DOT", coingecko: "polkadot", nobitex: "DOT-IRT",
  }),
  C("LTC", "لایت‌کوین", "Litecoin", "crypto", "Ł", "USD", {
    brs: "LTC", coingecko: "litecoin", nobitex: "LTC-IRT",
  }),
  C("UNI", "یونی‌سواپ", "Uniswap", "crypto", "UNI", "USD", {
    brs: "UNI", coingecko: "uniswap", nobitex: "UNI-IRT",
  }),
  C("FIL", "فایل‌کوین", "Filecoin", "crypto", "FIL", "USD", {
    brs: "FIL", coingecko: "filecoin",
  }),
  C("ATOM", "کازماس", "Cosmos", "crypto", "ATOM", "USD", {
    brs: "ATOM", coingecko: "cosmos", nobitex: "ATOM-IRT",
  }),

  // ── Energy (native USD) ────────────────────────────────────────────────────
  // ── Energy (native USD). Oil verified live 2026-09-09 against two feeds
  // (BrsApi Brent 101.37 + Tgju 101.06, textbook $5 Brent-WTI spread, live
  // intraday changes) + global gold cross-checks (PAXG/gold-api $4,399).
  C("BRENT", "نفت برنت", "Brent Crude", "oil", "BRT", "USD", {
    brs: "BRENT", tgjuSlugs: ["oil_brent"], tgjuTitles: ["برنت"],
  }),
  C("WTI", "نفت WTI", "WTI Crude", "oil", "WTI", "USD", {
    brs: "WTI", tgjuTitles: ["نفت سبک", "تگزاس"],
  }),
  C("GAS", "گاز طبیعی", "Natural Gas", "oil", "GAS", "USD", {
    brs: "GAS", tgjuTitles: ["گاز طبیعی"],
  }),
];

export const CATALOG_BY_ID: Record<string, CatalogEntry> = Object.fromEntries(
  CATALOG.map((c) => [c.id, c]),
);

/** CoinGecko id → catalog id (for the markets endpoint fan-out). */
export const COINGECKO_MAP: Record<string, string> = Object.fromEntries(
  CATALOG.filter((c) => c.src.coingecko).map((c) => [c.src.coingecko as string, c.id]),
);

/** BrsApi symbol → catalog id. */
export const BRS_MAP: Record<string, string> = Object.fromEntries(
  CATALOG.filter((c) => c.src.brs).map((c) => [c.src.brs as string, c.id]),
);

/** ISO country code for the fiat flag (vendored locally: public/flags).
 * Regenerate with: node scripts/fetch-assets.mjs */
export const FLAGS: Record<string, string> = {
  USD: "us", EUR: "eu", GBP: "gb", AED: "ae", TRY: "tr", CAD: "ca", AUD: "au",
  CHF: "ch", JPY: "jp", CNY: "cn", RUB: "ru", SAR: "sa", KWD: "kw", QAR: "qa",
  MYR: "my", INR: "in", PKR: "pk", IQD: "iq", SYP: "sy", SEK: "se", OMR: "om",
  BHD: "bh", AFN: "af", THB: "th", AZN: "az", AMD: "am", GEL: "ge",
};

export function flagUrl(id: string): string | null {
  const code = FLAGS[id];
  return code ? `/flags/${code}.png` : null;
}

export const CATEGORY_FA: Record<Category, string> = {  currency: "ارز",
  gold: "طلا و سکه",
  crypto: "کریپتو",
  oil: "نفت و انرژی",
  metal: "فلزات جهانی",
};

export const CATEGORY_ORDER: Category[] = ["currency", "gold", "crypto", "oil", "metal"];
