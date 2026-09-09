/**
 * Shared HTTP helper for upstream fetchers: timeout, UA header,
 * polite single-flight, and uniform error shape.
 */
export interface FetchResult<T> {
  ok: boolean;
  data?: T;
  ms: number;
  error?: string;
  /** HTTP status when known (used for 429 backoff) */
  status?: number;
}

const UA = "price-pwa/1.0 (+https://github.com/price-pwa; contact: admin@localhost)";

export async function fetchJson<T>(
  url: string,
  opts: { timeoutMs?: number; headers?: Record<string, string>; method?: string; body?: string } = {},
): Promise<FetchResult<T>> {
  const started = Date.now();
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 15000);
  try {
    const res = await fetch(url, {
      method: opts.method ?? "GET",
      headers: { "User-Agent": UA, Accept: "application/json", ...(opts.headers ?? {}) },
      body: opts.body,
      signal: ctrl.signal,
      // Next.js route handlers: never cache upstream responses in fetch cache
      cache: "no-store",
    });
    const ms = Date.now() - started;
    if (!res.ok) return { ok: false, ms, error: `HTTP ${res.status}`, status: res.status };
    const text = await res.text();
    try {
      return { ok: true, data: JSON.parse(text) as T, ms };
    } catch {
      return { ok: false, ms, error: "invalid-json" };
    }
  } catch (e) {
    return { ok: false, ms: Date.now() - started, error: e instanceof Error ? e.message : "fetch-failed" };
  } finally {
    clearTimeout(t);
  }
}

export async function fetchText(
  url: string,
  opts: { timeoutMs?: number; headers?: Record<string, string> } = {},
): Promise<FetchResult<string>> {
  const started = Date.now();
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 20000);
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
        ...(opts.headers ?? {}),
      },
      signal: ctrl.signal,
      cache: "no-store",
    });
    const ms = Date.now() - started;
    if (!res.ok) return { ok: false, ms, error: `HTTP ${res.status}` };
    return { ok: true, data: await res.text(), ms };
  } catch (e) {
    return { ok: false, ms: Date.now() - started, error: e instanceof Error ? e.message : "fetch-failed" };
  } finally {
    clearTimeout(t);
  }
}

/** Raw quote map produced by each source fetcher: catalogId → quote fields. */
export interface RawQuote {
  price: number;
  /** price is for `per` units (converted to per-1 by aggregator using catalog) */
  per?: number;
  unit: "IRT" | "USD";
  time: number;
  changePct?: number | null;
  changeValue?: number | null;
  low?: number | null;
  high?: number | null;
}

export interface SourceDump {
  source: string;
  quotes: Record<string, RawQuote>;
  ms: number;
  error?: string;
  /** true when no HTTP request was made (missing key / disabled) — excluded from quota counters */
  skipped?: boolean;
}
