import type { Request, Response } from 'express';
import type { Prisma } from '@prisma/client';
import { prisma } from '../config/db.js';
import { bustOrgCache, isUniqueError } from '../lib/tenant.js';
import {
  billingOverview,
  invoicePreviewForOrg,
  nextInvoiceNumber,
  toInvoice,
  toPlan,
  toSubscription,
} from '../lib/billing.js';

const addPeriod = (from: Date, interval: string) => {
  const next = new Date(from);
  if (interval === 'year') next.setUTCFullYear(next.getUTCFullYear() + 1);
  else next.setUTCMonth(next.getUTCMonth() + 1);
  return next;
};

export const listPlans = async (_req: Request, res: Response) => {
  try {
    const items = await prisma.plan.findMany({ where: { active: true }, orderBy: { sortOrder: 'asc' } });
    res.json(items.map(toPlan));
  } catch (err) {
    res.status(500).json({ message: 'Failed to load plans', error: (err as Error).message });
  }
};

export const getBillingOverview = async (_req: Request, res: Response) => {
  try {
    const [overview, subscriptions, plans, invoices, organizations] = await Promise.all([
      billingOverview(),
      prisma.subscription.findMany({
        include: { plan: true, organization: { select: { id: true, name: true, slug: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.plan.findMany({ where: { active: true }, orderBy: { sortOrder: 'asc' } }),
      prisma.invoice.findMany({
        include: { organization: { select: { id: true, name: true, slug: true } } },
        orderBy: { issuedAt: 'desc' },
        take: 40,
      }),
      prisma.organization.findMany({
        orderBy: { name: 'asc' },
        select: { id: true, name: true, slug: true, modules: true },
      }),
    ]);
    const tenants = await Promise.all(
      organizations.map(async (org) => ({
        id: org.id,
        name: org.name,
        slug: org.slug,
        preview: await invoicePreviewForOrg(org.modules),
      }))
    );
    res.json({
      ...overview,
      plans: plans.map(toPlan),
      tenants,
      subscriptions: subscriptions.map((item) => ({
        ...toSubscription(item),
        organization: item.organization,
      })),
      invoices: invoices.map((item) => ({
        ...toInvoice(item),
        organization: item.organization,
      })),
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to load billing overview', error: (err as Error).message });
  }
};

export const getOrgBilling = async (req: Request, res: Response) => {
  try {
    const org = await prisma.organization.findUnique({ where: { id: req.params.id } });
    if (!org) return res.status(404).json({ message: 'Organisation not found' });
    const [subscription, invoices, overview, preview] = await Promise.all([
      prisma.subscription.findFirst({
        where: { organizationId: org.id },
        orderBy: { createdAt: 'desc' },
        include: { plan: true },
      }),
      prisma.invoice.findMany({ where: { organizationId: org.id }, orderBy: { issuedAt: 'desc' } }),
      billingOverview(org.id),
      invoicePreviewForOrg(org.modules),
    ]);
    res.json({
      subscription: subscription ? toSubscription(subscription) : null,
      invoices: invoices.map(toInvoice),
      overview,
      preview,
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to load billing', error: (err as Error).message });
  }
};

export const upsertOrgSubscription = async (req: Request, res: Response) => {
  try {
    const org = await prisma.organization.findUnique({ where: { id: req.params.id } });
    if (!org) return res.status(404).json({ message: 'Organisation not found' });

    const plan = req.body.planId
      ? await prisma.plan.findUnique({ where: { id: String(req.body.planId) } })
      : null;
    const interval = String(req.body.interval || plan?.interval || 'month');
    const amountCents = Number(req.body.amountCents ?? plan?.amountCents);
    if (!Number.isFinite(amountCents) || amountCents < 0) {
      return res.status(400).json({ message: 'A valid subscription amount is required.' });
    }
    const startedAt = req.body.startedAt ? new Date(req.body.startedAt) : new Date();
    const periodStart = req.body.currentPeriodStart ? new Date(req.body.currentPeriodStart) : startedAt;
    const periodEnd = req.body.currentPeriodEnd ? new Date(req.body.currentPeriodEnd) : addPeriod(periodStart, interval);
    const status = ['trialing', 'active', 'past_due', 'canceled'].includes(req.body.status)
      ? req.body.status
      : 'active';

    const existing = await prisma.subscription.findFirst({
      where: { organizationId: org.id },
      orderBy: { createdAt: 'desc' },
    });

    const data = {
      planId: plan?.id || null,
      status,
      amountCents,
      currency: String(req.body.currency || plan?.currency || 'USD'),
      interval,
      startedAt,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      canceledAt: status === 'canceled' ? new Date() : null,
      notes: String(req.body.notes || '').trim(),
    };

    const saved = existing
      ? await prisma.subscription.update({ where: { id: existing.id }, data, include: { plan: true } })
      : await prisma.subscription.create({
          data: { ...data, organizationId: org.id },
          include: { plan: true },
        });
    await bustOrgCache();
    res.json(toSubscription(saved));
  } catch (err) {
    res.status(400).json({ message: 'Could not save subscription', error: (err as Error).message });
  }
};

export const createOrgInvoice = async (req: Request, res: Response) => {
  try {
    const org = await prisma.organization.findUnique({ where: { id: req.params.id } });
    if (!org) return res.status(404).json({ message: 'Organisation not found' });
    const amountCents = Number(req.body.amountCents);
    if (!Number.isFinite(amountCents) || amountCents <= 0) {
      return res.status(400).json({ message: 'Invoice amount is required.' });
    }
    const status = ['draft', 'open', 'paid', 'void'].includes(req.body.status) ? req.body.status : 'open';
    const subscription = await prisma.subscription.findFirst({
      where: { organizationId: org.id },
      orderBy: { createdAt: 'desc' },
    });
    const issuedAt = req.body.issuedAt ? new Date(req.body.issuedAt) : new Date();
    const paidAt = status === 'paid' ? (req.body.paidAt ? new Date(req.body.paidAt) : issuedAt) : null;
    const item = await prisma.invoice.create({
      data: {
        organizationId: org.id,
        subscriptionId: subscription?.id || null,
        number: await nextInvoiceNumber(),
        amountCents,
        currency: String(req.body.currency || subscription?.currency || 'USD'),
        status,
        issuedAt,
        paidAt,
        dueAt: req.body.dueAt ? new Date(req.body.dueAt) : null,
        periodStart: req.body.periodStart ? new Date(req.body.periodStart) : null,
        periodEnd: req.body.periodEnd ? new Date(req.body.periodEnd) : null,
        method: String(req.body.method || 'bank').trim() || 'bank',
        notes: String(req.body.notes || '').trim(),
        lineItems: Array.isArray(req.body.lineItems) ? req.body.lineItems : [],
      },
    });
    await bustOrgCache();
    res.status(201).json(toInvoice(item));
  } catch (err) {
    if (isUniqueError(err)) return res.status(409).json({ message: 'That invoice number is already in use.' });
    res.status(400).json({ message: 'Could not create invoice', error: (err as Error).message });
  }
};

export const updateOrgInvoice = async (req: Request, res: Response) => {
  try {
    const item = await prisma.invoice.findFirst({
      where: { id: req.params.invoiceId, organizationId: req.params.id },
    });
    if (!item) return res.status(404).json({ message: 'Invoice not found' });
    const status = ['draft', 'open', 'paid', 'void'].includes(req.body.status) ? req.body.status : undefined;
    const updated = await prisma.invoice.update({
      where: { id: item.id },
      data: {
        status,
        paidAt:
          status === 'paid'
            ? req.body.paidAt
              ? new Date(req.body.paidAt)
              : item.paidAt || new Date()
            : status
              ? null
              : undefined,
        method: req.body.method != null ? String(req.body.method).trim() : undefined,
        notes: req.body.notes != null ? String(req.body.notes).trim() : undefined,
      },
    });
    await bustOrgCache();
    res.json(toInvoice(updated));
  } catch (err) {
    res.status(400).json({ message: 'Could not update invoice', error: (err as Error).message });
  }
};

export const generateOrgInvoice = async (req: Request, res: Response) => {
  try {
    const org = await prisma.organization.findUnique({ where: { id: req.params.id } });
    if (!org) return res.status(404).json({ message: 'Organisation not found' });
    const preview = await invoicePreviewForOrg(org.modules);
    if (!preview.quantity) {
      return res.status(400).json({ message: 'Enable at least one module before generating an invoice.' });
    }
    const status = ['draft', 'open', 'paid'].includes(req.body.status) ? req.body.status : 'open';
    const issuedAt = new Date();
    const subscription = await prisma.subscription.findFirst({
      where: { organizationId: org.id },
      orderBy: { createdAt: 'desc' },
    });
    const item = await prisma.invoice.create({
      data: {
        organizationId: org.id,
        subscriptionId: subscription?.id || null,
        number: await nextInvoiceNumber(),
        amountCents: preview.amountCents,
        currency: preview.currency,
        status,
        issuedAt,
        paidAt: status === 'paid' ? issuedAt : null,
        dueAt: new Date(issuedAt.getTime() + 14 * 24 * 60 * 60 * 1000),
        method: String(req.body.method || 'invoice').trim() || 'invoice',
        notes: String(req.body.notes || `${preview.quantity} module${preview.quantity === 1 ? '' : 's'} × $5`).trim(),
        lineItems: preview.lines as unknown as Prisma.InputJsonValue,
      },
    });
    await bustOrgCache();
    res.status(201).json({ invoice: toInvoice(item), preview });
  } catch (err) {
    if (isUniqueError(err)) return res.status(409).json({ message: 'That invoice number is already in use.' });
    res.status(400).json({ message: 'Could not generate invoice', error: (err as Error).message });
  }
};

