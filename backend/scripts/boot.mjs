#!/usr/bin/env node
/**
 * Production boot: require PostgreSQL + Redis, push schema, seed, start API.
 */
import { spawn } from 'node:child_process';
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

const main = async () => {
  const pushArgs = ['prisma', 'db', 'push', '--skip-generate'];
  if (process.env.FORCE_DB_RESET === '1') {
    pushArgs.push('--accept-data-loss');
    console.warn('FORCE_DB_RESET=1 — prisma db push will accept data loss.');
  }
  await run('npx', pushArgs);
  await run('npx', ['tsx', 'src/seed/seed.ts']);
  console.log('');
  console.log('Seeded login accounts:');
  console.log(`  Org admin   /org-admin          ${process.env.ADMIN_EMAIL} / ${process.env.ADMIN_PASSWORD}`);
  console.log(`  Officer     /faculty-portal     officer@explorecollege.org / ${process.env.ADMIN_PASSWORD}`);
  console.log(`  Faculty     /faculty-portal     faculty@explorecollege.org / ${process.env.ADMIN_PASSWORD}`);
  console.log(`  Super admin /x7k2m9q4p8n3       ${process.env.PLATFORM_EMAIL} / ${process.env.PLATFORM_PASSWORD}`);
  console.log('  Student     /login              student@explorecollege.org / student123');
  console.log('  Apply       /apply              pick institute (or ?institute=explore)');
  console.log('');
  await run('node', ['dist/server.js']);
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
