import type { Request, Response } from 'express';
import { prisma } from '../config/db.js';
import { orgId, sellableModules } from '../lib/tenant.js';

export const getDashboard = async (req: Request, res: Response) => {
  try {
    const organizationId = orgId(req);
    if (!organizationId) {
      return res.status(403).json({ message: 'Account is not linked to an organisation.' });
    }

    const now = new Date();
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

    const [applicants, applicationStatuses, careerTypes, studentPeople, staffPeople, todayStudent, todayStaff, classCount, teacherCount] =
      await Promise.all([
        prisma.user.count({ where: { role: 'applicant', organizationId } }),
        prisma.application.groupBy({
          by: ['status'],
          where: { organizationId },
          _count: { _all: true },
        }),
        prisma.career.groupBy({
          by: ['type'],
          where: { organizationId },
          _count: { _all: true },
        }),
        prisma.attendancePerson.count({ where: { organizationId, kind: 'student', active: true } }),
        prisma.attendancePerson.count({ where: { organizationId, kind: 'staff', active: true } }),
        prisma.attendanceRecord.count({
          where: { organizationId, date: today, status: 'present', person: { kind: 'student' } },
        }),
        prisma.attendanceRecord.count({
          where: { organizationId, date: today, status: 'present', person: { kind: 'staff' } },
        }),
        prisma.classSection.count({ where: { organizationId, active: true } }),
        prisma.user.count({ where: { organizationId, role: 'teacher', blocked: false } }),
      ]);

    const statusCount = (key: string) => applicationStatuses.find((row) => row.status === key)?._count._all || 0;
    const openings = careerTypes.reduce((sum, row) => sum + row._count._all, 0);

    res.json({
      organization: {
        id: req.organization?.id,
        name: req.organization?.name,
        slug: req.organization?.slug,
        title: req.organization?.title || req.organization?.name || '',
        tagline: req.organization?.tagline || '',
        logo: req.organization?.logo || '',
        kind: req.organization?.kind || 'education',
        modules: sellableModules(req.organization?.modules),
      },
      admissions: {
        applicants,
        notStarted: statusCount('not_started'),
        inProgress: statusCount('in_progress'),
        submitted: statusCount('submitted'),
        accepted: statusCount('accepted'),
        rejected: statusCount('rejected'),
      },
      careers: {
        openings,
        byType: careerTypes.map((row) => ({ type: row.type, count: row._count._all })),
      },
      attendance: {
        students: studentPeople,
        staff: staffPeople,
        presentStudents: todayStudent,
        presentStaff: todayStaff,
      },
      teaching: {
        classes: classCount,
        teachers: teacherCount,
      },
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to load dashboard', error: (err as Error).message });
  }
};
