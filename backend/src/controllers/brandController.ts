import { mkdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Request, Response } from 'express';
import { prisma } from '../config/db.js';
import { CACHE_KEYS, cacheDel } from '../config/redis.js';
import { orgId } from '../lib/tenant.js';
import { brandFields } from '../middleware/auth.js';

const uploadsRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../uploads');
const EXT: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/svg+xml': '.svg',
};
const MAX_BYTES = 1.5 * 1024 * 1024;

const clip = (value: unknown, max: number) => String(value || '').trim().slice(0, max);

const brandPayload = (org: { name: string; title: string; tagline: string; logo: string; slug: string }) => ({
  name: org.name,
  slug: org.slug,
  ...brandFields(org),
});

export const updateBrand = async (req: Request, res: Response) => {
  try {
    const organizationId = orgId(req);
    if (!organizationId || !req.organization) {
      return res.status(403).json({ message: 'Account is not linked to an organisation.' });
    }
    const title = clip(req.body.title, 80);
    const tagline = clip(req.body.tagline, 80);
    if (!title) return res.status(400).json({ message: 'Title text is required.' });

    const updated = await prisma.organization.update({
      where: { id: organizationId },
      data: { title, tagline },
    });
    await cacheDel(CACHE_KEYS.publicSettings, CACHE_KEYS.publicOrg);
    res.json(brandPayload(updated));
  } catch (err) {
    res.status(400).json({ message: 'Could not save branding.', error: (err as Error).message });
  }
};

export const saveLogo = async (req: Request, res: Response) => {
  try {
    const organizationId = orgId(req);
    if (!organizationId || !req.organization) {
      return res.status(403).json({ message: 'Account is not linked to an organisation.' });
    }
    const raw = String(req.body.logo || '');
    const match = raw.match(/^data:(image\/(?:png|jpeg|webp|gif|svg\+xml));base64,([A-Za-z0-9+/=\s]+)$/);
    if (!match) return res.status(400).json({ message: 'Use a PNG, JPG, WEBP, GIF, or SVG logo.' });
    const mime = match[1];
    const buffer = Buffer.from(match[2].replace(/\s/g, ''), 'base64');
    if (!buffer.length) return res.status(400).json({ message: 'Choose a logo image to upload.' });
    if (buffer.length > MAX_BYTES) return res.status(400).json({ message: 'Logo must be 1.5 MB or smaller.' });

    const ext = EXT[mime];
    const dir = path.join(uploadsRoot, organizationId);
    await mkdir(dir, { recursive: true });
    const filename = `logo${ext}`;
    await writeFile(path.join(dir, filename), buffer);
    for (const leftover of Object.values(EXT)) {
      if (leftover === ext) continue;
      await unlink(path.join(dir, `logo${leftover}`)).catch(() => undefined);
    }

    const logo = `/uploads/${organizationId}/${filename}?v=${Date.now()}`;
    const updated = await prisma.organization.update({
      where: { id: organizationId },
      data: { logo },
    });
    await cacheDel(CACHE_KEYS.publicSettings, CACHE_KEYS.publicOrg);
    res.json(brandPayload(updated));
  } catch (err) {
    res.status(400).json({ message: (err as Error).message || 'Could not upload the logo.' });
  }
};
