import { useEffect, useState } from 'react';
import api from '../../api/client';
import { formatBytes, formatDate } from './money';
import { Drawer, GateSwitch, Toast } from './ui';

const actionLabel: Record<string, string> = {
  'tenant.provisioned': 'Provisioned',
  'tenant.suspended': 'Suspended',
  'tenant.activated': 'Activated',
  'tenant.archived': 'Archived',
  'tenant.restored': 'Restored',
  'tenant.cloned': 'Cloned',
  'feature_flag.override_set': 'Feature override',
  'feature_flag.override_cleared': 'Feature override cleared',
};

type Props = {
  orgId: string;
  status: string;
  slug: string;
  name: string;
  onChanged: () => void;
};

export function TenantLifecyclePanel({ orgId, status, slug, name, onChanged }: Props) {
  const [events, setEvents] = useState([]);
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState('');
  const [cloneOpen, setCloneOpen] = useState(false);
  const [cloneForm, setCloneForm] = useState({ name: `${name} Copy`, slug: `${slug}-copy` });

  const loadEvents = async () => {
    try {
      const res = await api.get(`/platform/organizations/${orgId}/events`, { authScope: 'platform' });
      setEvents(Array.isArray(res.data) ? res.data : []);
    } catch {
      setEvents([]);
    }
  };

  useEffect(() => {
    loadEvents();
  }, [orgId]);

  const run = async (action: string, path: string, body?: object) => {
    setBusy(action);
    try {
      await api.post(path, body || {}, { authScope: 'platform' });
      setNotice(`Tenant ${action} completed.`);
      await loadEvents();
      onChanged();
    } catch (err: any) {
      setNotice(err.response?.data?.message || `Could not ${action} tenant.`);
    } finally {
      setBusy('');
    }
  };

  const cloneTenant = async (e: { preventDefault: () => void }) => {
    e.preventDefault();
    setBusy('clone');
    try {
      const res = await api.post(
        `/platform/organizations/${orgId}/clone`,
        { name: cloneForm.name.trim(), slug: cloneForm.slug.trim() },
        { authScope: 'platform' }
      );
      setNotice(`Cloned to ${res.data.slug}.`);
      setCloneOpen(false);
      await loadEvents();
      onChanged();
    } catch (err: any) {
      setNotice(err.response?.data?.message || 'Could not clone tenant.');
    } finally {
      setBusy('');
    }
  };

  const archived = status === 'archived';

  return (
    <section className="pc-panel mb-6 p-5 md:p-6">
      <h2 className="mt-0">Tenant lifecycle</h2>
      <p className="pc-hint mb-4">Provision, suspend, archive, or clone — each action is recorded in the platform audit trail.</p>

      <div className="mb-4 flex flex-wrap gap-2">
        {!archived && status !== 'active' ? (
          <button type="button" className="btn btn-primary" disabled={!!busy} onClick={() => run('activate', `/platform/organizations/${orgId}/activate`)}>
            {busy === 'activate' ? 'Activating…' : 'Activate'}
          </button>
        ) : null}
        {!archived && status === 'active' ? (
          <button type="button" className="btn btn-outline" disabled={!!busy} onClick={() => run('suspend', `/platform/organizations/${orgId}/suspend`)}>
            {busy === 'suspend' ? 'Suspending…' : 'Suspend'}
          </button>
        ) : null}
        {!archived ? (
          <button type="button" className="btn btn-outline" disabled={!!busy} onClick={() => run('archive', `/platform/organizations/${orgId}/archive`)}>
            {busy === 'archive' ? 'Archiving…' : 'Archive'}
          </button>
        ) : (
          <button type="button" className="btn btn-primary" disabled={!!busy} onClick={() => run('activate', `/platform/organizations/${orgId}/activate`)}>
            Restore from archive
          </button>
        )}
        <button type="button" className="btn btn-outline" disabled={!!busy} onClick={() => setCloneOpen(true)}>
          Clone tenant
        </button>
      </div>

      <div className="rounded-[12px] border border-[var(--pc-line)]">
        <p className="m-0 border-b border-[var(--pc-line)] px-4 py-2 text-xs font-bold uppercase tracking-wider text-[var(--pc-muted)]">
          Lifecycle audit trail
        </p>
        <ul className="m-0 max-h-52 list-none overflow-auto p-0">
          {events.length === 0 ? (
            <li className="px-4 py-3 text-sm text-[var(--pc-muted)]">No lifecycle events yet.</li>
          ) : (
            events.map((event: any) => (
              <li key={event.id} className="border-b border-[var(--pc-line)] px-4 py-2.5 text-sm last:border-0">
                <strong className="text-[var(--pc-text)]">{actionLabel[event.action] || event.action}</strong>
                <span className="ml-2 text-xs text-[var(--pc-muted)]">
                  {formatDate(event.createdAt)} · {event.actorEmail || 'system'}
                </span>
              </li>
            ))
          )}
        </ul>
      </div>

      <Toast>{notice}</Toast>

      <Drawer open={cloneOpen} onClose={() => setCloneOpen(false)} kicker="Clone" title="Duplicate tenant shell">
        <form onSubmit={cloneTenant} className="flex flex-col gap-4">
          <p className="m-0 text-sm text-[var(--pc-muted)]">
            Copies entitlements, theme, and settings. Does not copy users or student data.
          </p>
          <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
            New name
            <input className="field" required value={cloneForm.name} onChange={(e) => setCloneForm((f) => ({ ...f, name: e.target.value }))} />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
            New slug
            <input className="field" required value={cloneForm.slug} onChange={(e) => setCloneForm((f) => ({ ...f, slug: e.target.value }))} />
          </label>
          <button type="submit" className="btn btn-primary" disabled={busy === 'clone'}>
            {busy === 'clone' ? 'Cloning…' : 'Create clone'}
          </button>
        </form>
      </Drawer>
    </section>
  );
}

export function TenantUsagePanel({ orgId }: { orgId: string }) {
  const [usage, setUsage] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/platform/organizations/${orgId}/usage`, { authScope: 'platform' });
      setUsage(res.data);
    } catch {
      setUsage(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [orgId]);

  if (loading) return <section className="pc-panel mb-6 p-5">Loading usage…</section>;
  if (!usage) return null;

  return (
    <section className="pc-panel mb-6 p-5 md:p-6">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="mt-0">Usage metering</h2>
          <p className="pc-hint m-0">Seats, API calls, and storage estimate for billing.</p>
        </div>
        <button type="button" className="btn btn-outline py-2 text-sm" onClick={load}>
          Refresh
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="pc-stat">
          <p>API calls today</p>
          <p className="pc-stat-value">{usage.today?.apiCalls ?? 0}</p>
          <p className="mt-1 mb-0 text-xs text-[var(--pc-muted)]">{usage.monthApiCalls ?? 0} this month</p>
        </div>
        <div className="pc-stat">
          <p>Seats</p>
          <p className="pc-stat-value">{usage.today?.seatCount ?? 0}</p>
          <p className="mt-1 mb-0 text-xs text-[var(--pc-muted)]">All portal users</p>
        </div>
        <div className="pc-stat">
          <p>Storage est.</p>
          <p className="pc-stat-value">{formatBytes(usage.today?.storageBytes)}</p>
          <p className="mt-1 mb-0 text-xs text-[var(--pc-muted)]">Documents & assets</p>
        </div>
      </div>
      {usage.seatsByRole?.length ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {usage.seatsByRole.map((row: any) => (
            <span key={row.role} className="pc-chip">
              {row.role}: {row.count}
            </span>
          ))}
        </div>
      ) : null}
    </section>
  );
}

export function TenantFeatureFlagsPanel({ orgId }: { orgId: string }) {
  const [flags, setFlags] = useState<any[]>([]);
  const [busy, setBusy] = useState('');

  const load = async () => {
    try {
      const res = await api.get(`/platform/organizations/${orgId}/feature-flags`, { authScope: 'platform' });
      setFlags(Array.isArray(res.data) ? res.data : []);
    } catch {
      setFlags([]);
    }
  };

  useEffect(() => {
    load();
  }, [orgId]);

  const setOverride = async (key: string, enabled: boolean | null) => {
    setBusy(key);
    try {
      await api.put(
        `/platform/organizations/${orgId}/feature-flags/${key}`,
        enabled === null ? { clear: true } : { enabled },
        { authScope: 'platform' }
      );
      await load();
    } finally {
      setBusy('');
    }
  };

  return (
    <section className="pc-panel mb-6 p-5 md:p-6">
      <h2 className="mt-0">Feature flags</h2>
      <p className="pc-hint mb-4">Per-tenant overrides on top of fleet rollout percentage.</p>
      <div className="grid gap-2">
        {flags.map((flag) => (
          <div key={flag.id} className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-[var(--pc-line)] px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="m-0 text-sm font-semibold text-[var(--pc-text)]">{flag.name}</p>
              <p className="m-0 font-mono text-[0.65rem] text-[var(--pc-muted)]">{flag.key}</p>
              <p className="m-0 mt-1 text-xs text-[var(--pc-muted)]">
                Fleet: {flag.enabled ? `${flag.rolloutPercent}% rollout` : 'off'} · Effective:{' '}
                <strong className={flag.effective ? 'text-[var(--pc-live)]' : ''}>{flag.effective ? 'on' : 'off'}</strong>
                {flag.override ? ` · override ${flag.override.enabled ? 'on' : 'off'}` : ''}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className={`pc-chip ${!flag.override && flag.effective ? 'is-on' : ''}`}
                disabled={busy === flag.key}
                onClick={() => setOverride(flag.key, null)}
              >
                Rollout
              </button>
              <GateSwitch
                on={flag.override ? flag.override.enabled : flag.effective}
                busy={busy === flag.key}
                compact
                onChange={(on) => setOverride(flag.key, on)}
              />
            </div>
          </div>
        ))}
        {flags.length === 0 ? <p className="m-0 text-sm text-[var(--pc-muted)]">No feature flags configured.</p> : null}
      </div>
    </section>
  );
}

type TrialProps = {
  orgId: string;
  trial: {
    isTrial?: boolean;
    trialEndsAt?: string | null;
    expired?: boolean;
    daysLeft?: number | null;
    limits?: { maxAdmins: number; maxFaculty: number; maxStudents: number; trialDays: number } | null;
    usage?: { admins: number; faculty: number; students: number } | null;
  } | null;
  onChanged: () => void;
};

export function TenantTrialPanel({ orgId, trial, onChanged }: TrialProps) {
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState('');

  if (!trial?.isTrial) return null;

  const limits = trial.limits;
  const usage = trial.usage;

  const convert = async () => {
    setBusy('convert');
    try {
      await api.post(`/platform/organizations/${orgId}/convert-trial`, {}, { authScope: 'platform' });
      setNotice('Trial converted to full tenant.');
      onChanged();
    } catch (err: any) {
      setNotice(err.response?.data?.message || 'Could not convert trial.');
    } finally {
      setBusy('');
    }
  };

  const endsLabel = trial.trialEndsAt
    ? new Date(trial.trialEndsAt).toLocaleDateString(undefined, { dateStyle: 'medium' })
    : '—';

  return (
    <section className="pc-panel mb-6">
      <Toast>{notice}</Toast>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="pc-kicker m-0">Trial institute</p>
          <h2 className="m-0 mt-1">Usage limits</h2>
          <p className="pc-hint m-0 mt-2">
            {trial.expired
              ? 'Trial ended — services are locked until you convert or extend.'
              : `Ends ${endsLabel}${trial.daysLeft != null ? ` · ${trial.daysLeft} day${trial.daysLeft === 1 ? '' : 's'} left` : ''}`}
          </p>
        </div>
        <button type="button" className="btn btn-primary" disabled={busy === 'convert'} onClick={convert}>
          {busy === 'convert' ? 'Converting…' : 'Convert to full tenant'}
        </button>
      </div>
      {limits && usage ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {[
            { label: 'Org admins', used: usage.admins, max: limits.maxAdmins },
            { label: 'Faculty', used: usage.faculty, max: limits.maxFaculty },
            { label: 'Students', used: usage.students, max: limits.maxStudents },
          ].map((row) => (
            <div key={row.label} className="rounded-[12px] border border-[var(--pc-line)] px-4 py-3">
              <p className="m-0 text-xs font-semibold uppercase tracking-wide text-[var(--pc-muted)]">{row.label}</p>
              <p className="m-0 mt-1 text-lg font-semibold text-[var(--pc-text)]">
                {row.used} / {row.max}
              </p>
              <div className="pc-progress mt-2">
                <div className="pc-progress-track">
                  <div
                    className="pc-progress-fill"
                    style={{ width: `${Math.min(100, Math.round((row.used / Math.max(row.max, 1)) * 100))}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
