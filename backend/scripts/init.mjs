#!/usr/bin/env node
/**
 * Background deploy init: schema push, catalog, optional flush, demo seed.
 * Runs in parallel with the HTTP server so Railway can bind PORT immediately.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const backendRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const isDev = process.env.APP_ENV === 'development';

const databaseUrl = process.env.DATABASE_URL?.trim() || '';
if (!/^postgres(ql)?:\/\//i.test(databaseUrl)) {
  console.warn('Init skipped: DATABASE_URL is missing or not PostgreSQL.');
  process.exit(0);
}

const redisUrl = process.env.REDIS_URL?.trim() || '';
if (!redisUrl || process.env.REDIS_DISABLED === '1') {
  console.warn('Init skipped: REDIS_URL is missing or Redis is disabled.');
  process.exit(0);
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

const scriptCommand = (distRel, srcRel) => {
  const distPath = path.join(backendRoot, distRel);
  if (fs.existsSync(distPath)) return ['node', distRel];
  return ['npx', 'tsx', srcRel];
};

const runStep = async (label, distRel, srcRel) => {
  const [command, ...args] = scriptCommand(distRel, srcRel);
  try {
    await run(command, args);
  } catch (err) {
    console.warn(`${label} failed: ${err.message}`);
  }
};

const main = async () => {
  console.log('=== Background deploy init ===');

  const pushArgs = ['prisma', 'db', 'push', '--skip-generate'];
  if (process.env.FORCE_DB_RESET === '1') {
    pushArgs.push('--accept-data-loss');
    console.warn('FORCE_DB_RESET=1 — prisma db push will accept data loss.');
  }
  try {
    await run('npx', pushArgs);
  } catch (err) {
    console.warn(`prisma db push failed: ${err.message}`);
  }

  await runStep('Catalog ensure', 'dist/scripts/ensure-catalog.js', 'src/scripts/ensure-catalog.ts');

  await runStep('Programmes ensure', 'dist/scripts/ensure-programmes.js', 'src/scripts/ensure-programmes.ts');

  const flushRequested = ['1', 'true', 'yes'].includes(String(process.env.CONFIRM_DB_FLUSH || '').trim().toLowerCase());
  if (flushRequested && isDev) {
    console.warn('CONFIRM_DB_FLUSH=1 — wiping dev data (superadmin accounts are kept).');
    await runStep('Database flush', 'dist/scripts/flush-db.js', 'src/scripts/flush-db.ts');
    console.warn('Flush done. Remove CONFIRM_DB_FLUSH from Railway variables.');
  } else if (flushRequested) {
    console.warn('CONFIRM_DB_FLUSH is set but APP_ENV is not development — flush skipped.');
  }

  const skipSeed = ['1', 'true', 'yes'].includes(String(process.env.SKIP_SEED || '').trim().toLowerCase());
  if (!skipSeed) {
    await runStep('Demo seed', 'dist/seed/seed.js', 'src/seed/seed.ts');
  } else {
    await runStep('Superadmin ensure', 'dist/scripts/ensure-superadmin.js', 'src/scripts/ensure-superadmin.ts');
  }

  console.log('=== Background deploy init complete ===');
};

main().catch((err) => {
  console.error('Init error:', err);
  process.exit(1);
});
