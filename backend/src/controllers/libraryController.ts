import type { Request, Response } from 'express';
import { prisma } from '../config/db.js';
import { orgId } from '../lib/tenant.js';

export const listLibraryItems = async (req: Request, res: Response) => {
  try {
    const organizationId = orgId(req);
    if (!organizationId) return res.status(403).json({ message: 'Account is not linked to an organisation.' });
    const items = await prisma.libraryItem.findMany({
      where: { organizationId },
      orderBy: [{ active: 'desc' }, { title: 'asc' }],
    });
    res.json(items);
  } catch (err) {
    res.status(500).json({ message: 'Failed to load catalog', error: (err as Error).message });
  }
};

export const createLibraryItem = async (req: Request, res: Response) => {
  try {
    const organizationId = orgId(req);
    if (!organizationId) return res.status(403).json({ message: 'Account is not linked to an organisation.' });
    const title = String(req.body.title || '').trim();
    if (!title) return res.status(400).json({ message: 'Title is required.' });
    const copiesTotal = Math.max(1, Math.round(Number(req.body.copiesTotal) || 1));
    const item = await prisma.libraryItem.create({
      data: {
        organizationId,
        title,
        author: String(req.body.author || '').trim(),
        isbn: String(req.body.isbn || '').trim(),
        copiesTotal,
        copiesAvailable: copiesTotal,
      },
    });
    res.status(201).json(item);
  } catch (err) {
    res.status(400).json({ message: 'Failed to add item', error: (err as Error).message });
  }
};

export const updateLibraryItem = async (req: Request, res: Response) => {
  try {
    const organizationId = orgId(req);
    if (!organizationId) return res.status(403).json({ message: 'Account is not linked to an organisation.' });
    const item = await prisma.libraryItem.findFirst({ where: { id: req.params.id, organizationId } });
    if (!item) return res.status(404).json({ message: 'Item not found' });

    const copiesTotal =
      req.body.copiesTotal != null ? Math.max(1, Math.round(Number(req.body.copiesTotal))) : item.copiesTotal;
    const onLoan = item.copiesTotal - item.copiesAvailable;
    const copiesAvailable = Math.max(0, copiesTotal - onLoan);

    const updated = await prisma.libraryItem.update({
      where: { id: item.id },
      data: {
        title: req.body.title != null ? String(req.body.title).trim() : undefined,
        author: req.body.author != null ? String(req.body.author).trim() : undefined,
        isbn: req.body.isbn != null ? String(req.body.isbn).trim() : undefined,
        copiesTotal,
        copiesAvailable,
        active: req.body.active != null ? Boolean(req.body.active) : undefined,
      },
    });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ message: 'Failed to update item', error: (err as Error).message });
  }
};

export const listLibraryLoans = async (req: Request, res: Response) => {
  try {
    const organizationId = orgId(req);
    if (!organizationId) return res.status(403).json({ message: 'Account is not linked to an organisation.' });
    const activeOnly = String(req.query.active || '') === '1';
    const loans = await prisma.libraryLoan.findMany({
      where: {
        organizationId,
        ...(activeOnly ? { returnedAt: null } : {}),
      },
      include: {
        item: { select: { id: true, title: true, author: true } },
        person: { select: { id: true, name: true, title: true, email: true } },
      },
      orderBy: [{ returnedAt: 'asc' }, { issuedAt: 'desc' }],
    });
    res.json(loans);
  } catch (err) {
    res.status(500).json({ message: 'Failed to load loans', error: (err as Error).message });
  }
};

export const issueLibraryLoan = async (req: Request, res: Response) => {
  try {
    const organizationId = orgId(req);
    if (!organizationId) return res.status(403).json({ message: 'Account is not linked to an organisation.' });
    const itemId = String(req.body.itemId || '').trim();
    const personId = String(req.body.personId || '').trim();
    if (!itemId || !personId) return res.status(400).json({ message: 'Choose a book and a member.' });

    const [item, person] = await Promise.all([
      prisma.libraryItem.findFirst({ where: { id: itemId, organizationId, active: true } }),
      prisma.attendancePerson.findFirst({ where: { id: personId, organizationId, active: true } }),
    ]);
    if (!item) return res.status(404).json({ message: 'Book not found' });
    if (!person) return res.status(404).json({ message: 'Member not found' });
    if (item.copiesAvailable < 1) return res.status(400).json({ message: 'No copies available to issue.' });

    const loan = await prisma.$transaction(async (tx) => {
      const created = await tx.libraryLoan.create({
        data: {
          organizationId,
          itemId: item.id,
          personId: person.id,
          dueAt: req.body.dueAt ? new Date(req.body.dueAt) : null,
          notes: String(req.body.notes || '').trim(),
        },
        include: {
          item: { select: { id: true, title: true, author: true } },
          person: { select: { id: true, name: true, title: true, email: true } },
        },
      });
      await tx.libraryItem.update({
        where: { id: item.id },
        data: { copiesAvailable: { decrement: 1 } },
      });
      return created;
    });

    res.status(201).json(loan);
  } catch (err) {
    res.status(400).json({ message: 'Failed to issue book', error: (err as Error).message });
  }
};

export const returnLibraryLoan = async (req: Request, res: Response) => {
  try {
    const organizationId = orgId(req);
    if (!organizationId) return res.status(403).json({ message: 'Account is not linked to an organisation.' });
    const loan = await prisma.libraryLoan.findFirst({
      where: { id: req.params.id, organizationId },
      include: { item: true },
    });
    if (!loan) return res.status(404).json({ message: 'Loan not found' });
    if (loan.returnedAt) return res.status(400).json({ message: 'This loan is already returned.' });

    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.libraryLoan.update({
        where: { id: loan.id },
        data: {
          returnedAt: new Date(),
          fineCents: Math.max(0, Math.round(Number(req.body.fineCents) || 0)),
          notes: req.body.notes != null ? String(req.body.notes).trim() : loan.notes,
        },
        include: {
          item: { select: { id: true, title: true, author: true } },
          person: { select: { id: true, name: true, title: true, email: true } },
        },
      });
      await tx.libraryItem.update({
        where: { id: loan.itemId },
        data: { copiesAvailable: { increment: 1 } },
      });
      return row;
    });

    res.json(updated);
  } catch (err) {
    res.status(400).json({ message: 'Failed to return book', error: (err as Error).message });
  }
};

export const listLibraryMembers = async (req: Request, res: Response) => {
  try {
    const organizationId = orgId(req);
    if (!organizationId) return res.status(403).json({ message: 'Account is not linked to an organisation.' });
    const members = await prisma.attendancePerson.findMany({
      where: { organizationId, active: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, title: true, email: true, kind: true },
    });
    res.json(members);
  } catch (err) {
    res.status(500).json({ message: 'Failed to load members', error: (err as Error).message });
  }
};
