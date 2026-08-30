import { createHash } from 'node:crypto';
import type { FeatureFlag, OrgFeatureOverride } from '@prisma/client';
import { prisma } from '../config/db.js';

const hashRollout = (organizationId: string, key: string) => {
  const hex = createHash('sha256').update(`${key}:${organizationId}`).digest('hex').slice(0, 8);
  return (parseInt(hex, 16) % 10000) / 100;
};

export const isFeatureEnabledForOrg = (
  flag: FeatureFlag,
  organizationId: string,
  override?: OrgFeatureOverride | null
) => {
  if (override) return override.enabled;
  if (!flag.enabled) return false;
  if (flag.rolloutPercent >= 100) return true;
  if (flag.rolloutPercent <= 0) return false;
  return hashRollout(organizationId, flag.key) < flag.rolloutPercent;
};

export const evaluateFeatureForOrg = async (organizationId: string, key: string) => {
  const flag = await prisma.featureFlag.findUnique({
    where: { key },
    include: {
      overrides: { where: { organizationId }, take: 1 },
    },
  });
  if (!flag) return { key, enabled: false, source: 'missing' as const };
  const override = flag.overrides[0] || null;
  const enabled = isFeatureEnabledForOrg(flag, organizationId, override);
  return {
    key: flag.key,
    enabled,
    source: override ? ('override' as const) : flag.enabled ? ('rollout' as const) : ('off' as const),
    rolloutPercent: flag.rolloutPercent,
  };
};

export const listFeatureFlags = () =>
  prisma.featureFlag.findMany({
    orderBy: [{ name: 'asc' }],
    include: { _count: { select: { overrides: true } } },
  });

export const ensureDefaultFeatureFlags = async () => {
  const defaults = [
    {
      key: 'tenant_usage_dashboard',
      name: 'Usage dashboard',
      description: 'Show seat, storage, and API metering on the org admin home.',
      enabled: true,
      rolloutPercent: 100,
    },
    {
      key: 'attendance_qr_brand',
      name: 'Branded attendance QR',
      description: 'Teal branded QR codes for attendance sessions.',
      enabled: true,
      rolloutPercent: 100,
    },
    {
      key: 'billing_auto_lock',
      name: 'Billing auto-lock',
      description: 'Honor suspend-on-overdue for tenants with this flag on.',
      enabled: true,
      rolloutPercent: 100,
    },
    {
      key: 'admissions_form_builder',
      name: 'Admission form builder',
      description: 'Configurable apply form fields per organisation.',
      enabled: true,
      rolloutPercent: 80,
    },
    {
      key: 'faculty_timetable_v2',
      name: 'Faculty timetable v2',
      description: 'Enhanced timetable grid and conflict hints.',
      enabled: false,
      rolloutPercent: 25,
    },
  ];

  for (const item of defaults) {
    await prisma.featureFlag.upsert({
      where: { key: item.key },
      create: item,
      update: {},
    });
  }
};
