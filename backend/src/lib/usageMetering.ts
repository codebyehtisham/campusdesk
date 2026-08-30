import { prisma } from '../config/db.js';

const startOfUtcDay = (date = new Date()) => {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
};

export const recordApiCall = async (organizationId: string | null | undefined) => {
  if (!organizationId) return;
  const periodDate = startOfUtcDay();
  try {
    await prisma.tenantUsageSnapshot.upsert({
      where: {
        organizationId_periodDate: { organizationId, periodDate },
      },
      create: { organizationId, periodDate, apiCalls: 1 },
      update: { apiCalls: { increment: 1 } },
    });
  } catch (err) {
    console.error('[usage] api increment failed:', (err as Error).message);
  }
};

const estimateStorageBytes = async (organizationId: string) => {
  const [apps, org, appCount] = await Promise.all([
    prisma.application.findMany({
      where: { organizationId },
      select: { answers: true, formSnapshot: true },
    }),
    prisma.organization.findUnique({ where: { id: organizationId }, select: { logo: true } }),
    prisma.application.count({ where: { organizationId } }),
  ]);
  let bytes = BigInt((org?.logo || '').length * 120);
  for (const app of apps) {
    bytes += BigInt(JSON.stringify(app.answers || '').length);
    bytes += BigInt(JSON.stringify(app.formSnapshot || '').length);
  }
  bytes += BigInt(appCount) * BigInt(48_000);
  return bytes;
};

export const refreshOrgUsageSnapshot = async (organizationId: string) => {
  const periodDate = startOfUtcDay();
  const [seatCount, storageBytes, snapshot] = await Promise.all([
    prisma.user.count({ where: { organizationId } }),
    estimateStorageBytes(organizationId),
    prisma.tenantUsageSnapshot.findUnique({
      where: { organizationId_periodDate: { organizationId, periodDate } },
    }),
  ]);

  const apiCalls = snapshot?.apiCalls ?? 0;

  return prisma.tenantUsageSnapshot.upsert({
    where: { organizationId_periodDate: { organizationId, periodDate } },
    create: { organizationId, periodDate, apiCalls, seatCount, storageBytes },
    update: { seatCount, storageBytes },
  });
};

export const getOrgUsage = async (organizationId: string) => {
  const periodDate = startOfUtcDay();
  const [today, history, seatsByRole] = await Promise.all([
    refreshOrgUsageSnapshot(organizationId),
    prisma.tenantUsageSnapshot.findMany({
      where: { organizationId },
      orderBy: { periodDate: 'desc' },
      take: 30,
    }),
    prisma.user.groupBy({
      by: ['role'],
      where: { organizationId },
      _count: { _all: true },
    }),
  ]);

  const monthStart = new Date(periodDate);
  monthStart.setUTCDate(1);
  const monthApiCalls = history
    .filter((row) => row.periodDate >= monthStart)
    .reduce((sum, row) => sum + row.apiCalls, 0);

  return {
    today: {
      apiCalls: today.apiCalls,
      seatCount: today.seatCount,
      storageBytes: today.storageBytes.toString(),
    },
    monthApiCalls,
    seatsByRole: seatsByRole.map((row) => ({ role: row.role, count: row._count._all })),
    history: history.map((row) => ({
      periodDate: row.periodDate,
      apiCalls: row.apiCalls,
      seatCount: row.seatCount,
      storageBytes: row.storageBytes.toString(),
    })),
  };
};

export const listFleetUsage = async () => {
  const periodDate = startOfUtcDay();
  const orgs = await prisma.organization.findMany({
    where: { status: { not: 'archived' } },
    select: { id: true, name: true, slug: true },
    orderBy: { name: 'asc' },
  });
  const snapshots = await prisma.tenantUsageSnapshot.findMany({
    where: { periodDate, organizationId: { in: orgs.map((o) => o.id) } },
  });
  const map = new Map(snapshots.map((s) => [s.organizationId, s]));
  return orgs.map((org) => {
    const snap = map.get(org.id);
    return {
      organizationId: org.id,
      name: org.name,
      slug: org.slug,
      apiCalls: snap?.apiCalls ?? 0,
      seatCount: snap?.seatCount ?? 0,
      storageBytes: (snap?.storageBytes ?? BigInt(0)).toString(),
    };
  });
};
