import { createClient } from 'redis';

let client: ReturnType<typeof createClient> | null = null;
let connecting: Promise<ReturnType<typeof createClient> | null> | null = null;

const CONNECT_MS = 4000;
const COMMAND_MS = 2000;

const withTimeout = <T>(promise: Promise<T>, ms: number, label: string) =>
  new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });

const redisUrl = () => process.env.REDIS_URL?.trim() || '';

export const redisConfigured = () => Boolean(redisUrl()) && process.env.REDIS_DISABLED !== '1';

const connect = async () => {
  if (client?.isOpen) return client;

  const url = redisUrl();
  if (!url || process.env.REDIS_DISABLED === '1') {
    return null;
  }

  const next = createClient({
    url,
    socket: {
      connectTimeout: CONNECT_MS,
      reconnectStrategy: (retries) => Math.min(retries * 200, 3000),
    },
    commandsQueueMaxLength: 64,
  });
  next.on('error', (err) => {
    console.error(`Redis error: ${err.message}`);
  });

  try {
    await withTimeout(next.connect(), CONNECT_MS, 'Redis connect');
    client = next;
    return client;
  } catch (err) {
    console.error(`Redis connection error: ${(err as Error).message}`);
    try {
      await next.disconnect();
    } catch {
      /* ignore */
    }
    return null;
  }
};

export const getRedis = async () => {
  if (client?.isOpen) return client;
  if (!connecting) {
    connecting = connect().finally(() => {
      connecting = null;
    });
  }
  return connecting;
};

export const pingRedis = async () => {
  const started = Date.now();
  try {
    const redis = await getRedis();
    if (!redis) return { name: 'Redis', status: 'down' as const, latencyMs: Date.now() - started };
    await withTimeout(redis.ping(), COMMAND_MS, 'Redis ping');
    return { name: 'Redis', status: 'up' as const, latencyMs: Date.now() - started };
  } catch {
    return { name: 'Redis', status: 'down' as const, latencyMs: Date.now() - started };
  }
};

export const requireRedis = async () => {
  if (!redisConfigured()) {
    throw new Error('REDIS_URL is required. Add a Redis plugin and set REDIS_URL.');
  }
  const ping = await pingRedis();
  if (ping.status !== 'up') {
    throw new Error('Redis is unreachable. Check REDIS_URL.');
  }
  return ping;
};

export const cacheGet = async <T>(key: string): Promise<T | null> => {
  try {
    const redis = await getRedis();
    if (!redis) return null;
    const raw = await withTimeout(redis.get(key), COMMAND_MS, 'Redis get');
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
};

export const cacheSet = async (key: string, value: unknown, ttlSeconds: number) => {
  try {
    const redis = await getRedis();
    if (!redis) return;
    await withTimeout(redis.set(key, JSON.stringify(value), { EX: ttlSeconds }), COMMAND_MS, 'Redis set');
  } catch {
    /* best-effort cache */
  }
};

export const cacheDel = async (...keys: string[]) => {
  if (!keys.length) return;
  try {
    const redis = await getRedis();
    if (!redis) return;
    await withTimeout(redis.del(keys), COMMAND_MS, 'Redis del');
  } catch {
    /* best-effort cache */
  }
};

/** Delete exact keys plus any Redis keys matching `prefix*`. */
export const cacheDelPrefix = async (...prefixes: string[]) => {
  if (!prefixes.length) return;
  try {
    const redis = await getRedis();
    if (!redis) return;
    for (const prefix of prefixes) {
      if (!prefix) continue;
      await withTimeout(redis.del(prefix), COMMAND_MS, 'Redis del');
      let cursor = 0;
      do {
        const result = await withTimeout(
          redis.scan(cursor, { MATCH: `${prefix}:*`, COUNT: 64 }),
          COMMAND_MS,
          'Redis scan'
        );
        cursor = Number(result.cursor);
        if (result.keys?.length) {
          await withTimeout(redis.del(result.keys), COMMAND_MS, 'Redis del pattern');
        }
      } while (cursor !== 0);
    }
  } catch {
    /* best-effort cache */
  }
};

export const CACHE_KEYS = {
  publicOrg: 'org:public',
  publicSettings: 'settings:public',
  modules: 'modules:catalog:v2',
  catalog: 'platform:catalog',
  platformDashboard: 'dashboard:platform',
};
