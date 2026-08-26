import type { Request, Response } from 'express';
import { prisma } from '../config/db.js';
import { getPublicOrganization, withIds } from '../lib/tenant.js';

const orgScope = async () => {
  const org = await getPublicOrganization();
  return org?.id;
};

export const getAllFaculty = async (req: Request, res: Response) => {
  try {
    const organizationId = await orgScope();
    const faculty = await prisma.faculty.findMany({
      where: {
        organizationId: organizationId || undefined,
        department: req.query.department ? String(req.query.department) : undefined,
      },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    });
    res.json(faculty.map(withIds));
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch faculty', error: (err as Error).message });
  }
};

export const getFacultyById = async (req: Request, res: Response) => {
  try {
    const member = await prisma.faculty.findUnique({ where: { id: req.params.id } });
    if (!member) return res.status(404).json({ message: 'Faculty member not found' });
    res.json(withIds(member));
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch faculty member', error: (err as Error).message });
  }
};

export const getAllCourses = async (req: Request, res: Response) => {
  try {
    const organizationId = await orgScope();
    const courses = await prisma.course.findMany({
      where: {
        organizationId: organizationId || undefined,
        category: req.query.category ? String(req.query.category) : undefined,
      },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    });
    res.json(courses.map(withIds));
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch courses', error: (err as Error).message });
  }
};

export const getCourseById = async (req: Request, res: Response) => {
  try {
    const course = await prisma.course.findUnique({ where: { id: req.params.id } });
    if (!course) return res.status(404).json({ message: 'Course not found' });
    res.json(withIds(course));
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch course', error: (err as Error).message });
  }
};

export const getAllNews = async (_req: Request, res: Response) => {
  try {
    const organizationId = await orgScope();
    const news = await prisma.news.findMany({
      where: { organizationId: organizationId || undefined },
      orderBy: { date: 'desc' },
    });
    res.json(news.map(withIds));
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch news', error: (err as Error).message });
  }
};

export const submitContact = async (req: Request, res: Response) => {
  try {
    const { name, email, message } = req.body;
    if (!name || !email || !message) {
      return res.status(400).json({ message: 'Name, email and message are required' });
    }
    const organizationId = await orgScope();
    const entry = await prisma.contact.create({
      data: {
        name,
        email,
        message,
        phone: req.body.phone || '',
        subject: req.body.subject || 'General Inquiry',
        organizationId: organizationId || null,
      },
    });
    res.status(201).json({ message: 'Thank you! Your inquiry has been received.', entry: withIds(entry) });
  } catch (err) {
    res.status(400).json({ message: 'Failed to submit inquiry', error: (err as Error).message });
  }
};

export const getAllContacts = async (_req: Request, res: Response) => {
  try {
    const entries = await prisma.contact.findMany({ orderBy: { createdAt: 'desc' } });
    res.json(entries.map(withIds));
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch inquiries', error: (err as Error).message });
  }
};
