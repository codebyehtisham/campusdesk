import { prisma } from '../config/db.js';
import { CACHE_KEYS, cacheDel } from '../config/redis.js';
import { DEFAULT_PLANS } from './billing.js';
import { ensureDefaultFeatureFlags } from './featureFlags.js';
import { DEFAULT_DEPARTMENTS, DEFAULT_MODULES } from './tenant.js';

/** Platform-wide departments, modules, and billing plans (not tenant data). */
export async function ensurePlatformCatalog() {
  for (const dept of DEFAULT_DEPARTMENTS) {
    await prisma.department.upsert({
      where: { slug: dept.slug },
      update: { name: dept.name, description: dept.description, sortOrder: dept.sortOrder, active: true },
      create: { ...dept, active: true },
    });
  }

  const departmentBySlug = Object.fromEntries(
    (await prisma.department.findMany()).map((item) => [item.slug, item.id])
  );

  for (const item of DEFAULT_MODULES) {
    const { departmentSlug, ...data } = item;
    await prisma.module.upsert({
      where: { slug: data.slug },
      update: { ...data, active: true, departmentId: departmentBySlug[departmentSlug] || null },
      create: { ...data, active: true, departmentId: departmentBySlug[departmentSlug] || null },
    });
  }

  await prisma.module.deleteMany({ where: { slug: 'audit' } });

  for (const plan of DEFAULT_PLANS) {
    await prisma.plan.upsert({
      where: { slug: plan.slug },
      update: plan,
      create: { ...plan, currency: 'USD' },
    });
  }

  await ensureDefaultFeatureFlags();

  await cacheDel(CACHE_KEYS.modules, CACHE_KEYS.catalog, CACHE_KEYS.platformDashboard);
}
