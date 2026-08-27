#!/usr/bin/env node
/**
 * Production boot: require PostgreSQL + Redis, push schema, seed, start API.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.join(__dirname, '..');

const DEMO_PASSWORD = 'CampusDesk2026!';
const isDev = process.env.APP_ENV === 'development';

process.env.ADMIN_EMAIL ||= 'admin@explorecollege.org';
process.env.ADMIN_PASSWORD ||= DEMO_PASSWORD;
process.env.PLATFORM_EMAIL ||= 'platform@explore.app';
process.env.PLATFORM_PASSWORD ||= DEMO_PASSWORD;
process.env.JWT_SECRET ||= isDev ? 'campusdesk-dev-jwt-not-for-production' : 'campusdesk-prod-jwt-change-me';
process.env.PUBLIC_ORG_SLUG ||= 'explore';

if (isDev) {
  console.log('');
  console.log('=== Campus Desk DEV deploy (APP_ENV=development) ===');
  console.log('Push to the develop branch — production is untouched.');
  console.log('');
}

const databaseUrl = process.env.DATABASE_URL?.trim() || '';
if (!/^postgres(ql)?:\/\//i.test(databaseUrl)) {
  console.error('');
  console.error('FATAL: DATABASE_URL must be a PostgreSQL connection string.');
  console.error('  Example: postgresql://user:pass@host:5432/campusdesk');
  console.error('  On Railway: add the Postgres plugin and set DATABASE_URL=${{Postgres.DATABASE_URL}}');
  console.error('  SQLite is not supported.');
  console.error('');
  process.exit(1);
}

const redisUrl = process.env.REDIS_URL?.trim() || '';
if (!redisUrl || process.env.REDIS_DISABLED === '1') {
  console.error('');
  console.error('FATAL: Redis is required. Set REDIS_URL and do not set REDIS_DISABLED=1.');
  console.error('  Example: redis://default:pass@host:6379');
  console.error('  On Railway: add the Redis plugin and set REDIS_URL=${{Redis.REDIS_URL}}');
  console.error('');
  process.exit(1);
}

console.log('Using PostgreSQL DATABASE_URL from environment');
console.log('Using Redis REDIS_URL from environment');

const run = (command, args) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: backendRoot,
      stdio: 'inherit',
      env: process.env,
      shell: process.platform === 'win32',
    });
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(' ')} exited with ${code}`));
    });
  });

/** Prefer compiled dist/*.js on Railway; fall back to tsx in local dev. */
const scriptCommand = (distRel, srcRel) => {
  const distPath = path.join(backendRoot, distRel);
  if (fs.existsSync(distPath)) return ['node', distRel];
  return ['npx', 'tsx', srcRel];
};

const runStep = async (label, distRel, srcRel, { required = true } = {}) => {
  const [command, ...args] = scriptCommand(distRel, srcRel);
  try {
    await run(command, args);
  } catch (err) {
    if (required) throw err;
    console.warn(`${label} failed (continuing boot): ${err.message}`);
  }
};

/** Run a script in the background so boot can start the HTTP server immediately. */
const runBackground = (label, distRel, srcRel) => {
  const [command, ...args] = scriptCommand(distRel, srcRel);
  console.log(`Starting ${label} in background…`);
  const child = spawn(command, args, {
    cwd: backendRoot,
    stdio: 'inherit',
    env: process.env,
    shell: process.platform === 'win32',
    detached: false,
  });
  child.on('exit', (code) => {
    if (code === 0) console.log(`${label} finished.`);
    else console.warn(`${label} exited with ${code} (server keeps running).`);
  });
  child.on('error', (err) => {
    console.warn(`${label} failed to start: ${err.message}`);
  });
};

const main = async () => {
  if (['1', 'true', 'yes'].includes(String(process.env.BOOT_MINIMAL || '').trim().toLowerCase())) {
    console.warn('BOOT_MINIMAL=1 — skipping schema push, catalog, flush, and seed.');
    await run('node', ['dist/server.js']);
    return;
  }

  const pushArgs = ['prisma', 'db', 'push', '--skip-generate'];
  if (process.env.FORCE_DB_RESET === '1') {
    pushArgs.push('--accept-data-loss');
    console.warn('FORCE_DB_RESET=1 — prisma db push will accept data loss.');
  }
  try {
    await run('npx', pushArgs);
  } catch (err) {
    if (isDev) {
      console.warn(`prisma db push failed in dev (continuing): ${err.message}`);
    } else {
      throw err;
    }
  }

  await runStep('Catalog ensure', 'dist/scripts/ensure-catalog.js', 'src/scripts/ensure-catalog.ts', { required: false });

  const flushRequested = ['1', 'true', 'yes'].includes(String(process.env.CONFIRM_DB_FLUSH || '').trim().toLowerCase());
  if (flushRequested) {
    if (process.env.APP_ENV !== 'development') {
      console.warn('');
      console.warn('CONFIRM_DB_FLUSH is set but APP_ENV is not development — skipping flush so the service can start.');
      console.warn('Remove CONFIRM_DB_FLUSH from Railway variables.');
      console.warn('');
    } else {
      console.warn('CONFIRM_DB_FLUSH=1 — wiping dev data (superadmin accounts are kept).');
      await runStep('Database flush', 'dist/scripts/flush-db.js', 'src/scripts/flush-db.ts', { required: false });
      console.warn('Flush done. Remove CONFIRM_DB_FLUSH from Railway variables before the next deploy.');
    }
  }

  const skipSeed = ['1', 'true', 'yes'].includes(String(process.env.SKIP_SEED || '').trim().toLowerCase());
  if (!skipSeed) {
    runBackground('Demo seed', 'dist/seed/seed.js', 'src/seed/seed.ts');
  } else {
    console.warn('SKIP_SEED=1 — running superadmin ensure only (no demo org/users).');
    await runStep('Superadmin ensure', 'dist/scripts/ensure-superadmin.js', 'src/scripts/ensure-superadmin.ts', {
      required: false,
    });
  }

  console.log('');
  console.log('Starting API server (demo seed may still be running in background)…');
  console.log('Seeded login accounts:');
  if (!skipSeed) {
    console.log(`  Org admin   /org-admin          ${process.env.ADMIN_EMAIL} / ${process.env.ADMIN_PASSWORD}`);
    console.log(`  Officer     /faculty-portal     officer@explorecollege.org / ${process.env.ADMIN_PASSWORD}`);
    console.log(`  Faculty     /faculty-portal     faculty@explorecollege.org / ${process.env.ADMIN_PASSWORD}`);
    console.log(`  Super admin /x7k2m9q4p8n3       ${process.env.PLATFORM_EMAIL} / ${process.env.PLATFORM_PASSWORD}`);
    console.log('  Student     /login              student@explorecollege.org / student123');
    console.log('  Apply       /apply              pick institute (or ?institute=explore)');
  } else {
    console.log(`  Super admin /x7k2m9q4p8n3       ${process.env.PLATFORM_EMAIL} / ${process.env.PLATFORM_PASSWORD}`);
    console.log('  (Only superadmin remains — remove SKIP_SEED and redeploy to run demo seed again.)');
  }
  console.log('');
  await run('node', ['dist/server.js']);
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
