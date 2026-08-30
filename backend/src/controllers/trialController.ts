import type { Request, Response } from 'express';
import { prisma } from '../config/db.js';
import { bustOrgCache } from '../lib/tenant.js';
import { CACHE_KEYS, cacheDel } from '../config/redis.js';
import { getTrialConfig, ensurePlatformConfig } from '../lib/trial.js';
import { logPlatformEvent } from '../lib/platformEvents.js';

export const getTrialSettings = async (_req: Request, res: Response) => {
  try {
    const config = await getTrialConfig();
    res.json(config);
  } catch (err) {
    res.status(500).json({ message: 'Failed to load trial settings', error: (err as Error).message });
  }
};

export const updateTrialSettings = async (req: Request, res: Response): Promise<void> => {
  try {
    const trialDays = Number(req.body.trialDays);
    const trialMaxAdmins = Number(req.body.trialMaxAdmins);
    const trialMaxFaculty = Number(req.body.trialMaxFaculty);
    const trialMaxStudents = Number(req.body.trialMaxStudents);
    if (![trialDays, trialMaxAdmins, trialMaxFaculty, trialMaxStudents].every((n) => Number.isFinite(n) && n >= 0)) {
      res.status(400).json({ message: 'Trial settings must be non-negative numbers.' });
      return;
    }
    if (trialDays < 1) {
      res.status(400).json({ message: 'Trial period must be at least 1 day.' });
      return;
    }
    await ensurePlatformConfig();
    const updated = await prisma.platformConfig.update({
      where: { id: 'default' },
      data: { trialDays, trialMaxAdmins, trialMaxFaculty, trialMaxStudents },
    });
    await cacheDel(CACHE_KEYS.platformDashboard);
    await logPlatformEvent('trial.settings_updated', req.user, null, {
      trialDays: updated.trialDays,
      trialMaxAdmins: updated.trialMaxAdmins,
      trialMaxFaculty: updated.trialMaxFaculty,
      trialMaxStudents: updated.trialMaxStudents,
    });
    res.json({
      trialDays: updated.trialDays,
      trialMaxAdmins: updated.trialMaxAdmins,
      trialMaxFaculty: updated.trialMaxFaculty,
      trialMaxStudents: updated.trialMaxStudents,
    });
  } catch (err) {
    res.status(400).json({ message: 'Failed to update trial settings', error: (err as Error).message });
  }
};

export const convertTrialOrganization = async (req: Request, res: Response) => {
  try {
    const org = await prisma.organization.findUnique({ where: { id: req.params.id } });
    if (!org) return res.status(404).json({ message: 'Organisation not found' });
    if (!org.isTrial) return res.status(400).json({ message: 'This organisation is not on a trial.' });
    const updated = await prisma.organization.update({
      where: { id: org.id },
      data: {
        isTrial: false,
        trialEndsAt: null,
        trialMaxAdmins: null,
        trialMaxFaculty: null,
        trialMaxStudents: null,
      },
    });
    await bustOrgCache();
    await logPlatformEvent('trial.converted', req.user, org.id, { slug: org.slug });
    res.json({
      id: updated.id,
      isTrial: updated.isTrial,
      trialEndsAt: updated.trialEndsAt,
      message: 'Trial converted to full tenant.',
    });
  } catch (err) {
    res.status(400).json({ message: 'Failed to convert trial', error: (err as Error).message });
  }
};
