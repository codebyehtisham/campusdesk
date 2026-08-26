#!/usr/bin/env node
/**
 * Production boot: ensure DATABASE_URL, push schema, seed demo accounts, then start API.
 * If Railway has no Postgres plugin, starts an embedded Postgres in ./data/pg.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.join(__dirname, '..');
const dataDir = path.join(backendRoot, 'data', 'pg');

const DEMO_PASSWORD = 'CampusDesk2026!';

process.env.ADMIN_EMAIL ||= 'admin@explorecollege.org';
process.env.ADMIN_PASSWORD ||= DEMO_PASSWORD;
process.env.PLATFORM_EMAIL ||= 'platform@explore.app';
process.env.PLATFORM_PASSWORD ||= DEMO_PASSWORD;
process.env.JWT_SECRET ||= 'campusdesk-prod-jwt-change-me';
process.env.PUBLIC_ORG_SLUG ||= 'explore';

const run = (command, args, opts = {}) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: backendRoot,
      stdio: 'inherit',
      env: process.env,
      shell: process.platform === 'win32',
      ...opts,
    });
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(' ')} exited with ${code}`));
    });
  });

const ensureDatabaseUrl = async () => {
  if (process.env.DATABASE_URL?.trim()) {
    console.log('Using DATABASE_URL from environment');
    return;
  }

  console.log('DATABASE_URL missing — starting embedded Postgres for Campus Desk…');
  const { default: EmbeddedPostgres } = await import('embedded-postgres');
  fs.mkdirSync(dataDir, { recursive: true });

  const port = Number(process.env.EMBEDDED_PG_PORT || 54329);
  const password = 'campusdesk';
  const pg = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: 'postgres',
    password,
    port,
    persistent: true,
  });

  try {
    await pg.initialise();
  } catch (err) {
    // Already initialised from a previous boot
    console.log(`Postgres init note: ${err?.message || err}`);
  }

  try {
    await pg.start();
  } catch (err) {
    console.log(`Postgres start note: ${err?.message || err}`);
  }

  try {
    await pg.createDatabase('campusdesk');
  } catch {
    /* exists */
  }

  process.env.DATABASE_URL = `postgresql://postgres:${password}@127.0.0.1:${port}/campusdesk`;
  console.log(`Embedded Postgres ready on port ${port}`);

  // Keep process reference so GC doesn't stop it
  globalThis.__campusdeskPg = pg;
};

const main = async () => {
  await ensureDatabaseUrl();
  await run('npx', ['prisma', 'db', 'push', '--skip-generate', '--accept-data-loss']);
  await run('npx', ['tsx', 'src/seed/seed.ts']);
  console.log('');
  console.log('Seeded login accounts (password for admin/faculty/platform):');
  console.log(`  Org admin   /org-admin          ${process.env.ADMIN_EMAIL} / ${process.env.ADMIN_PASSWORD}`);
  console.log(`  Faculty     /faculty-portal     faculty@explorecollege.org / ${process.env.ADMIN_PASSWORD}`);
  console.log(`  Super admin /x7k2m9q4p8n3       ${process.env.PLATFORM_EMAIL} / ${process.env.PLATFORM_PASSWORD}`);
  console.log('  Student     /login              student@explorecollege.org / student123');
  console.log('');
  await run('node', ['dist/server.js']);
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
