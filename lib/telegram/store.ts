/**
 * Chat-scoped storage: currency preference + alert rules.
 *  - Upstash Redis REST when UPSTASH_REDIS_REST_URL/TOKEN are set (production).
 *  - In-memory fallback otherwise (local dev / single instance).
 */
export type TgCurrency = "IRT" | "USD";

export interface AlertRule {
  id: string;
  dir: "above" | "below";
  target: number;
  currency: TgCurrency;
  createdAt: number;
}

interface Backend {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown): Promise<void>;
  del(key: string): Promise<void>;
  sadd(key: string, member: string): Promise<void>;
  smembers(key: string): Promise<string[]>;
}

class MemoryBackend implements Backend {
  private kv = new Map<string, string>();
  private sets = new Map<string, Set<string>>();
  async get<T>(key: string): Promise<T | null> {
    const v = this.kv.get(key);
    return v == null ? null : (JSON.parse(v) as T);
  }
  async set(key: string, value: unknown): Promise<void> {
    this.kv.set(key, JSON.stringify(value));
  }
  async del(key: string): Promise<void> {
    this.kv.delete(key);
  }
  async sadd(key: string, member: string): Promise<void> {
    const s = this.sets.get(key) ?? new Set<string>();
    s.add(member);
    this.sets.set(key, s);
  }
  async smembers(key: string): Promise<string[]> {
    return [...(this.sets.get(key) ?? [])];
  }
}

class UpstashBackend implements Backend {
  constructor(private url: string, private token: string) {}
  private async cmd<T>(...parts: (string | number)[]): Promise<T> {
    const res = await fetch(`${this.url}/${parts.map(encodeURIComponent).join("/")}`, {
      headers: { Authorization: `Bearer ${this.token}` },
    });
    if (!res.ok) throw new Error(`upstash HTTP ${res.status}`);
    const json = (await res.json()) as { result?: T; error?: string };
    if (json.error) throw new Error(`upstash: ${json.error}`);
    return json.result as T;
  }
  async get<T>(key: string): Promise<T | null> {
    const v = await this.cmd<string | null>("get", key);
    return v == null ? null : (JSON.parse(v) as T);
  }
  async set(key: string, value: unknown): Promise<void> {
    await this.cmd("set", key, JSON.stringify(value));
  }
  async del(key: string): Promise<void> {
    await this.cmd("del", key);
  }
  async sadd(key: string, member: string): Promise<void> {
    await this.cmd("sadd", key, member);
  }
  async smembers(key: string): Promise<string[]> {
    return (await this.cmd<string[]>("smembers", key)) ?? [];
  }
}

function makeBackend(): Backend {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) return new UpstashBackend(url, token);
  return new MemoryBackend();
}

// Module-global so the memory backend survives warm invocations.
const g = globalThis as unknown as { __tgbe?: Backend };
if (!g.__tgbe) g.__tgbe = makeBackend();
const be: Backend = g.__tgbe;

const K = {
  chats: "tg:chats",
  cur: (chat: string) => `tg:${chat}:cur`,
  alerts: (chat: string) => `tg:${chat}:alerts`,
};

export async function touchChat(chat: string): Promise<void> {
  await be.sadd(K.chats, chat);
}

export async function allChats(): Promise<string[]> {
  return be.smembers(K.chats);
}

export async function getCurrency(chat: string): Promise<TgCurrency> {
  const c = await be.get<TgCurrency>(K.cur(chat));
  return c === "USD" ? "USD" : "IRT";
}

export async function setCurrency(chat: string, c: TgCurrency): Promise<void> {
  await be.set(K.cur(chat), c);
}

export async function getAlerts(chat: string): Promise<AlertRule[]> {
  return (await be.get<AlertRule[]>(K.alerts(chat))) ?? [];
}

export async function addAlert(chat: string, rule: AlertRule): Promise<AlertRule[]> {
  const list = (await getAlerts(chat)).filter((a) => !(a.id === rule.id && a.dir === rule.dir));
  list.push(rule);
  await be.set(K.alerts(chat), list.slice(-20)); // cap 20 rules/chat
  return list;
}

export async function delAlert(chat: string, idx: number): Promise<AlertRule[]> {
  const list = await getAlerts(chat);
  list.splice(idx, 1);
  await be.set(K.alerts(chat), list);
  return list;
}

export async function clearAlerts(chat: string): Promise<void> {
  await be.set(K.alerts(chat), []);
}
