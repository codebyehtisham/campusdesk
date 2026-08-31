import type { AttendancePerson, ClassSection } from '@prisma/client';
import type { Request as ExpressRequest } from 'express';
import { prisma } from '../config/db.js';
import { orgId } from './tenant.js';

export type StudentPerson = AttendancePerson & {
  enrollments?: { classId: string; class: ClassSection }[];
};

export const findStudentPerson = async (user: { email: string; organizationId: string | null }) => {
  if (!user.organizationId) return null;
  const email = String(user.email || '').trim().toLowerCase();
  if (!email) return null;
  return prisma.attendancePerson.findFirst({
    where: {
      organizationId: user.organizationId,
      kind: 'student',
      email,
      active: true,
    },
  });
};

export const findStudentPersonWithClasses = async (user: { email: string; organizationId: string | null }) => {
  if (!user.organizationId) return null;
  const email = String(user.email || '').trim().toLowerCase();
  if (!email) return null;
  return prisma.attendancePerson.findFirst({
    where: {
      organizationId: user.organizationId,
      kind: 'student',
      email,
      active: true,
    },
    include: {
      enrollments: {
        include: {
          class: {
            include: {
              teacher: { select: { id: true, name: true, email: true } },
              course: { select: { id: true, title: true, level: true } },
            },
          },
        },
      },
    },
  });
};

export const requireStudentPerson = async (req: ExpressRequest) => {
  const organizationId = orgId(req);
  if (!organizationId || !req.user) return { error: 'Account is not linked to an organisation.' as const };
  const person = await findStudentPerson(req.user);
  if (!person) {
    return { error: 'No active student profile found. Ask admin to enroll you in a class.' as const };
  }
  return { organizationId, person, user: req.user };
};

export const studentEnrolledInClass = async (personId: string, classId: string, organizationId: string) => {
  const enrollment = await prisma.classEnrollment.findFirst({
    where: {
      personId,
      classId,
      class: { organizationId, active: true },
    },
    include: {
      class: {
        include: {
          teacher: { select: { id: true, name: true, email: true } },
          course: { select: { id: true, title: true, level: true } },
        },
      },
    },
  });
  return enrollment;
};

export const toClassCard = (cls: {
  id: string;
  name: string;
  code: string;
  room: string;
  teacher?: { id: string; name: string; email: string } | null;
  course?: { id: string; title: string; level: string } | null;
}) => ({
  id: cls.id,
  name: cls.name,
  code: cls.code,
  room: cls.room,
  teacher: cls.teacher ? { id: cls.teacher.id, name: cls.teacher.name, email: cls.teacher.email } : null,
  course: cls.course ? { id: cls.course.id, title: cls.course.title, level: cls.course.level } : null,
});
