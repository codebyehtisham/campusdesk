import type { Request, Response } from 'express';
import { prisma } from '../config/db.js';
import { toNotification } from '../lib/notifications.js';

const listForUser = async (userId: string, limit = 40) =>
  prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

export const listNotifications = async (req: Request, res: Response) => {
  try {
    const items = await listForUser(req.user!.id);
    res.json(items.map(toNotification));
  } catch (err) {
    res.status(500).json({ message: 'Failed to load notifications', error: (err as Error).message });
  }
};

export const unreadNotificationCount = async (req: Request, res: Response) => {
  try {
    const count = await prisma.notification.count({
      where: { userId: req.user!.id, readAt: null },
    });
    res.json({ count });
  } catch (err) {
    res.status(500).json({ message: 'Failed to load notification count', error: (err as Error).message });
  }
};

export const getNotification = async (req: Request, res: Response) => {
  try {
    const item = await prisma.notification.findFirst({
      where: { id: req.params.id, userId: req.user!.id },
    });
    if (!item) return res.status(404).json({ message: 'Notification not found' });
    res.json(toNotification(item));
  } catch (err) {
    res.status(500).json({ message: 'Failed to load notification', error: (err as Error).message });
  }
};

export const markNotificationRead = async (req: Request, res: Response) => {
  try {
    const item = await prisma.notification.findFirst({
      where: { id: req.params.id, userId: req.user!.id },
    });
    if (!item) return res.status(404).json({ message: 'Notification not found' });
    const updated = await prisma.notification.update({
      where: { id: item.id },
      data: { readAt: item.readAt || new Date() },
    });
    res.json(toNotification(updated));
  } catch (err) {
    res.status(400).json({ message: 'Failed to update notification', error: (err as Error).message });
  }
};

export const markAllNotificationsRead = async (req: Request, res: Response) => {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.user!.id, readAt: null },
      data: { readAt: new Date() },
    });
    res.json({ message: 'All notifications marked as read.' });
  } catch (err) {
    res.status(400).json({ message: 'Failed to update notifications', error: (err as Error).message });
  }
};
