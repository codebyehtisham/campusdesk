import { createClient } from 'redis';

let client: ReturnType<typeof createClient> | null = null;
let connecting: Promise<ReturnType<typeof createClient> | null> | null = null;

const connect = async () => {
  if (client?.isOpen) return client;
  const url = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
  const next = createClient({ url });
  next.on('error', (err) => {
    console.error(`Redis error: ${err.message}`);
  });
  try {
    await next.connect();
    client = next;
    return client;
  } catch (err) {
    console.error(`Redis connection error: ${(err as Error).message}`);
    return null;
  }
};

export const getRedis = async () => {
  if (client?.isOpen) return client;
  if (!connecting) connecting = connect().finally(() => {
    connecting = null;
  });
  return connecting;
};

export const pingRedis = async () => {
  const started = Date.now();
  try {
    const redis = await getRedis();
    if (!redis) return { name: 'Redis', status: 'down' as const, latencyMs: Date.now() - started };
    await redis.ping();
    return { name: 'Redis', status: 'up' as const, latencyMs: Date.now() - started };
  } catch {
    return { name: 'Redis', status: 'down' as const, latencyMs: Date.now() - started };
  }
};

export const cacheGet = async <T>(key: string): Promise<T | null> => {
  try {
    const redis = await getRedis();
    if (!redis) return null;
    const raw = await redis.get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
};

export const cacheSet = async (key: string, value: unknown, ttlSeconds: number) => {
  try {
    const redis = await getRedis();
    if (!redis) return;
    await redis.set(key, JSON.stringify(value), { EX: ttlSeconds });
  } catch {
    /* cache is optional */
  }
};

export const cacheDel = async (...keys: string[]) => {
  if (!keys.length) return;
  try {
    const redis = await getRedis();
    if (!redis) return;
    await redis.del(keys);
  } catch {
    /* cache is optional */
  }
};

export const CACHE_KEYS = {
  publicOrg: 'org:public',
  publicSettings: 'settings:public',
  modules: 'modules:catalog:v2',
  catalog: 'platform:catalog',
  platformDashboard: 'dashboard:platform',
};
