/**
 * Server-side store: refresh orchestration, snapshot cache, intraday sampler.
 *
 * Quota safety (BrsApi free tier = 1500 req/day, 2 calls per BrsApi refresh):
 *  - Per-source TTLs: keyless sources refresh every REFRESH_MS (45s);
 *    BrsApi only every BRSAPI_REFRESH_MS (150s → 2×576 = 1152 calls/day,
 *    ~77% of quota, ~350 headroom for restarts).
 *  - HTTP 429 suspends that source for 15 min (backoff), reported in health.
 *  - BrsApi call counter exposed via /api/health for quota visibility.
 *  - History/health routes never call upstream (except on-demand
 *    tgju-archive/coingecko chart fetches, which don't touch BrsApi quota).
 */
import { promises as fs } from "fs";
import path from "path";
import type { Snapshot } from "./types";
import { buildSnapshot } from "./aggregate";
import { fetchBrsApi } from "./sources/brsapi";
import { fetchCoinGecko } from "./sources/coingecko";
import COIN_ICONS from "./coin-icons.json";
import { fetchFrankfurter } from "./sources/frankfurter";
import { fetchTgju } from "./sources/tgju";
import { fetchNobitex } from "./sources/nobitex";
import { fetchBonbast } from "./sources/bonbast";
import { fetchTwelveData } from "./sources/twelvedata";
import type { SourceDump } from "./sources/http";

export interface SamplePoint {
  t: number;
  irt: number | null;
  usd: number | null;
}

interface Store {
  snapshot: Snapshot | null;
  lastOkAt: number;
  lastAttemptAt: number;
  refreshing: Promise<Snapshot | null> | null;
  samples: Record<string, SamplePoint[]>;
  saveTimer: NodeJS.Timeout | null;
  /** last successful/attempted dumps per source (for TTL reuse) */
  lastDumps: Record<string, { dump: SourceDump; at: number }>;
  /** suspended-until timestamps after HTTP 429 */
  suspendedUntil: Record<string, number>;
  /** upstream call counters (quota visibility) */
  calls: Record<string, number>;
  firstCallAt: number;
}

const REFRESH_MS = Math.max(10_000, Number(process.env.REFRESH_MS ?? 45_000));
const BRSAPI_REFRESH_MS = Math.max(
  60_000,
  Number(process.env.BRSAPI_REFRESH_MS ?? 150_000),
);
const TWELVEDATA_REFRESH_MS = Math.max(
  60_000,
  Number(process.env.TWELVEDATA_REFRESH_MS ?? 300_000),
);
const BACKOFF_MS = 15 * 60_000;
const HISTORY_FILE = path.join(process.cwd(), "data", "history.json");
const MAX_POINTS = 2880;
const MAX_AGE_MS = 32 * 24 * 3600 * 1000;

const store: Store = {
  snapshot: null,
  lastOkAt: 0,
  lastAttemptAt: 0,
  refreshing: null,
  samples: {},
  saveTimer: null,
  lastDumps: {},
  suspendedUntil: {},
  calls: {},
  firstCallAt: 0,
};

/** Should this source be refetched now, or is its cached dump fresh enough? */
export function isDue(source: string, lastAt: number, suspendedUntil: number, now = Date.now()): boolean {
  if (now < suspendedUntil) return false;
  const ttl =
    source === "brsapi"
      ? BRSAPI_REFRESH_MS
      : source === "twelvedata"
        ? TWELVEDATA_REFRESH_MS
        : REFRESH_MS;
  return now - lastAt >= ttl;
}

async function loadHistory(): Promise<void> {
  try {
    const raw = await fs.readFile(HISTORY_FILE, "utf-8");
    const doc = JSON.parse(raw) as Record<string, SamplePoint[]>;
    const cutoff = Date.now() - MAX_AGE_MS;
    for (const [k, v] of Object.entries(doc)) {
      if (Array.isArray(v)) store.samples[k] = v.filter((p) => p.t > cutoff).slice(-MAX_POINTS);
    }
  } catch {
    /* first run — no history yet */
  }
}

function scheduleSave(): void {
  if (store.saveTimer) return;
  store.saveTimer = setTimeout(async () => {
    store.saveTimer = null;
    try {
      await fs.mkdir(path.dirname(HISTORY_FILE), { recursive: true });
      await fs.writeFile(HISTORY_FILE, JSON.stringify(store.samples), "utf-8");
    } catch {
      /* persistence is best-effort (e.g. read-only fs) */
    }
  }, 5000);
}

type Fetcher = () => Promise<SourceDump>;

async function guarded(source: string, fn: Fetcher, countCalls: number): Promise<SourceDump> {
  const now = Date.now();
  const prev = store.lastDumps[source];
  if (!isDue(source, prev?.at ?? 0, store.suspendedUntil[source] ?? 0, now)) {
    return prev.dump;
  }
  if (store.firstCallAt === 0) store.firstCallAt = now;
  const dump = await fn();
  if (!dump.skipped) store.calls[source] = (store.calls[source] ?? 0) + countCalls;
  if (dump.error === "HTTP 429") {
    // back off, keep serving the previous dump (don't overwrite with empty)
    store.suspendedUntil[source] = now + BACKOFF_MS;
    if (prev) {
      return {
        ...prev.dump,
        ms: dump.ms,
        error: `HTTP 429 (suspended ${BACKOFF_MS / 60000}min)`,
      };
    }
  } else if (Object.keys(dump.quotes).length > 0 || !prev) {
    store.lastDumps[source] = { dump, at: now };
  }
  // on empty failure with a previous dump: keep serving previous, report fresh error
  if (Object.keys(dump.quotes).length === 0 && prev && Object.keys(prev.dump.quotes).length > 0) {
    return { ...prev.dump, ms: dump.ms, error: dump.error };
  }
  return dump;
}

async function doRefresh(): Promise<Snapshot | null> {
  const brsKey = process.env.BRSAPI_KEY;
  const tdKey = process.env.TWELVEDATA_KEY;
  const bonbastOn = process.env.ENABLE_BONBAST === "1";
  const dumps: SourceDump[] = await Promise.all([
    guarded("brsapi", () => fetchBrsApi(brsKey), 2),
    guarded("tgju", () => fetchTgju(), 0),
    guarded("coingecko", () => fetchCoinGecko(), 0),
    guarded("frankfurter", () => fetchFrankfurter(), 0),
    guarded("nobitex", () => fetchNobitex(), 0),
    guarded("twelvedata", () => fetchTwelveData(tdKey), 2),
    guarded("bonbast", () => fetchBonbast(bonbastOn), 0),
  ]);
  const snap = buildSnapshot(dumps, { icons: COIN_ICONS as Record<string, string> });
  if (snap.items.length > 0) {
    store.snapshot = snap;
    store.lastOkAt = Date.now();
    for (const it of snap.items) {
      const arr = store.samples[it.id] ?? [];
      const last = arr[arr.length - 1];
      if (!last || snap.generatedAt - last.t >= 20_000) {
        arr.push({ t: snap.generatedAt, irt: it.priceIRT, usd: it.priceUSD });
        if (arr.length > MAX_POINTS) arr.splice(0, arr.length - MAX_POINTS);
        store.samples[it.id] = arr;
      }
    }
    scheduleSave();
  }
  return store.snapshot;
}

/** Return cached snapshot, refreshing in background when stale. */
export async function getSnapshot(): Promise<{ snap: Snapshot | null; stale: boolean }> {
  if (Object.keys(store.samples).length === 0) await loadHistory();
  const now = Date.now();
  const age = now - store.lastOkAt;
  if (!store.snapshot || age >= REFRESH_MS) {
    if (!store.refreshing) {
      store.lastAttemptAt = now;
      store.refreshing = doRefresh().finally(() => {
        store.refreshing = null;
      });
    }
    if (!store.snapshot) {
      await Promise.race([
        store.refreshing,
        new Promise((r) => setTimeout(r, 25_000)),
      ]);
      return { snap: store.snapshot, stale: false };
    }
    void store.refreshing.catch(() => undefined);
    return { snap: store.snapshot, stale: age >= REFRESH_MS * 2 };
  }
  return { snap: store.snapshot, stale: false };
}

export function getSamples(id: string, since: number): SamplePoint[] {
  return (store.samples[id] ?? []).filter((p) => p.t >= since);
}

/** BrsApi quota projection: calls so far + estimated daily run-rate. */
export function getQuotaInfo() {
  const brsCalls = store.calls["brsapi"] ?? 0;
  const tdCalls = store.calls["twelvedata"] ?? 0;
  const elapsedMin = store.firstCallAt ? (Date.now() - store.firstCallAt) / 60000 : 0;
  return {
    brsapi: {
      calls: brsCalls,
      intervalMs: BRSAPI_REFRESH_MS,
      // steady-state projection: 2 calls per interval
      projectedPerDay: Math.round(((24 * 3600 * 1000) / BRSAPI_REFRESH_MS) * 2),
      quotaPerDay: 1500,
      suspended: Date.now() < (store.suspendedUntil["brsapi"] ?? 0),
    },
    twelvedata: {
      calls: tdCalls,
      intervalMs: TWELVEDATA_REFRESH_MS,
      projectedPerDay: Math.round(((24 * 3600 * 1000) / TWELVEDATA_REFRESH_MS) * 2),
      suspended: Date.now() < (store.suspendedUntil["twelvedata"] ?? 0),
    },
    uptimeMin: Math.round(elapsedMin),
  };
}

export function getStoreHealth() {
  return {
    lastOkAt: store.lastOkAt,
    lastAttemptAt: store.lastAttemptAt,
    refreshMs: REFRESH_MS,
    trackedItems: Object.keys(store.samples).length,
    brsapiConfigured: Boolean(process.env.BRSAPI_KEY),
    bonbastEnabled: process.env.ENABLE_BONBAST === "1",
    quota: getQuotaInfo(),
  };
}
