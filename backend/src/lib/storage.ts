import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Readable } from 'node:stream';

/** Cloudflare R2 — S3-compatible API for campusdesk bucket. */
const DEFAULT_ENDPOINT = 'https://fed2231335a1a08237a63ec5f77bc211.r2.cloudflarestorage.com';
const DEFAULT_BUCKET = 'campusdesk';

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

export function isR2Configured() {
  return Boolean(process.env.R2_ACCESS_KEY_ID?.trim() && process.env.R2_SECRET_ACCESS_KEY?.trim());
}

let client: S3Client | null = null;

function getClient() {
  if (!isR2Configured()) {
    throw new Error('R2 is not configured. Set R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY.');
  }
  if (!client) {
    client = new S3Client({
      region: process.env.R2_REGION || 'auto',
      endpoint: r2Endpoint(),
      forcePathStyle: true,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!.trim(),
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!.trim(),
      },
    });
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
  await getClient().send(
    new PutObjectCommand({
      Bucket: r2Bucket(),
      Key: key,
      Body: params.body,
      ContentType: params.contentType,
      CacheControl: 'public, max-age=31536000, immutable',
    })
  );
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

export function sanitizeStorageKey(raw: string) {
  return String(raw || '')
    .replace(/^\/+/, '')
    .replace(/\.\./g, '')
    .replace(/\\/g, '/')
    .split('/')
    .filter(Boolean)
    .join('/');
}
