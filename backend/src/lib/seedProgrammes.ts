import type { Prisma } from '@prisma/client';
import { prisma } from '../config/db.js';
import { courses } from '../seed/content.js';

export type ProgrammeSeed = Omit<Prisma.CourseCreateInput, 'organization' | 'organizationId'>;

export const DEFAULT_PROGRAMMES: ProgrammeSeed[] = courses;

/** Upsert default programmes (courses) for one education organisation. */
export async function ensureOrgProgrammes(organizationId: string) {
  let created = 0;
  for (const item of DEFAULT_PROGRAMMES) {
    const existing = await prisma.course.findFirst({
      where: { organizationId, title: item.title },
    });
    if (existing) {
      await prisma.course.update({
        where: { id: existing.id },
        data: {
          level: item.level,
          duration: item.duration,
          category: item.category,
          description: item.description,
          highlights: item.highlights,
          eligibility: item.eligibility,
          order: item.order,
        },
      });
    } else {
      await prisma.course.create({ data: { ...item, organizationId } });
      created += 1;
    }
  }
  return created;
}

/** Ensure programmes exist for every active non-hospital institute. */
export async function ensureEducationProgrammes() {
  const orgs = await prisma.organization.findMany({
    where: { status: 'active', kind: { not: 'hospital' } },
    select: { id: true, slug: true },
  });
  let totalCreated = 0;
  for (const org of orgs) {
    const created = await ensureOrgProgrammes(org.id);
    if (created) console.log(`Programmes: added ${created} for ${org.slug}`);
    totalCreated += created;
  }
  return { orgs: orgs.length, created: totalCreated };
}

export const programmeOptions = () => DEFAULT_PROGRAMMES.map((item) => item.title);
