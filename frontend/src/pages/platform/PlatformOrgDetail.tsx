import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api from '../../api/client';
import { signOutPlatform } from '../../auth/platformSession';
import { SUPER_BASE, ORG_ADMIN_BASE } from '../../admin/paths';
import ChangePasswordForm from '../../components/ChangePasswordForm';
import ThemeStudio from './ThemeStudio';
import { DEFAULT_THEME, normalizeTheme } from '../../theme/catalog';
import { deptEnabled } from './catalog';
import { BarChart } from './BarChart';
import { formatDate, formatMoney } from './money';
import { Banner, Drawer, GateSwitch, PageHead, Pulse, Stat, Toast } from './ui';

const labelClass = 'flex flex-col gap-1.5 text-sm font-semibold text-ink';
const emptyAdmin = { name: '', email: '', password: '' };

export default function PlatformOrgDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [org, setOrg] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [form, setForm] = useState(null);
  const [adminForm, setAdminForm] = useState(emptyAdmin);
  const [passwordAdmin, setPasswordAdmin] = useState(null);
  const [saving, setSaving] = useState(false);
  const [busySlug, setBusySlug] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [billing, setBilling] = useState({ subscription: null, invoices: [], overview: null, preview: null });
  const [plans, setPlans] = useState([]);
  const [subForm, setSubForm] = useState({ planId: '', status: 'active', amountCents: 34900, interval: 'month', notes: '' });
  const [invoiceForm, setInvoiceForm] = useState({ amountCents: 34900, status: 'paid', method: 'bank', notes: '' });
  const [subOpen, setSubOpen] = useState(false);
  const [invoiceOpen, setInvoiceOpen] = useState(false);

  const kickOut = () => {
    signOutPlatform();
    navigate(SUPER_BASE, { replace: true });
  };

  const load = async () => {
    try {
      const [orgRes, catRes, billRes, planRes] = await Promise.all([
        api.get(`/platform/organizations/${id}`, { authScope: 'platform' }),
        api.get('/platform/catalog', { authScope: 'platform' }),
        api.get(`/platform/organizations/${id}/billing`, { authScope: 'platform' }),
        api.get('/platform/plans', { authScope: 'platform' }),
      ]);
      setOrg(orgRes.data);
      setForm({
        kind: orgRes.data.kind || 'education',
        name: orgRes.data.name,
        slug: orgRes.data.slug,
        email: orgRes.data.email || '',
        phone: orgRes.data.phone || '',
        status: orgRes.data.status,
        isPublic: Boolean(orgRes.data.isPublic),
        suspendOnOverdue: Boolean(orgRes.data.suspendOnOverdue),
        notes: orgRes.data.notes || '',
        departments: orgRes.data.departments || [],
        modules: orgRes.data.modules || [],
        theme: normalizeTheme(orgRes.data.theme),
      });
      setDepartments(Array.isArray(catRes.data?.departments) ? catRes.data.departments : []);
      setBilling({
        subscription: billRes.data?.subscription || null,
        invoices: Array.isArray(billRes.data?.invoices) ? billRes.data.invoices : [],
        overview: billRes.data?.overview || null,
        preview: billRes.data?.preview || null,
      });
      setPlans(Array.isArray(planRes.data) ? planRes.data : []);
      const sub = billRes.data?.subscription;
      if (sub) {
        setSubForm({
          planId: sub.planId || '',
          status: sub.status || 'active',
          amountCents: sub.amountCents,
          interval: sub.interval || 'month',
          notes: sub.notes || '',
        });
        setInvoiceForm((f) => ({ ...f, amountCents: sub.amountCents }));
      }
      setError('');
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) return kickOut();
      setError(err.response?.data?.message || 'Could not load tenant.');
    }
  };

  useEffect(() => {
    load();
  }, [id]);

  const persistLock = async (patch, noticeText) => {
    setBusySlug('lock');
    try {
      const res = await api.put(`/platform/organizations/${id}`, patch, { authScope: 'platform' });
      setNotice(noticeText);
      setOrg((current) => (current ? { ...current, ...res.data } : current));
      setForm((f) => ({
        ...f,
        status: res.data.status,
        suspendOnOverdue: Boolean(res.data.suspendOnOverdue),
      }));
    } catch (err) {
      setNotice(err.response?.data?.message || 'Could not update service lock.');
    } finally {
      setBusySlug('');
    }
  };

  const persistEntitlements = async ({ departments: nextDepartments, modules: nextModules }, noticeText) => {
    const previous = { departments: form.departments, modules: form.modules };
    setForm((f) => ({ ...f, departments: nextDepartments, modules: nextModules }));
    try {
      const res = await api.put(
        `/platform/organizations/${id}`,
        { departments: nextDepartments, modules: nextModules },
        { authScope: 'platform' }
      );
      setNotice(noticeText);
      setOrg((current) =>
        current ? { ...current, departments: res.data.departments, modules: res.data.modules } : current
      );
      setForm((f) => ({ ...f, departments: res.data.departments, modules: res.data.modules }));
    } catch (err) {
      setForm((f) => ({ ...f, ...previous }));
      setNotice(err.response?.data?.message || 'Could not update entitlements.');
    } finally {
      setBusySlug('');
    }
  };

  const setDepartmentLive = (dept, enabled) => {
    setBusySlug(dept.slug);
    const currentDepts = form.departments?.length
      ? form.departments
      : departments.filter((item) => deptEnabled({ ...form, ...org }, item)).map((item) => item.slug);
    const nextDepartments = enabled
      ? [...new Set([...currentDepts, dept.slug])]
      : currentDepts.filter((slug) => slug !== dept.slug);
    const deptSlugs = new Set((dept.modules || []).map((item) => item.slug));
    const nextModules = enabled
      ? form.modules
      : (form.modules || []).filter((slug) => !deptSlugs.has(slug));
    persistEntitlements(
      { departments: nextDepartments, modules: nextModules },
      enabled ? `${dept.name} is enabled. Turn on the modules this campus should receive.` : `${dept.name} disabled for this tenant.`
    );
  };

  const setModuleLive = (dept, item, enabled) => {
    setBusySlug(item.slug);
    const nextModules = enabled
      ? [...new Set([...(form.modules || []), item.slug])]
      : (form.modules || []).filter((slug) => slug !== item.slug);
    const nextDepartments = enabled
      ? [...new Set([...(form.departments || []), dept.slug])]
      : form.departments;
    persistEntitlements(
      { departments: nextDepartments, modules: nextModules },
      enabled ? `${item.name} is live for this campus.` : `${item.name} turned off for this campus.`
    );
  };

  const saveSubscription = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put(`/platform/organizations/${id}/subscription`, subForm, { authScope: 'platform' });
      setNotice('Subscription saved.');
      setSubOpen(false);
      await load();
    } catch (err) {
      setNotice(err.response?.data?.message || 'Could not save subscription.');
    } finally {
      setSaving(false);
    }
  };

  const saveInvoice = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post(`/platform/organizations/${id}/invoices`, invoiceForm, { authScope: 'platform' });
      setNotice('Payment recorded.');
      setInvoiceOpen(false);
      await load();
    } catch (err) {
      setNotice(err.response?.data?.message || 'Could not record payment.');
    } finally {
      setSaving(false);
    }
  };

  const generateInvoice = async (status = 'open') => {
    setSaving(true);
    try {
      const res = await api.post(`/platform/organizations/${id}/invoices/generate`, { status }, { authScope: 'platform' });
      setNotice(`Invoice ${res.data?.invoice?.number || ''} generated at $5 per module.`);
      await load();
    } catch (err) {
      setNotice(err.response?.data?.message || 'Could not generate invoice.');
    } finally {
      setSaving(false);
    }
  };

  const markInvoice = async (invoice, status) => {
    try {
      await api.put(
        `/platform/organizations/${id}/invoices/${invoice.id}`,
        { status },
        { authScope: 'platform' }
      );
      setNotice(status === 'paid' ? `${invoice.number} marked paid.` : `${invoice.number} updated.`);
      await load();
    } catch (err) {
      setNotice(err.response?.data?.message || 'Could not update invoice.');
    }
  };

  const saveOrg = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put(
        `/platform/organizations/${id}`,
        {
          name: form.name,
          slug: form.slug,
          email: form.email,
          phone: form.phone,
          status: form.status,
          kind: form.kind,
          isPublic: form.isPublic,
          suspendOnOverdue: form.suspendOnOverdue,
          notes: form.notes,
          theme: form.theme,
        },
        { authScope: 'platform' }
      );
      setNotice('Tenant profile saved.');
      await load();
    } catch (err) {
      setNotice(err.response?.data?.message || 'Could not save tenant.');
    } finally {
      setSaving(false);
    }
  };

  const createAdmin = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post(`/platform/organizations/${id}/admins`, adminForm, { authScope: 'platform' });
      setNotice(`Org admin created. They sign in at ${ORG_ADMIN_BASE}.`);
      setAdminForm(emptyAdmin);
      await load();
    } catch (err) {
      setNotice(err.response?.data?.message || 'Could not create admin.');
    } finally {
      setSaving(false);
    }
  };

  const setBlocked = async (admin, blocked) => {
    try {
      await api.put(
        `/platform/organizations/${id}/admins/${admin.id}/block`,
        { blocked },
        { authScope: 'platform' }
      );
      setNotice(blocked ? `${admin.name} is blocked.` : `${admin.name} can sign in again.`);
      await load();
    } catch (err) {
      setNotice(err.response?.data?.message || 'Could not update admin.');
    }
  };

  if (error) {
    return (
      <div>
        <Banner>{error}</Banner>
        <Link to={`${SUPER_BASE}/organizations`} className="text-sm font-semibold text-[var(--pc-accent)]">
          Back to tenants
        </Link>
      </div>
    );
  }

  if (!org || !form) {
    return <div className="pc-panel p-10 text-center">Loading tenant…</div>;
  }

  return (
    <div>
      <Link to={`${SUPER_BASE}/organizations`} className="text-sm font-semibold text-[var(--pc-accent)]">
        ← Organisations
      </Link>
      <PageHead
        kicker="Tenant"
        title={org.name}
        hint={`Org admin ${ORG_ADMIN_BASE} · faculty /faculty-portal · students /admissions. Enable a department, then pick which modules this campus pays for.`}
        actions={
          <span className="inline-flex items-center gap-2 rounded-[10px] border border-[var(--pc-line)] px-3 py-2 text-sm font-semibold text-[var(--pc-text)]">
            <Pulse on={org.status === 'active' && !org.servicesLocked} tone={org.status === 'active' && !org.servicesLocked ? 'live' : 'warn'} />
            {org.servicesLocked ? 'locked' : org.status} · {org.kind || 'education'} · {org.slug}
          </span>
        }
      />

      {(org.logo || org.title) && (
        <section className="pc-panel mb-6 flex items-center gap-4 p-5">
          {org.logo ? (
            <img src={org.logo} alt="" width="48" height="48" className="rounded-full object-cover" />
          ) : null}
          <div>
            <p className="m-0 text-sm font-semibold text-[var(--pc-text)]">{org.title || org.name}</p>
            {org.tagline ? <p className="m-0 text-xs text-[var(--pc-muted)]">{org.tagline}</p> : null}
            <p className="m-0 text-xs text-[var(--pc-muted)]">Logo and title are edited by the organisation admin on Brand.</p>
          </div>
        </section>
      )}

      <section className="pc-panel mb-6 p-5 md:p-6">
        <h2 className="mt-0">Service lock</h2>
        <p className="pc-hint mb-4">
          Suspend organisation admin, faculty, and student portals. They can still sign in, then see that services are paused.
        </p>
        <div className="grid gap-3">
          <div className="flex items-center justify-between rounded-[12px] border border-[var(--pc-line)] px-4 py-3">
            <div>
              <p className="m-0 text-sm font-semibold text-[var(--pc-text)]">Suspend services now</p>
              <p className="m-0 text-xs text-[var(--pc-muted)]">Locks the campus immediately, including faculty and students.</p>
            </div>
            <GateSwitch
              on={form.status === 'suspended'}
              busy={busySlug === 'lock'}
              liveLabel="Locked"
              offLabel="Open"
              onChange={(locked) =>
                persistLock(
                  { status: locked ? 'suspended' : 'active' },
                  locked ? 'Campus services are suspended.' : 'Campus services are open again.'
                )
              }
            />
          </div>
          <div className="flex items-center justify-between rounded-[12px] border border-[var(--pc-line)] px-4 py-3">
            <div>
              <p className="m-0 text-sm font-semibold text-[var(--pc-text)]">Lock when dues are overdue</p>
              <p className="m-0 text-xs text-[var(--pc-muted)]">
                If an invoice is past due, the same lock applies automatically until it is paid.
                {org.overdue ? ' This campus currently has overdue dues.' : ''}
              </p>
            </div>
            <GateSwitch
              on={Boolean(form.suspendOnOverdue)}
              busy={busySlug === 'lock'}
              liveLabel="On"
              offLabel="Off"
              onChange={(suspendOnOverdue) =>
                persistLock(
                  { suspendOnOverdue },
                  suspendOnOverdue ? 'Overdue invoices will suspend this campus.' : 'Overdue invoices will not auto-lock this campus.'
                )
              }
            />
          </div>
        </div>
      </section>

      <section className="mb-6">
        <h2>Departments</h2>
        <p className="pc-hint mb-4">
          Enable the department first, then click modules to turn them on or off. A department can have many modules while this campus only uses two.
        </p>
        <div className="grid gap-4">
          {departments.map((dept) => {
            const entitled = deptEnabled({ ...org, ...form }, dept);
            const globallyOff = dept.active === false;
            const liveModules = (dept.modules || []).filter((item) => item.active);
            const onCount = liveModules.filter((item) => (form.modules || []).includes(item.slug)).length;
            return (
              <section key={dept.slug} className={`pc-dept ${entitled ? 'is-live' : 'is-off'}`}>
                <div className="pc-dept-head">
                  <div className="pc-dept-meta">
                    <p className="pc-kicker mb-1">{dept.slug}</p>
                    <h3 className="mb-1">{dept.name}</h3>
                    <p className="m-0 text-sm">
                      {globallyOff
                        ? 'Hidden from catalog — publish it under Catalog before assigning.'
                        : dept.description || 'Product department'}{' '}
                      · {onCount}/{liveModules.length} modules live
                    </p>
                  </div>
                  <div className="pc-dept-actions">
                    <span className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--pc-text)]">
                      <Pulse on={entitled} tone={entitled ? 'live' : 'warn'} />
                      {entitled ? 'Enabled' : 'Off'}
                    </span>
                    <button
                      type="button"
                      className={`btn py-2 text-sm ${entitled ? 'btn-outline' : 'btn-primary'}`}
                      disabled={(globallyOff && !entitled) || busySlug === dept.slug}
                      onClick={() => setDepartmentLive(dept, !entitled)}
                    >
                      {busySlug === dept.slug
                        ? 'Updating…'
                        : entitled
                          ? 'Disable department'
                          : 'Enable department'}
                    </button>
                  </div>
                </div>
                <div className="pc-chip-row">
                  {(dept.modules || []).length ? (
                    (dept.modules || []).map((item) => {
                      const on = (form.modules || []).includes(item.slug);
                      return (
                        <button
                          key={item.slug}
                          type="button"
                          className={`pc-chip ${on ? 'is-on' : ''} ${!item.active ? 'is-muted' : ''}`}
                          disabled={!item.active || busySlug === item.slug}
                          onClick={() => setModuleLive(dept, item, !on)}
                        >
                          {item.name}
                          {on ? ' · on' : ' · off'}
                        </button>
                      );
                    })
                  ) : (
                    <span className="text-sm text-[var(--pc-muted)]">No modules in this department</span>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </section>

      <section className="mb-6">
        <div className="pc-head mb-4">
          <div>
            <h2>Subscription & payments</h2>
            <p className="pc-hint">
              Current plan, collected revenue, and invoice history. New invoices are $5 for each enabled module
            {billing.preview?.quantity
              ? ` · ${billing.preview.quantity} × $5 = ${formatMoney(billing.preview.amountCents, billing.preview.currency)}`
              : ''}
            .
            </p>
          </div>
          <div className="pc-head-actions">
            <button type="button" className="btn btn-outline py-2 text-sm" onClick={() => setSubOpen(true)}>
              {billing.subscription ? 'Edit subscription' : 'Start subscription'}
            </button>
            <button
              type="button"
              className="btn btn-outline py-2 text-sm"
              disabled={saving || !billing.preview?.quantity}
              onClick={() => generateInvoice('open')}
            >
              Generate invoice
            </button>
            <button type="button" className="btn btn-primary py-2 text-sm" onClick={() => setInvoiceOpen(true)}>
              Record payment
            </button>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 mb-4">
          <Stat
            label="Plan"
            value={billing.subscription?.plan?.name || billing.subscription?.status || 'None'}
            hint={
              billing.subscription
                ? `${formatMoney(billing.subscription.amountCents, billing.subscription.currency)} / ${billing.subscription.interval}`
                : 'No subscription yet'
            }
          />
          <Stat
            label="Collected"
            value={formatMoney(billing.overview?.totalPaidCents, billing.overview?.currency)}
            hint="All paid invoices"
          />
          <Stat
            label="This month"
            value={formatMoney(billing.overview?.monthPaidCents, billing.overview?.currency)}
          />
          <Stat
            label="Outstanding"
            value={formatMoney(billing.overview?.outstandingCents, billing.overview?.currency)}
            tone={billing.overview?.outstandingCents ? 'warn' : undefined}
          />
        </div>
        <div className="pc-panel p-5 md:p-6 mb-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="m-0">Payment history</h2>
            <p className="pc-legend m-0">
              <span><i style={{ background: 'var(--pc-live)' }} />Paid</span>
              <span><i style={{ background: '#6d93ff' }} />Outstanding</span>
            </p>
          </div>
          <BarChart data={billing.overview?.monthly || []} />
        </div>
        <div className="pc-table-wrap">
          <table className="pc-table">
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Issued</th>
                <th>Amount</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {(billing.invoices || []).length ? (
                billing.invoices.map((invoice) => (
                  <tr key={invoice.id}>
                    <td>
                      <strong>{invoice.number}</strong>
                      <div className="font-mono text-[0.68rem] text-[var(--pc-muted)]">
                        {invoice.lineItems?.length
                          ? `${invoice.lineItems.length} module${invoice.lineItems.length === 1 ? '' : 's'} × $5`
                          : invoice.method}
                      </div>
                    </td>
                    <td>{formatDate(invoice.issuedAt)}</td>
                    <td>{formatMoney(invoice.amountCents, invoice.currency)}</td>
                    <td>
                      <span className={`tag ${invoice.status === 'paid' ? 'tag-allied' : 'tag-nursing'}`}>
                        {invoice.status}
                      </span>
                    </td>
                    <td>
                      {invoice.status !== 'paid' && (
                        <button type="button" className="btn btn-outline py-1.5 text-xs" onClick={() => markInvoice(invoice, 'paid')}>
                          Mark paid
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="text-[var(--pc-muted)]">
                    No invoices yet. Record a payment to start the history.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <form onSubmit={saveOrg} className="pc-panel mb-6 flex flex-col gap-4 p-6">
        <h2>Identity</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <label className={labelClass}>
            Name
            <input className="field" required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </label>
          <label className={labelClass}>
            Slug
            <input className="field" required value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))} />
          </label>
          <label className={labelClass}>
            Email
            <input type="email" className="field" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
          </label>
          <label className={labelClass}>
            Status
            <select className="field" value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
            </select>
          </label>
          <label className={labelClass}>
            Organisation type
            <select className="field" value={form.kind} onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value }))}>
              <option value="education">Education institute</option>
              <option value="hospital">Hospital</option>
            </select>
            <span className="font-medium text-[var(--pc-muted)]">
              Changing type updates labels and default roles. It does not rebuild departments already created.
            </span>
          </label>
        </div>
        <div className="flex items-center justify-between rounded-[12px] border border-[var(--pc-line)] px-4 py-3">
          <div>
            <p className="m-0 text-sm font-semibold text-[var(--pc-text)]">Public website tenant</p>
            <p className="m-0 text-xs text-[var(--pc-muted)]">This organisation serves the public campus site</p>
          </div>
          <GateSwitch
            on={form.isPublic}
            onChange={(isPublic) => setForm((f) => ({ ...f, isPublic }))}
            liveLabel="Yes"
            offLabel="No"
          />
        </div>
        <div className="pc-studio">
          <ThemeStudio theme={form.theme || DEFAULT_THEME} onChange={(theme) => setForm((f) => ({ ...f, theme }))} />
        </div>
        <button type="submit" className="btn btn-primary self-start" disabled={saving}>
          {saving ? 'Saving…' : 'Save tenant profile'}
        </button>
      </form>

      <section className="mb-8">
        <h2>Organisation admins</h2>
        <p className="pc-hint mb-4">These accounts sign in at {ORG_ADMIN_BASE}. Superuser creates them here.</p>
        <div className="grid gap-3">
          {(org.admins || []).map((admin) => (
            <article key={admin.id} className="pc-panel p-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="tag tag-allied">Admin</span>
                    {admin.blocked && <span className="tag tag-nursing">Blocked</span>}
                  </div>
                  <h3 className="mt-2 mb-0">{admin.name}</h3>
                  <p className="m-0 text-sm">{admin.email}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="btn btn-outline py-2.5 text-sm" onClick={() => setPasswordAdmin(admin)}>
                    Change password
                  </button>
                  <button
                    type="button"
                    className={`btn py-2.5 text-sm ${admin.blocked ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => setBlocked(admin, !admin.blocked)}
                  >
                    {admin.blocked ? 'Unblock' : 'Block'}
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
        <form onSubmit={createAdmin} className="pc-panel mt-4 grid gap-3 p-6 md:grid-cols-3">
          <input className="field" required placeholder="Full name" value={adminForm.name} onChange={(e) => setAdminForm((f) => ({ ...f, name: e.target.value }))} />
          <input className="field" type="email" required placeholder="Email" value={adminForm.email} onChange={(e) => setAdminForm((f) => ({ ...f, email: e.target.value }))} />
          <input className="field" type="password" required minLength={6} placeholder="Password" value={adminForm.password} onChange={(e) => setAdminForm((f) => ({ ...f, password: e.target.value }))} />
          <button type="submit" className="btn btn-primary md:col-span-3" disabled={saving}>
            Create organisation admin
          </button>
        </form>
      </section>

      <Toast>{notice}</Toast>

      <Drawer
        open={Boolean(passwordAdmin)}
        onClose={() => setPasswordAdmin(null)}
        kicker="Access"
        title="Set admin password"
        widthClass="max-w-3xl"
      >
        {passwordAdmin && (
          <>
            <ChangePasswordForm
              requireCurrent={false}
              accountName={passwordAdmin.name}
              accountEmail={passwordAdmin.email}
              submitLabel="Set password"
              onSubmit={async ({ newPassword }) => {
                const res = await api.put(
                  `/platform/organizations/${id}/admins/${passwordAdmin.id}/password`,
                  { newPassword },
                  { authScope: 'platform' }
                );
                setNotice(res.data?.message || 'Password updated.');
                return res.data?.message || 'Password updated.';
              }}
              onAuthError={kickOut}
            />
            <button type="button" className="btn btn-outline mt-6" onClick={() => setPasswordAdmin(null)}>
              Close
            </button>
          </>
        )}
      </Drawer>

      <Drawer open={subOpen} onClose={() => setSubOpen(false)} kicker="Billing" title="Subscription">
        <form onSubmit={saveSubscription} className="flex flex-col gap-4">
          <label className={labelClass}>
            Plan
            <select
              className="field"
              value={subForm.planId}
              onChange={(e) => {
                const plan = plans.find((item) => item.id === e.target.value);
                setSubForm((f) => ({
                  ...f,
                  planId: e.target.value,
                  amountCents: plan ? plan.amountCents : f.amountCents,
                  interval: plan ? plan.interval : f.interval,
                }));
              }}
            >
              <option value="">Custom amount</option>
              {plans.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.name} · {formatMoney(plan.amountCents, plan.currency)} / {plan.interval}
                </option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            Amount (USD)
            <input
              className="field"
              type="number"
              min="0"
              step="1"
              value={Math.round(subForm.amountCents / 100)}
              onChange={(e) => setSubForm((f) => ({ ...f, amountCents: Math.round(Number(e.target.value || 0) * 100) }))}
            />
          </label>
          <label className={labelClass}>
            Status
            <select className="field" value={subForm.status} onChange={(e) => setSubForm((f) => ({ ...f, status: e.target.value }))}>
              <option value="trialing">Trialing</option>
              <option value="active">Active</option>
              <option value="past_due">Past due</option>
              <option value="canceled">Canceled</option>
            </select>
          </label>
          <label className={labelClass}>
            Interval
            <select className="field" value={subForm.interval} onChange={(e) => setSubForm((f) => ({ ...f, interval: e.target.value }))}>
              <option value="month">Monthly</option>
              <option value="year">Yearly</option>
            </select>
          </label>
          <label className={labelClass}>
            Notes
            <textarea className="field min-h-20" value={subForm.notes} onChange={(e) => setSubForm((f) => ({ ...f, notes: e.target.value }))} />
          </label>
          <div className="flex gap-2">
            <button type="submit" className="btn btn-primary flex-1" disabled={saving}>
              {saving ? 'Saving…' : 'Save subscription'}
            </button>
            <button type="button" className="btn btn-outline flex-1" onClick={() => setSubOpen(false)}>
              Cancel
            </button>
          </div>
        </form>
      </Drawer>

      <Drawer open={invoiceOpen} onClose={() => setInvoiceOpen(false)} kicker="Billing" title="Record payment">
        <form onSubmit={saveInvoice} className="flex flex-col gap-4">
          <label className={labelClass}>
            Amount (USD)
            <input
              className="field"
              type="number"
              min="1"
              step="1"
              value={Math.round(invoiceForm.amountCents / 100)}
              onChange={(e) => setInvoiceForm((f) => ({ ...f, amountCents: Math.round(Number(e.target.value || 0) * 100) }))}
            />
          </label>
          <label className={labelClass}>
            Status
            <select className="field" value={invoiceForm.status} onChange={(e) => setInvoiceForm((f) => ({ ...f, status: e.target.value }))}>
              <option value="paid">Paid</option>
              <option value="open">Open / due</option>
              <option value="draft">Draft</option>
            </select>
          </label>
          <label className={labelClass}>
            Method
            <select className="field" value={invoiceForm.method} onChange={(e) => setInvoiceForm((f) => ({ ...f, method: e.target.value }))}>
              <option value="bank">Bank transfer</option>
              <option value="card">Card</option>
              <option value="cash">Cash</option>
              <option value="other">Other</option>
            </select>
          </label>
          <label className={labelClass}>
            Notes
            <textarea className="field min-h-20" value={invoiceForm.notes} onChange={(e) => setInvoiceForm((f) => ({ ...f, notes: e.target.value }))} />
          </label>
          <div className="flex gap-2">
            <button type="submit" className="btn btn-primary flex-1" disabled={saving}>
              {saving ? 'Saving…' : 'Save invoice'}
            </button>
            <button type="button" className="btn btn-outline flex-1" onClick={() => setInvoiceOpen(false)}>
              Cancel
            </button>
          </div>
        </form>
      </Drawer>
    </div>
  );
}
