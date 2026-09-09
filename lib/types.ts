/** Core domain types for the live-price PWA. */

export type Category = "currency" | "gold" | "crypto" | "oil" | "metal";

export type PriceUnit = "IRT" | "USD";

/** One raw quote from a single upstream source (always normalized to per-1-unit). */
export interface Quote {
  /** Source key, e.g. "brsapi", "tgju", "coingecko" */
  source: string;
  /** Price normalized to a single unit of the item */
  price: number;
  /** Unit the price is denominated in */
  unit: PriceUnit;
  /** Unix ms timestamp of the quote */
  time: number;
  /** 24h change percent reported by the source (if any) */
  changePct?: number | null;
  /** 24h absolute change reported by the source (same unit as price) */
  changeValue?: number | null;
}

/** Fully aggregated item served to the frontend. */
export interface AggregatedItem {
  id: string;
  fa: string;
  en: string;
  category: Category;
  /** Short badge shown in UI (currency symbol / ticker) */
  badge: string;
  /** Optional image URL (e.g. CoinGecko coin icon). UI falls back to badge. */
  icon?: string | null;
  /** Native market unit (items natively priced in IRT vs USD) */
  nativeUnit: PriceUnit;
  /** Aggregated price in both units (converted via live USD/IRT rate) */
  priceIRT: number | null;
  priceUSD: number | null;
  /** 24h change percent (native unit) */
  changePct: number | null;
  /** 24h absolute change (native unit) */
  changeValue: number | null;
  /** Day low / high in native unit (when any source reports it) */
  low: number | null;
  high: number | null;
  /** Last update across contributing sources (unix ms) */
  updatedAt: number;
  /** Raw per-source quotes (transparency: show under each item) */
  sources: Quote[];
  /** Item hidden from UI when true (e.g. zero quotes) */
  unavailable?: boolean;
}

export interface Snapshot {
  generatedAt: number;
  /** Live USD -> IRT (toman) rate used for conversions */
  usdIrt: number | null;
  usdIrtSource: string | null;
  items: AggregatedItem[];
  /** Per-source health for the status bar / docs */
  sourceStatus: Record<string, { ok: boolean; ms: number; error?: string; count?: number }>;
}

export interface HistoryPoint {
  t: number;
  price: number;
}

export interface HistoryResponse {
  id: string;
  range: "24h" | "7d" | "1m";
  unit: PriceUnit;
  nativeUnit: PriceUnit;
  points: HistoryPoint[];
  sources: string[];
}
