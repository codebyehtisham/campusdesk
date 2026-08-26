import type { Request, Response } from 'express';
import type { Organization } from '@prisma/client';
import { prisma } from '../config/db.js';
import { CACHE_KEYS, cacheDel, cacheGet, cacheSet } from '../config/redis.js';
import { getPublicOrganization, hasModule, orgId, resolveOrganizationByInstitute, sellableModules } from '../lib/tenant.js';
import { sanitizeTheme } from '../lib/theme.js';
import { parseFence } from '../lib/geofence.js';

export const getSiteSettings = async (organizationId: string | null) => {
  if (!organizationId) return null;
  const existing = await prisma.setting.findUnique({ where: { organizationId } });
  if (existing) return existing;
  return prisma.setting.create({ data: { organizationId, admissionsOpen: true } });
};

export const getPublicSettings = async (req: Request, res: Response) => {
  try {
    const institute = String(req.query.institute || req.query.organizationSlug || '')
      .trim()
      .toLowerCase();
    const cacheKey = institute ? `${CACHE_KEYS.publicSettings}:${institute}` : CACHE_KEYS.publicSettings;
    const cached = await cacheGet<{ admissionsOpen: boolean; organization: unknown }>(cacheKey);
    if (cached) return res.json(cached);

    const org = institute ? await resolveOrganizationByInstitute(institute) : await getPublicOrganization();
    const settings = org ? await getSiteSettings(org.id) : null;
    const fence = settings ? parseFence(settings) : null;
    const locationEnabled = Boolean(settings?.attendanceLocationEnabled);
    const payload = {
      admissionsOpen: Boolean(settings?.admissionsOpen) && hasModule(org, 'admissions'),
      attendanceLocationEnabled: locationEnabled,
      latitude: fence?.latitude ?? null,
      longitude: fence?.longitude ?? null,
      radiusMeters: fence?.radiusMeters ?? null,
      location: fence
        ? {
            latitude: fence.latitude,
            longitude: fence.longitude,
            radiusMeters: fence.radiusMeters,
          }
        : null,
      organization: org
        ? {
            name: org.name,
            slug: org.slug,
            title: org.title || org.name,
            tagline: org.tagline || '',
            logo: org.logo || '',
            modules: sellableModules(org.modules),
            theme: sanitizeTheme(org.theme),
          }
        : { name: '', slug: '', title: '', tagline: '', logo: '', modules: [], theme: null },
    };
    await cacheSet(cacheKey, payload, 60);
    res.json(payload);
  } catch (err) {
    res.status(500).json({ message: 'Failed to load settings', error: (err as Error).message });
  }
};

export const updateSettings = async (req: Request, res: Response) => {
  try {
    if (typeof req.body.admissionsOpen !== 'boolean') {
      return res.status(400).json({ message: 'admissionsOpen must be true or false.' });
    }
    const organizationId = orgId(req);
    const settings = await getSiteSettings(organizationId);
    if (!settings) return res.status(400).json({ message: 'Failed to update settings' });
    const updated = await prisma.setting.update({
      where: { id: settings.id },
      data: { admissionsOpen: req.body.admissionsOpen },
    });
    await cacheDel(CACHE_KEYS.publicSettings, CACHE_KEYS.publicOrg);
    res.json({ admissionsOpen: updated.admissionsOpen });
  } catch (err) {
    res.status(400).json({ message: 'Failed to update settings', error: (err as Error).message });
  }
};

export type OrgLike = Organization | null;
