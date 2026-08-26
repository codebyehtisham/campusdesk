import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { prisma, pingPostgres } from './config/db.js';
import { pingRedis } from './config/redis.js';
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
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.set('trust proxy', 1);
app.use(audit);

const uploadsDir = path.join(__dirname, '..', 'uploads');
fs.mkdirSync(uploadsDir, { recursive: true });
app.use('/uploads', express.static(uploadsDir));

app.get('/api/health', async (_req, res) => {
  const [postgres, redis] = await Promise.all([pingPostgres(), pingRedis()]);
  res.json({
    status: 'ok',
    db: postgres.status === 'up' ? 'connected' : 'disconnected',
    cache: redis.status === 'up' ? 'connected' : 'disconnected',
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
app.use('/api/platform', platformRoutes);

app.use('/api', (_req, res) => {
  res.status(404).json({ message: 'API route not found' });
});

const frontendDist = path.join(__dirname, '..', '..', 'frontend', 'dist');
if (fs.existsSync(path.join(frontendDist, 'index.html'))) {
  app.use(express.static(frontendDist));
  app.get(['/login', '/signin'], (_req, res) => {
    res.redirect(302, '/apply');
  });
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
    console.error('Starting the server anyway — check DATABASE_URL in backend/.env');
  }
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
};

start();

export default app;
