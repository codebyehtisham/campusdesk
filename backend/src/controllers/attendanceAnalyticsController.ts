import type { Request, Response } from 'express';
import {
  analyticsByClassDate,
  analyticsClassOverall,
  analyticsMeta,
  analyticsStudent,
} from '../lib/attendanceAnalytics.js';
import { orgId } from '../lib/tenant.js';

export const getAttendanceAnalyticsMeta = async (req: Request, res: Response) => {
  try {
    const organizationId = orgId(req);
    if (!organizationId) return res.status(403).json({ message: 'Organisation required.' });
    res.json(await analyticsMeta(organizationId));
  } catch (err) {
    res.status(500).json({ message: 'Failed to load analytics filters.', error: (err as Error).message });
  }
};

export const getAttendanceByClassDate = async (req: Request, res: Response) => {
  try {
    const organizationId = orgId(req);
    if (!organizationId) return res.status(403).json({ message: 'Organisation required.' });
    res.json(await analyticsByClassDate(organizationId, req.query.date));
  } catch (err) {
    res.status(500).json({ message: 'Failed to load class attendance.', error: (err as Error).message });
  }
};

export const getAttendanceStudentAnalytics = async (req: Request, res: Response) => {
  try {
    const organizationId = orgId(req);
    if (!organizationId) return res.status(403).json({ message: 'Organisation required.' });
    const classId = String(req.query.classId || '').trim() || undefined;
    const payload = await analyticsStudent(organizationId, req.params.personId, classId);
    if (!payload) return res.status(404).json({ message: 'Student not found.' });
    res.json(payload);
  } catch (err) {
    res.status(500).json({ message: 'Failed to load student attendance.', error: (err as Error).message });
  }
};

export const getAttendanceClassAnalytics = async (req: Request, res: Response) => {
  try {
    const organizationId = orgId(req);
    if (!organizationId) return res.status(403).json({ message: 'Organisation required.' });
    const payload = await analyticsClassOverall(organizationId, req.params.classId);
    if (!payload) return res.status(404).json({ message: 'Class not found.' });
    res.json(payload);
  } catch (err) {
    res.status(500).json({ message: 'Failed to load class attendance.', error: (err as Error).message });
  }
};
