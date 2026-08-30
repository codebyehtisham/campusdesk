import type { Request, Response } from 'express';
import { prisma } from '../config/db.js';
import { evaluateFeatureForOrg, isFeatureEnabledForOrg, listFeatureFlags } from '../lib/featureFlags.js';
import { logPlatformEvent } from '../lib/platformEvents.js';

const actor = (req: Request) => req.user || null;

export const getFeatureFlags = async (_req: Request, res: Response) => {
  try {
    const flags = await listFeatureFlags();
    res.json(
      flags.map((flag) => ({
        id: flag.id,
        key: flag.key,
        name: flag.name,
        description: flag.description,
        enabled: flag.enabled,
        rolloutPercent: flag.rolloutPercent,
        overrideCount: flag._count.overrides,
        createdAt: flag.createdAt,
        updatedAt: flag.updatedAt,
      }))
    );
  } catch (err) {
    res.status(500).json({ message: 'Failed to load feature flags', error: (err as Error).message });
  }
};

export const createFeatureFlag = async (req: Request, res: Response) => {
  try {
    const key = String(req.body.key || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]+/g, '_');
    const name = String(req.body.name || '').trim();
    if (!key || !name) return res.status(400).json({ message: 'Key and name are required.' });
    const flag = await prisma.featureFlag.create({
      data: {
        key,
        name,
        description: String(req.body.description || '').trim(),
        enabled: Boolean(req.body.enabled),
        rolloutPercent: Math.max(0, Math.min(100, Number(req.body.rolloutPercent) || 0)),
      },
    });
    await logPlatformEvent('feature_flag.created', actor(req), null, { key: flag.key });
    res.status(201).json(flag);
  } catch (err) {
    res.status(400).json({ message: 'Failed to create feature flag', error: (err as Error).message });
  }
};

export const updateFeatureFlag = async (req: Request, res: Response) => {
  try {
    const flag = await prisma.featureFlag.findUnique({ where: { id: req.params.id } });
    if (!flag) return res.status(404).json({ message: 'Feature flag not found' });
    const updated = await prisma.featureFlag.update({
      where: { id: flag.id },
      data: {
        name: req.body.name != null ? String(req.body.name).trim() : undefined,
        description: req.body.description != null ? String(req.body.description).trim() : undefined,
        enabled: typeof req.body.enabled === 'boolean' ? req.body.enabled : undefined,
        rolloutPercent:
          req.body.rolloutPercent != null
            ? Math.max(0, Math.min(100, Number(req.body.rolloutPercent) || 0))
            : undefined,
      },
    });
    await logPlatformEvent('feature_flag.updated', actor(req), null, { key: updated.key });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ message: 'Failed to update feature flag', error: (err as Error).message });
  }
};

export const listOrgFeatureFlags = async (req: Request, res: Response) => {
  try {
    const org = await prisma.organization.findUnique({ where: { id: req.params.id }, select: { id: true } });
    if (!org) return res.status(404).json({ message: 'Organisation not found' });
    const flags = await prisma.featureFlag.findMany({
      orderBy: { name: 'asc' },
      include: { overrides: { where: { organizationId: org.id }, take: 1 } },
    });
    res.json(
      flags.map((flag) => {
        const override = flag.overrides[0] || null;
        return {
          id: flag.id,
          key: flag.key,
          name: flag.name,
          description: flag.description,
          enabled: flag.enabled,
          rolloutPercent: flag.rolloutPercent,
          effective: isFeatureEnabledForOrg(flag, org.id, override),
          override: override ? { enabled: override.enabled } : null,
        };
      })
    );
  } catch (err) {
    res.status(500).json({ message: 'Failed to load org feature flags', error: (err as Error).message });
  }
};

export const setOrgFeatureOverride = async (req: Request, res: Response) => {
  try {
    const org = await prisma.organization.findUnique({ where: { id: req.params.id }, select: { id: true } });
    if (!org) return res.status(404).json({ message: 'Organisation not found' });
    const flag = await prisma.featureFlag.findUnique({ where: { key: req.params.key } });
    if (!flag) return res.status(404).json({ message: 'Feature flag not found' });

    if (req.body.clear === true) {
      await prisma.orgFeatureOverride.deleteMany({
        where: { organizationId: org.id, featureFlagId: flag.id },
      });
      await logPlatformEvent('feature_flag.override_cleared', actor(req), org.id, { key: flag.key });
      const evaluation = await evaluateFeatureForOrg(org.id, flag.key);
      return res.json(evaluation);
    }

    const enabled = Boolean(req.body.enabled);
    await prisma.orgFeatureOverride.upsert({
      where: {
        organizationId_featureFlagId: { organizationId: org.id, featureFlagId: flag.id },
      },
      create: { organizationId: org.id, featureFlagId: flag.id, enabled },
      update: { enabled },
    });
    await logPlatformEvent('feature_flag.override_set', actor(req), org.id, { key: flag.key, enabled });
    res.json(await evaluateFeatureForOrg(org.id, flag.key));
  } catch (err) {
    res.status(400).json({ message: 'Failed to set feature override', error: (err as Error).message });
  }
};
