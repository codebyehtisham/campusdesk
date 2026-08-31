import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isR2Disabled, putObject, readStoredObject } from './storage.js';

const uploadsRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../uploads');
const allowLocalUploads = () => isR2Disabled();

export const ASSIGNMENT_MAX_FILE_MB = 10;

const EXT: Record<string, string> = {
  'application/pdf': '.pdf',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
};

export const ASSIGNMENT_ALLOWED_MIMES = new Set(Object.keys(EXT));

export type StoredAssignmentFile = {
  url: string;
  name: string;
  size: number;
  mime: string;
  key: string;
};

const clipFilename = (value: unknown) =>
  String(value || '')
    .trim()
    .replace(/[/\\?%*:|"<>]/g, '')
    .slice(0, 120);

const extFromName = (name: string) => {
  const lower = name.toLowerCase();
  if (lower.endsWith('.pdf')) return '.pdf';
  if (lower.endsWith('.docx')) return '.docx';
  if (lower.endsWith('.doc')) return '.doc';
  return '';
};

const mimeFromExt = (ext: string) => {
  if (ext === '.pdf') return 'application/pdf';
  if (ext === '.doc') return 'application/msword';
  if (ext === '.docx') return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  return '';
};

export function parseAssignmentFileUpload(body: {
  file?: unknown;
  fileName?: unknown;
  fileMime?: unknown;
  fileBase64?: unknown;
}) {
  const maxBytes = ASSIGNMENT_MAX_FILE_MB * 1024 * 1024;
  const fallbackName = clipFilename(body.fileName) || 'submission';

  const dataUrl = String(body.file || '').trim();
  const dataMatch = dataUrl.match(/^data:([a-zA-Z0-9.+/-]+);base64,([A-Za-z0-9+/=\s]+)$/);
  if (dataMatch) {
    const mime = dataMatch[1].toLowerCase();
    if (!ASSIGNMENT_ALLOWED_MIMES.has(mime)) {
      return { error: 'Upload a PDF or Word document (.pdf, .doc, .docx).' as const };
    }
    const buffer = Buffer.from(dataMatch[2].replace(/\s/g, ''), 'base64');
    if (!buffer.length) return { error: 'Choose a file to upload.' as const };
    if (buffer.length > maxBytes) {
      return { error: `File must be ${ASSIGNMENT_MAX_FILE_MB} MB or smaller.` as const };
    }
    const ext = EXT[mime] || extFromName(fallbackName) || '.bin';
    const name = fallbackName.includes('.') ? fallbackName : `${fallbackName}${ext}`;
    return { buffer, mime, name };
  }

  const rawBase64 = String(body.fileBase64 || '').trim();
  if (rawBase64) {
    const mime = String(body.fileMime || '').trim().toLowerCase() || mimeFromExt(extFromName(fallbackName));
    if (!mime || !ASSIGNMENT_ALLOWED_MIMES.has(mime)) {
      return { error: 'Upload a PDF or Word document (.pdf, .doc, .docx).' as const };
    }
    const buffer = Buffer.from(rawBase64.replace(/\s/g, ''), 'base64');
    if (!buffer.length) return { error: 'Choose a file to upload.' as const };
    if (buffer.length > maxBytes) {
      return { error: `File must be ${ASSIGNMENT_MAX_FILE_MB} MB or smaller.` as const };
    }
    const ext = EXT[mime] || extFromName(fallbackName) || '.bin';
    const name = fallbackName.includes('.') ? fallbackName : `${fallbackName}${ext}`;
    return { buffer, mime, name };
  }

  return null;
}

export async function storeAssignmentSubmissionFile(params: {
  organizationId: string;
  assignmentId: string;
  personId: string;
  buffer: Buffer;
  mime: string;
  name: string;
}): Promise<StoredAssignmentFile> {
  const ext = EXT[params.mime] || extFromName(params.name) || '.bin';
  const safeName = clipFilename(params.name).replace(/\.[^.]+$/, '') || 'submission';
  const filename = `${safeName}${ext}`;
  const key = `${params.organizationId}/assignments/${params.assignmentId}/${params.personId}/${filename}`;
  let url: string;

  if (allowLocalUploads()) {
    const dir = path.join(uploadsRoot, params.organizationId, 'assignments', params.assignmentId, params.personId);
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, filename), params.buffer);
    url = `/uploads/${key}?v=${Date.now()}`;
  } else {
    const stored = await putObject({ key, body: params.buffer, contentType: params.mime });
    url = stored.url;
    const verify = await readStoredObject(key);
    if (!verify?.body) {
      throw new Error('Upload verification failed — file was not found in storage after saving.');
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

export const toSubmissionFile = (row: {
  fileUrl?: string;
  fileName?: string;
  fileMime?: string;
  fileSize?: number;
}) =>
  row.fileUrl
    ? {
        url: row.fileUrl,
        name: row.fileName || '',
        mime: row.fileMime || '',
        size: row.fileSize || 0,
      }
    : null;
