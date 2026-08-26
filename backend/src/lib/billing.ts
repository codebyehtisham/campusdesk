import type { Invoice, Plan, Prisma, Subscription } from '@prisma/client';
import { prisma } from '../config/db.js';
import { sellableModules } from './tenant.js';

export const MODULE_FEE_CENTS = 500;

export const DEFAULT_PLANS = [
  {
    slug: 'starter',
    name: 'Starter',
    description: 'One department and core modules for a single campus.',
    amountCents: 14900,
    interval: 'month',
    sortOrder: 1,
  },
  {
    slug: 'campus',
    name: 'Campus',
    description: 'Multiple departments with selected modules.',
    amountCents: 34900,
    interval: 'month',
    sortOrder: 2,
  },
  {
    slug: 'enterprise',
    name: 'Enterprise',
    description: 'Full catalog, priority support, and custom billing.',
    amountCents: 79900,
    interval: 'month',
    sortOrder: 3,
  },
];

export const toPlan = (doc: Plan) => ({
  id: doc.id,
  slug: doc.slug,
  name: doc.name,
  description: doc.description,
  amountCents: doc.amountCents,
  currency: doc.currency,
  interval: doc.interval,
  active: doc.active,
  sortOrder: doc.sortOrder,
});

export const toSubscription = (doc: Subscription & { plan?: Plan | null }) => ({
  id: doc.id,
  organizationId: doc.organizationId,
  planId: doc.planId,
  plan: doc.plan ? toPlan(doc.plan) : null,
  status: doc.status,
  amountCents: doc.amountCents,
  currency: doc.currency,
  interval: doc.interval,
  startedAt: doc.startedAt,
  currentPeriodStart: doc.currentPeriodStart,
  currentPeriodEnd: doc.currentPeriodEnd,
  canceledAt: doc.canceledAt,
  notes: doc.notes,
});

export const toInvoice = (doc: Invoice) => ({
  id: doc.id,
  organizationId: doc.organizationId,
  subscriptionId: doc.subscriptionId,
  number: doc.number,
  amountCents: doc.amountCents,
  currency: doc.currency,
  status: doc.status,
  issuedAt: doc.issuedAt,
  paidAt: doc.paidAt,
  dueAt: doc.dueAt,
  periodStart: doc.periodStart,
  periodEnd: doc.periodEnd,
  method: doc.method,
  notes: doc.notes,
  lineItems: Array.isArray(doc.lineItems) ? doc.lineItems : [],
  createdAt: doc.createdAt,
});

export const nextInvoiceNumber = async () => {
  const year = new Date().getFullYear();
  const prefix = `INV-${year}-`;
  const last = await prisma.invoice.findFirst({
    where: { number: { startsWith: prefix } },
    orderBy: { number: 'desc' },
    select: { number: true },
  });
  const seq = last ? Number(last.number.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(seq).padStart(4, '0')}`;
};

export const monthKey = (date: Date) =>
  `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;

export const lastMonths = (count = 12) => {
  const now = new Date();
  const months: { key: string; label: string; start: Date; end: Date }[] = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
    months.push({
      key: monthKey(start),
      label: start.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' }),
      start,
      end,
    });
  }
  return months;
};

export const billingOverview = async (organizationId?: string) => {
  const where: Prisma.InvoiceWhereInput = organizationId ? { organizationId } : {};
  const months = lastMonths(12);
  const rangeStart = months[0].start;
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  const [paid, monthPaid, outstanding, activeSubs, pastDue, invoices, subscriptions] = await Promise.all([
    prisma.invoice.aggregate({ where: { ...where, status: 'paid' }, _sum: { amountCents: true } }),
    prisma.invoice.aggregate({
      where: { ...where, status: 'paid', paidAt: { gte: monthStart } },
      _sum: { amountCents: true },
    }),
    prisma.invoice.aggregate({ where: { ...where, status: { in: ['open', 'draft'] } }, _sum: { amountCents: true } }),
    prisma.subscription.count({ where: { ...(organizationId ? { organizationId } : {}), status: 'active' } }),
    prisma.subscription.count({ where: { ...(organizationId ? { organizationId } : {}), status: 'past_due' } }),
    prisma.invoice.findMany({
      where: { ...where, OR: [{ paidAt: { gte: rangeStart } }, { issuedAt: { gte: rangeStart } }] },
      select: { amountCents: true, status: true, paidAt: true, issuedAt: true },
    }),
    prisma.subscription.findMany({
      where: { ...(organizationId ? { organizationId } : {}), status: 'active' },
      select: { amountCents: true, interval: true },
    }),
  ]);

  const monthly = months.map((month) => {
    const paidCents = invoices
      .filter((item) => item.status === 'paid' && item.paidAt && item.paidAt >= month.start && item.paidAt < month.end)
      .reduce((sum, item) => sum + item.amountCents, 0);
    const outstandingCents = invoices
      .filter((item) => item.status !== 'paid' && item.issuedAt >= month.start && item.issuedAt < month.end)
      .reduce((sum, item) => sum + item.amountCents, 0);
    return { month: month.key, label: month.label, paidCents, outstandingCents };
  });

  const mrrCents = subscriptions.reduce((sum, item) => {
    if (item.interval === 'year') return sum + Math.round(item.amountCents / 12);
    return sum + item.amountCents;
  }, 0);

  return {
    currency: 'USD',
    totalPaidCents: paid._sum.amountCents || 0,
    monthPaidCents: monthPaid._sum.amountCents || 0,
    outstandingCents: outstanding._sum.amountCents || 0,
    mrrCents,
    activeSubscriptions: activeSubs,
    pastDue,
    monthly,
  };
};

export type InvoiceLine = {
  slug: string;
  name: string;
  unitCents: number;
  quantity: number;
  amountCents: number;
};

export const invoicePreviewForOrg = async (modules: string[]) => {
  const slugs = sellableModules(modules);
  const catalog = slugs.length
    ? await prisma.module.findMany({ where: { slug: { in: slugs } }, select: { slug: true, name: true } })
    : [];
  const names = new Map(catalog.map((item) => [item.slug, item.name]));
  const lines: InvoiceLine[] = slugs.map((slug) => ({
    slug,
    name: names.get(slug) || slug,
    unitCents: MODULE_FEE_CENTS,
    quantity: 1,
    amountCents: MODULE_FEE_CENTS,
  }));
  return {
    unitCents: MODULE_FEE_CENTS,
    quantity: slugs.length,
    amountCents: slugs.length * MODULE_FEE_CENTS,
    currency: 'USD',
    lines,
  };
};

