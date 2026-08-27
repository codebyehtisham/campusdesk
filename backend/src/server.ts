import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import { prisma, pingPostgres } from './config/db.js';
import { pingRedis, requireRedis } from './config/redis.js';
import { appEnvironment, publicAppUrl } from './lib/env.js';
import { getObject, isR2Configured, isR2Disabled, r2Bucket, r2LastVerify, sanitizeStorageKey, verifyR2ConnectionSafe } from './lib/storage.js';
import { optionalAuth } from './middleware/auth.js';
import { audit } from './middleware/audit.js';
import adminRoutes from './routes/adminRoutes.js';
import platformRoutes from './routes/platformRoutes.js';
import {
  authRoutes,
  staffRoutes,
  applicationRoutes,
  careerRoutes,
  settingsRoutes,
  facultyRoutes,
  courseRoutes,
  newsRoutes,
  contactRoutes,
  instituteRoutes,
  admissionFormRoutes,
} from './routes/publicRoutes.js';

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const allowedOrigins = (process.env.CLIENT_ORIGIN || 'http://localhost:5174,http://localhost:5173')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean);

const configuredHosts = () => {
  const hosts = new Set<string>();
  for (const value of [
    process.env.RAILWAY_PUBLIC_DOMAIN,
    process.env.PUBLIC_APP_URL,
    process.env.APP_URL,
    process.env.CLIENT_ORIGIN,
  ]) {
    if (!value) continue;
    for (const part of value.split(',')) {
      const raw = part.trim();
      if (!raw || raw === '*') continue;
      try {
        const url = raw.includes('://') ? new URL(raw) : new URL(`https://${raw}`);
        hosts.add(url.host);
      } catch {
        /* ignore invalid entries */
      }
    }
  }
  return hosts;
};

const isAllowedOrigin = (origin: string | undefined, requestHost?: string) => {
  if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) return true;
  try {
    const host = new URL(origin).host;
    if (configuredHosts().has(host)) return true;
    // Same Express process serves SPA + API — allow the browser host that hit this server.
    if (requestHost) {
      const bare = requestHost.split(':')[0];
      if (host === requestHost || host === bare) return true;
    }
  } catch {
    return false;
  }
  return false;
};

app.use((req, res, next) => {
  cors({
    origin: (origin, callback) => {
      // Never throw — throwing becomes a 500 and blocks Vite `crossorigin` JS/CSS (white screen).
      callback(null, isAllowedOrigin(origin, req.headers.host));
    },
  })(req, res, next);
});
app.use(express.json({ limit: '12mb' }));
app.use(express.urlencoded({ extended: true }));
app.set('trust proxy', 1);
app.use(optionalAuth);
app.use(audit);

const uploadsDir = path.join(__dirname, '..', 'uploads');
fs.mkdirSync(uploadsDir, { recursive: true });

/** Serve legacy local files, then fall back to Cloudflare R2. */
app.use('/uploads', async (req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return next();
  const key = sanitizeStorageKey(decodeURIComponent(req.path.replace(/^\//, '')));
  if (!key) return res.status(404).end();

  const localPath = path.join(uploadsDir, key);
  if (localPath.startsWith(uploadsDir) && fs.existsSync(localPath) && fs.statSync(localPath).isFile()) {
    return res.sendFile(localPath);
  }

  if (!isR2Configured()) {
    console.warn(`[uploads] missing object and R2 not configured: ${key}`);
    return res.status(404).json({ message: 'File not found' });
  }
  try {
    const object = await getObject(key);
    if (!object.body) return res.status(404).json({ message: 'File not found' });
    res.setHeader('Content-Type', object.contentType);
    if (object.contentLength != null) res.setHeader('Content-Length', String(object.contentLength));
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    if (req.method === 'HEAD') return res.status(200).end();
    await pipeline(object.body, res);
  } catch (err) {
    console.error(`[uploads] R2 get failed key=${key}:`, (err as Error).message);
    if (!res.headersSent) res.status(404).json({ message: 'File not found' });
  }
});

app.get('/api/health', async (_req, res) => {
  const [postgres, redis] = await Promise.all([pingPostgres(), pingRedis()]);
  res.json({
    status: 'ok',
    environment: appEnvironment(),
    url: publicAppUrl(),
    storage: isR2Configured() ? 'r2' : isR2Disabled() ? 'local' : 'unconfigured',
    r2Bucket: isR2Configured() ? r2Bucket() : undefined,
    r2WriteOk: isR2Configured() ? r2LastVerify().ok : false,
    r2Error: isR2Configured() && !r2LastVerify().ok ? r2LastVerify().error || undefined : undefined,
    db: postgres.status === 'up' ? 'connected' : 'disconnected',
    cache: redis.status === 'up' ? 'connected' : 'disconnected',
    postgres: { status: postgres.status, latencyMs: postgres.latencyMs },
    redis: { status: redis.status, latencyMs: redis.latencyMs },
  });
});

app.use('/api/faculty', facultyRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/news', newsRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/careers', careerRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/institutes', instituteRoutes);
app.use('/api/admission-form', admissionFormRoutes);
app.use('/api/platform', platformRoutes);

app.use('/api', (_req, res) => {
  res.status(404).json({ message: 'API route not found' });
});

const frontendDist = path.join(__dirname, '..', '..', 'frontend', 'dist');
if (fs.existsSync(path.join(frontendDist, 'index.html'))) {
  app.use(express.static(frontendDist));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
} else {
  app.get('/', (_req, res) => {
    res.json({ message: 'API is running. Frontend build not found — run `npm run build` in frontend/.' });
  });
}

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Server error', error: err.message });
});

const PORT = Number(process.env.PORT || 5050);

const start = async () => {
  try {
    await prisma.$connect();
    console.log('PostgreSQL connected');
  } catch (err) {
    console.error(`PostgreSQL connection error: ${(err as Error).message}`);
    console.error('Refusing to start without PostgreSQL. Set DATABASE_URL to a postgres:// URL.');
    process.exit(1);
  }

  try {
    const redis = await requireRedis();
    console.log(`Redis connected (${redis.latencyMs}ms)`);
  } catch (err) {
    console.error(`Redis connection error: ${(err as Error).message}`);
    console.error('Refusing to start without Redis. Set REDIS_URL (and unset REDIS_DISABLED).');
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    if (isR2Configured()) {
      verifyR2ConnectionSafe().then((ok) => {
        if (ok) console.log(`File storage: Cloudflare R2 write OK (${r2Bucket()})`);
        else console.error(`File storage: R2 keys present but Put/Get failed — ${r2LastVerify().error}`);
      });
    } else if (isR2Disabled()) {
      console.warn('File storage: local disk (R2_DISABLED=1)');
    } else {
      console.error('File storage: R2 keys missing — uploads will fail until R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY are set');
    }
  });
};

start();

export default app;
