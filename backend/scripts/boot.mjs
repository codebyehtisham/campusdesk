#!/usr/bin/env node
/**
 * Start HTTP server immediately; run schema/seed init in the background.
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const backendRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const isDev = process.env.APP_ENV === 'development';
const DEMO_PASSWORD = 'CampusDesk2026!';

process.env.ADMIN_EMAIL ||= 'admin@explorecollege.org';
process.env.ADMIN_PASSWORD ||= DEMO_PASSWORD;
process.env.PLATFORM_EMAIL ||= 'platform@explore.app';
process.env.PLATFORM_PASSWORD ||= DEMO_PASSWORD;
process.env.JWT_SECRET ||= isDev ? 'campusdesk-dev-jwt-not-for-production' : 'campusdesk-prod-jwt-change-me';
process.env.PUBLIC_ORG_SLUG ||= 'explore';

if (isDev) {
  console.log('');
  console.log('=== Campus Desk DEV deploy (APP_ENV=development) ===');
  console.log('');
}

const databaseUrl = process.env.DATABASE_URL?.trim() || '';
if (!/^postgres(ql)?:\/\//i.test(databaseUrl)) {
  console.warn('WARNING: DATABASE_URL is missing or invalid — server will start but data routes will fail.');
}

const redisUrl = process.env.REDIS_URL?.trim() || '';
if (!redisUrl || process.env.REDIS_DISABLED === '1') {
  console.warn('WARNING: REDIS_URL is missing — server will start but cache/session routes may fail.');
}

const bootMinimal = ['1', 'true', 'yes'].includes(String(process.env.BOOT_MINIMAL || '').trim().toLowerCase());
if (!bootMinimal) {
  const init = spawn('node', ['scripts/init.mjs'], {
    cwd: backendRoot,
    stdio: 'inherit',
    env: process.env,
  });
  init.on('error', (err) => console.warn(`Init process error: ${err.message}`));
  init.on('exit', (code) => {
    if (code === 0) console.log('Background init finished.');
    else console.warn(`Background init exited with ${code}.`);
  });
} else {
  console.warn('BOOT_MINIMAL=1 — skipping background init.');
}

console.log('Starting HTTP server…');

const server = spawn('node', ['dist/server.js'], {
  cwd: backendRoot,
  stdio: 'inherit',
  env: process.env,
});

server.on('exit', (code) => process.exit(code ?? 1));
server.on('error', (err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
