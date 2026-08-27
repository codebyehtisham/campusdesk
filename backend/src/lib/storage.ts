import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Readable } from 'node:stream';

/** Cloudflare R2 — S3-compatible API for campusdesk bucket. */
const DEFAULT_ENDPOINT = 'https://fed2231335a1a08237a63ec5f77bc211.r2.cloudflarestorage.com';
const DEFAULT_BUCKET = 'campusdesk';

// Prevent AWS SDK default CRC32 checksums that break R2 Put/Get on some versions.
process.env.AWS_REQUEST_CHECKSUM_CALCULATION ||= 'WHEN_REQUIRED';
process.env.AWS_RESPONSE_CHECKSUM_VALIDATION ||= 'WHEN_REQUIRED';

export function r2Endpoint() {
  return (process.env.R2_ENDPOINT || DEFAULT_ENDPOINT).replace(/\/+$/, '');
}

export function r2Bucket() {
  return (process.env.R2_BUCKET || DEFAULT_BUCKET).trim() || DEFAULT_BUCKET;
}

export function r2PublicBaseUrl() {
  const raw = (process.env.R2_PUBLIC_BASE_URL || '').trim().replace(/\/+$/, '');
  return raw || '';
}

/** Local disk only when explicitly opted out (dev). Production must use R2. */
export function isR2Disabled() {
  return ['1', 'true', 'yes'].includes(String(process.env.R2_DISABLED || '').trim().toLowerCase());
}

export function isR2Configured() {
  if (isR2Disabled()) return false;
  return Boolean(process.env.R2_ACCESS_KEY_ID?.trim() && process.env.R2_SECRET_ACCESS_KEY?.trim());
}

export function assertR2Ready() {
  if (isR2Disabled()) return;
  if (!process.env.R2_ACCESS_KEY_ID?.trim() || !process.env.R2_SECRET_ACCESS_KEY?.trim()) {
    throw new Error(
      'Cloudflare R2 is not configured. Set R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY on the server (or R2_DISABLED=1 for local-only).'
    );
  }
}

let client: S3Client | null = null;
let lastVerifyError = '';
let lastVerifyOk = false;

export function r2LastVerify() {
  return { ok: lastVerifyOk, error: lastVerifyError };
}

function stripChecksumHeaders(headers: Record<string, string> | undefined) {
  if (!headers) return;
  for (const key of Object.keys(headers)) {
    const lower = key.toLowerCase();
    if (
      lower.startsWith('x-amz-checksum-') ||
      lower === 'x-amz-sdk-checksum-algorithm' ||
      lower === 'x-amz-checksum-algorithm' ||
      lower === 'x-amz-checksum-mode'
    ) {
      delete headers[key];
    }
  }
}

function getClient() {
  assertR2Ready();
  if (!client) {
    client = new S3Client({
      region: process.env.R2_REGION || 'auto',
      endpoint: r2Endpoint(),
      forcePathStyle: true,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!.trim(),
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!.trim(),
      },
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    });

    client.middlewareStack.add(
      (next) => async (args) => {
        const request = args.request as { headers?: Record<string, string> };
        stripChecksumHeaders(request.headers);
        return next(args);
      },
      { step: 'build', name: 'stripR2ChecksumHeaders', priority: 'high' }
    );
  }
  return client;
}

export function publicObjectUrl(key: string, version?: number | string) {
  const clean = key.replace(/^\/+/, '');
  const v = version != null ? `?v=${version}` : '';
  const base = r2PublicBaseUrl();
  if (base) return `${base}/${clean}${v}`;
  return `/uploads/${clean}${v}`;
}

export async function putObject(params: {
  key: string;
  body: Buffer;
  contentType: string;
}) {
  const key = params.key.replace(/^\/+/, '');
  try {
    await getClient().send(
      new PutObjectCommand({
        Bucket: r2Bucket(),
        Key: key,
        Body: params.body,
        ContentType: params.contentType,
        CacheControl: 'public, max-age=31536000, immutable',
      })
    );
  } catch (err) {
    const message = (err as Error).message || 'R2 upload failed';
    console.error(`[r2] PutObject failed key=${key}:`, message);
    throw new Error(`Could not store file in Cloudflare R2: ${message}`);
  }
  return { key, url: publicObjectUrl(key, Date.now()) };
}

export async function deleteObject(key: string) {
  const clean = key.replace(/^\/+/, '');
  try {
    await getClient().send(
      new DeleteObjectCommand({
        Bucket: r2Bucket(),
        Key: clean,
      })
    );
  } catch {
    /* ignore missing objects */
  }
}

export async function getObject(key: string) {
  const clean = key.replace(/^\/+/, '');
  const result = await getClient().send(
    new GetObjectCommand({
      Bucket: r2Bucket(),
      Key: clean,
    })
  );
  return {
    body: result.Body as Readable | undefined,
    contentType: result.ContentType || 'application/octet-stream',
    contentLength: result.ContentLength,
  };
}

/** Head bucket + write/read/delete a tiny object so we know Put actually works. */
export async function verifyR2Connection() {
  assertR2Ready();
  const s3 = getClient();
  await s3.send(new HeadBucketCommand({ Bucket: r2Bucket() }));
  const key = `_healthcheck/${Date.now()}.txt`;
  const body = Buffer.from(`campusdesk-r2-ok-${Date.now()}`);
  await putObject({ key, body, contentType: 'text/plain' });
  const got = await getObject(key);
  if (!got.body) throw new Error('R2 GetObject returned empty body after Put');
  // Drain stream so the socket can close cleanly.
  for await (const _chunk of got.body) {
    /* discard */
  }
  await deleteObject(key);
  lastVerifyOk = true;
  lastVerifyError = '';
  return true;
}

export async function verifyR2ConnectionSafe() {
  try {
    await verifyR2Connection();
    return true;
  } catch (err) {
    lastVerifyOk = false;
    lastVerifyError = (err as Error).message || 'R2 verify failed';
    console.error('[r2] verify failed:', lastVerifyError);
    return false;
  }
}

export function sanitizeStorageKey(raw: string) {
  return String(raw || '')
    .replace(/^\/+/, '')
    .replace(/\.\./g, '')
    .replace(/\\/g, '/')
    .split('/')
    .filter(Boolean)
    .join('/');
}
