import { createClient } from 'redis';

let client: ReturnType<typeof createClient> | null = null;
let connecting: Promise<ReturnType<typeof createClient> | null> | null = null;
let redisDisabled = false;

const CONNECT_MS = 1500;
const COMMAND_MS = 1500;

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

const connect = async () => {
  if (redisDisabled) return null;
  if (client?.isOpen) return client;

  const url = process.env.REDIS_URL?.trim();
  if (!url || process.env.REDIS_DISABLED === '1') {
    redisDisabled = true;
    return null;
  }

  const next = createClient({
    url,
    socket: {
      connectTimeout: CONNECT_MS,
      reconnectStrategy: false,
    },
    commandsQueueMaxLength: 32,
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
    redisDisabled = true;
    try {
      await next.disconnect();
    } catch {
      /* ignore */
    }
    return null;
  }
};

export const getRedis = async () => {
  if (redisDisabled) return null;
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
    /* cache is optional */
  }
};

export const cacheDel = async (...keys: string[]) => {
  if (!keys.length) return;
  try {
    const redis = await getRedis();
    if (!redis) return;
    await withTimeout(redis.del(keys), COMMAND_MS, 'Redis del');
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
