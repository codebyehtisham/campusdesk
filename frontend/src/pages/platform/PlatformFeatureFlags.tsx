import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/client';
import { signOutPlatform } from '../../auth/platformSession';
import { SUPER_BASE } from '../../admin/paths';
import { formatBytes } from './money';
import { Banner, Drawer, PageHead, Toast } from './ui';

const labelClass = 'flex flex-col gap-1.5 text-sm font-semibold text-ink';

export default function PlatformFeatureFlags() {
  const navigate = useNavigate();
  const [flags, setFlags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ key: '', name: '', description: '', enabled: false, rolloutPercent: 0 });

  const kickOut = () => {
    signOutPlatform();
    navigate(SUPER_BASE, { replace: true });
  };

  const load = async () => {
    try {
      const res = await api.get('/platform/feature-flags', { authScope: 'platform' });
      setFlags(Array.isArray(res.data) ? res.data : []);
      setError('');
    } catch (err: any) {
      if (err.response?.status === 401 || err.response?.status === 403) return kickOut();
      setError(err.response?.data?.message || 'Could not load feature flags.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const saveFlag = async (flag: any, patch: object) => {
    try {
      await api.put(`/platform/feature-flags/${flag.id}`, patch, { authScope: 'platform' });
      await load();
    } catch (err: any) {
      setNotice(err.response?.data?.message || 'Could not update flag.');
    }
  };

  const createFlag = async (e: { preventDefault: () => void }) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/platform/feature-flags', form, { authScope: 'platform' });
      setNotice('Feature flag created.');
      setOpen(false);
      setForm({ key: '', name: '', description: '', enabled: false, rolloutPercent: 0 });
      await load();
    } catch (err: any) {
      setNotice(err.response?.data?.message || 'Could not create flag.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHead
        kicker="Operations"
        title="Feature flags"
        hint="Roll out capabilities per tenant or by percentage of the fleet. Overrides are set on each tenant page."
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}>
            New flag
          </button>
        }
      />
      <Banner>{error}</Banner>
      {loading ? (
        <div className="pc-panel p-10 text-center">Loading flags…</div>
      ) : (
        <div className="grid gap-3">
          {flags.map((flag: any) => (
            <article key={flag.id} className="pc-panel p-4 md:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="m-0">{flag.name}</h3>
                  <p className="m-0 font-mono text-xs text-[var(--pc-muted)]">{flag.key}</p>
                  {flag.description ? <p className="m-0 mt-2 text-sm text-[var(--pc-muted)]">{flag.description}</p> : null}
                </div>
                <span className="pc-chip">{flag.overrideCount} tenant overrides</span>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <label className="flex items-center justify-between rounded-[12px] border border-[var(--pc-line)] px-4 py-3">
                  <span className="text-sm font-semibold">Globally enabled</span>
                  <input
                    type="checkbox"
                    checked={flag.enabled}
                    onChange={(e) => saveFlag(flag, { enabled: e.target.checked })}
                  />
                </label>
                <label className={labelClass}>
                  Rollout %
                  <input
                    type="number"
                    min={0}
                    max={100}
                    className="field"
                    value={flag.rolloutPercent}
                    onChange={(e) => saveFlag(flag, { rolloutPercent: Number(e.target.value) })}
                  />
                </label>
              </div>
            </article>
          ))}
        </div>
      )}
      <Toast>{notice}</Toast>
      <Drawer open={open} onClose={() => setOpen(false)} kicker="Fleet" title="Create feature flag">
        <form onSubmit={createFlag} className="flex flex-col gap-4">
          <label className={labelClass}>
            Key
            <input className="field" required placeholder="my_feature" value={form.key} onChange={(e) => setForm((f) => ({ ...f, key: e.target.value }))} />
          </label>
          <label className={labelClass}>
            Name
            <input className="field" required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </label>
          <label className={labelClass}>
            Description
            <textarea className="field min-h-20" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          </label>
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input type="checkbox" checked={form.enabled} onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))} />
            Enabled
          </label>
          <label className={labelClass}>
            Rollout %
            <input type="number" min={0} max={100} className="field" value={form.rolloutPercent} onChange={(e) => setForm((f) => ({ ...f, rolloutPercent: Number(e.target.value) }))} />
          </label>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Creating…' : 'Create flag'}
          </button>
        </form>
      </Drawer>
    </div>
  );
}
