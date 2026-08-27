import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isR2Disabled, putObject, readStoredObject } from './storage.js';

const uploadsRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../uploads');
const allowLocalUploads = () => isR2Disabled();

const EXT: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'application/pdf': '.pdf',
};

const ALLOWED_MIMES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'application/pdf']);

export type StoredApplicationFile = {
  url: string;
  name: string;
  size: number;
  mime: string;
  key: string;
};

export function parseDataUrlUpload(raw: string, fallbackName = 'upload') {
  const match = String(raw || '').match(/^data:([a-zA-Z0-9.+/-]+);base64,([A-Za-z0-9+/=\s]+)$/);
  if (!match) return { error: 'Upload a valid image or PDF file.' as const };
  const mime = match[1].toLowerCase();
  if (!ALLOWED_MIMES.has(mime)) {
    return { error: 'Use PNG, JPG, WEBP, GIF, or PDF.' as const };
  }
  const buffer = Buffer.from(match[2].replace(/\s/g, ''), 'base64');
  if (!buffer.length) return { error: 'Choose a file to upload.' as const };
  const ext = EXT[mime] || '.bin';
  const name = clipFilename(fallbackName) || `upload${ext}`;
  return { buffer, mime, name };
}

export async function storeApplicationFile(params: {
  organizationId: string;
  applicationId: string;
  fieldKey: string;
  buffer: Buffer;
  mime: string;
  name: string;
}): Promise<StoredApplicationFile> {
  const ext = EXT[params.mime] || '.bin';
  const filename = `${params.fieldKey}${ext}`;
  const key = `${params.organizationId}/applications/${params.applicationId}/${filename}`;
  let url: string;

  if (allowLocalUploads()) {
    const dir = path.join(uploadsRoot, params.organizationId, 'applications', params.applicationId);
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, filename), params.buffer);
    url = `/uploads/${key}?v=${Date.now()}`;
  } else {
    const stored = await putObject({ key, body: params.buffer, contentType: params.mime });
    url = stored.url;
    const verify = await readStoredObject(key);
    if (!verify?.body) {
      throw new Error('Upload verification failed — file was not found in Cloudflare R2 after saving.');
    }
    if (typeof verify.body.destroy === 'function') {
      verify.body.destroy();
    } else {
      for await (const _chunk of verify.body) {
        /* drain */
      }
    }
  }

  return {
    url,
    name: params.name,
    size: params.buffer.length,
    mime: params.mime,
    key,
  };
}

const clipFilename = (value: unknown) =>
  String(value || '')
    .trim()
    .replace(/[/\\?%*:|"<>]/g, '')
    .slice(0, 120);
