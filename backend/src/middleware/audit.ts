import type { NextFunction, Request, Response } from 'express';
import { prisma } from '../config/db.js';
import type { Prisma } from '@prisma/client';

const SECRET_KEYS = /^(password|currentpassword|newpassword|confirmpassword|token|authorization|cookie|set-cookie)$/i;
const SKIP_EXT = /\.(js|css|map|png|jpe?g|gif|svg|ico|webp|woff2?|ttf|eot)(\?.*)?$/i;
const geoCache = new Map<string, { city: string; region: string; country: string }>();

const isPrivateIp = (ip: string) => {
  if (!ip) return true;
  const v4 = ip.replace('::ffff:', '');
  if (v4 === '127.0.0.1' || ip === '::1') return true;
  if (v4.startsWith('10.') || v4.startsWith('192.168.') || v4.startsWith('169.254.')) return true;
  const match = v4.match(/^172\.(\d+)\./);
  return Boolean(match && Number(match[1]) >= 16 && Number(match[1]) <= 31);
};

const clientIp = (req: Request) => {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  return (req.ip || req.socket?.remoteAddress || '').replace('::ffff:', '');
};

const redact = (value: unknown, depth = 0): unknown => {
  if (value == null || depth > 6) return value;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.slice(0, 50).map((item) => redact(item, depth + 1));
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      out[key] = SECRET_KEYS.test(key) ? '[redacted]' : redact(nested, depth + 1);
    }
    return out;
  }
  if (typeof value === 'string' && value.length > 8000) return `${value.slice(0, 8000)}…`;
  return value;
};

const clip = (value: unknown) => {
  try {
    const text = typeof value === 'string' ? value : JSON.stringify(value);
    if (text.length > 12000) return `${text.slice(0, 12000)}…`;
    return value;
  } catch {
    return '[unserializable]';
  }
};

const asBody = (value: unknown) => {
  if (value == null) return null;
  if (Buffer.isBuffer(value)) {
    const text = value.toString('utf8');
    try {
      return JSON.parse(text);
    } catch {
      return clip(text);
    }
  }
  return value;
};

const lookupLocation = async (ip: string) => {
  if (isPrivateIp(ip)) return { city: 'Local', region: '', country: 'Local network' };
  if (geoCache.has(ip)) return geoCache.get(ip)!;
  if (geoCache.size > 2000) geoCache.clear();
  try {
    const res = await fetch(`http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,country,regionName,city`);
    const data = (await res.json()) as { status?: string; country?: string; regionName?: string; city?: string };
    const location =
      data?.status === 'success'
        ? { city: data.city || '', region: data.regionName || '', country: data.country || '' }
        : { city: '', region: '', country: 'Unknown' };
    geoCache.set(ip, location);
    return location;
  } catch {
    return { city: '', region: '', country: 'Unknown' };
  }
};

const shouldSkip = (req: Request) => {
  const url = req.originalUrl || req.url || '';
  if (SKIP_EXT.test(url)) return true;
  if (req.method === 'OPTIONS') return true;
  if (req.method === 'GET' && url.startsWith('/api/platform/audit')) return true;
  return false;
};

const jsonValue = (value: unknown): Prisma.InputJsonValue => value as Prisma.InputJsonValue;

export const audit = (req: Request, res: Response, next: NextFunction) => {
  if (shouldSkip(req)) return next();

  const started = Date.now();
  const ip = clientIp(req);
  const originalJson = res.json.bind(res);
  const originalSend = res.send.bind(res);

  res.json = ((body: unknown) => {
    res.locals.auditBody = body;
    return originalJson(body);
  }) as typeof res.json;
  res.send = ((body: unknown) => {
    if (res.locals.auditBody == null) res.locals.auditBody = body;
    return originalSend(body);
  }) as typeof res.send;

  res.on('finish', () => {
    const orgId = req.user?.organizationId || req.organization?.id || null;
    const payload = {
      method: req.method,
      url: req.originalUrl || req.url,
      ip,
      userAgent: req.get('user-agent') || '',
      query: jsonValue(redact(req.query || {})),
      headers: jsonValue(redact(req.headers)),
      requestBody: jsonValue(clip(redact(req.body && Object.keys(req.body).length ? req.body : null))),
      actor: jsonValue(
        req.user
          ? { id: req.user.id, email: req.user.email || '', role: req.user.role || '' }
          : { id: '', email: '', role: '' }
      ),
      organizationId: orgId,
      statusCode: res.statusCode,
      responseBody: jsonValue(clip(redact(asBody(res.locals.auditBody)))),
      durationMs: Date.now() - started,
    };

    lookupLocation(ip)
      .then((location) => prisma.auditLog.create({ data: { ...payload, location: jsonValue(location) } }))
      .catch(() => {});
  });

  return next();
};
