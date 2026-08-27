#!/usr/bin/env node
/**
 * Production boot: ensure DATABASE_URL (sqlite file if unset), push schema, seed, start API.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.join(__dirname, '..');
const dataDir = path.join(backendRoot, 'data');

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

if (!process.env.DATABASE_URL?.trim()) {
  fs.mkdirSync(dataDir, { recursive: true });
  const dbPath = path.join(dataDir, 'campusdesk.db');
  process.env.DATABASE_URL = `file:${dbPath}`;
  console.log(`DATABASE_URL unset — using SQLite at ${dbPath}`);
} else {
  console.log('Using DATABASE_URL from environment');
}

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
  await run('npx', ['prisma', 'db', 'push', '--skip-generate', '--accept-data-loss']);
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
