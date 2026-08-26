import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../api/client';
import { signOutPlatform } from '../../auth/platformSession';
import { SUPER_BASE } from '../../admin/paths';
import { templateById } from '../../theme/catalog';
import { deptEnabled, deptNamesForOrg } from './catalog';
import { Banner, Drawer, GateSwitch, PageHead, Pulse, Toast } from './ui';

const emptyForm = { kind: '', name: '', slug: '', email: '', phone: '', status: 'active', isPublic: false, departments: [], modules: [] };
const labelClass = 'flex flex-col gap-1.5 text-sm font-semibold text-ink';

export default function PlatformOrganizations() {
  const navigate = useNavigate();
  const [orgs, setOrgs] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [schemes, setSchemes] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const kickOut = () => {
    signOutPlatform();
    navigate(SUPER_BASE, { replace: true });
  };

  const load = async () => {
    try {
      const [orgRes, catRes] = await Promise.all([
        api.get('/platform/organizations', { authScope: 'platform' }),
        api.get('/platform/catalog', { authScope: 'platform' }),
      ]);
      setOrgs(Array.isArray(orgRes.data) ? orgRes.data : []);
      setDepartments(Array.isArray(catRes.data?.departments) ? catRes.data.departments : []);
      setSchemes(Array.isArray(catRes.data?.schemes) ? catRes.data.schemes : []);
      setError('');
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) return kickOut();
      setError(err.response?.data?.message || 'Could not load tenants.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const liveDepartments = departments.filter((item) => item.active);
  const selectedScheme = schemes.find((item) => item.slug === form.kind);

  const applyScheme = (kind) => {
    const scheme = schemes.find((item) => item.slug === kind);
    if (!scheme) {
      setForm((f) => ({ ...f, kind }));
      return;
    }
    setForm((f) => ({
      ...f,
      kind,
      departments: [...scheme.departments],
      modules: [...scheme.modules],
    }));
  };

  const toggleFormDept = (dept) => {
    setForm((f) => {
      const on = f.departments.includes(dept.slug);
      const departments = on ? f.departments.filter((item) => item !== dept.slug) : [...f.departments, dept.slug];
      const slugs = new Set((dept.modules || []).map((item) => item.slug));
      const modules = on ? f.modules.filter((slug) => !slugs.has(slug)) : f.modules;
      return { ...f, departments, modules };
    });
  };

  const toggleFormModule = (dept, slug) => {
    setForm((f) => {
      const on = f.modules.includes(slug);
      const modules = on ? f.modules.filter((item) => item !== slug) : [...f.modules, slug];
      const departments = on ? f.departments : [...new Set([...f.departments, dept.slug])];
      return { ...f, departments, modules };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.kind) {
      setNotice('Choose what this organisation is: education institute or hospital.');
      return;
    }
    setSaving(true);
    try {
      const res = await api.post('/platform/organizations', form, { authScope: 'platform' });
      setNotice(`${form.name} provisioned.`);
      setOpen(false);
      setForm(emptyForm);
      await load();
      navigate(`${SUPER_BASE}/organizations/${res.data.id}`);
    } catch (err) {
      setNotice(err.response?.data?.message || 'Could not create tenant.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHead
        kicker="Tenants"
        title="Organisations"
        hint="Choose what the organisation is, then provision modules. Education campuses get faculty and students; hospitals get HR and clinical departments."
        actions={
          <button type="button" className="btn btn-primary shrink-0" onClick={() => setOpen(true)}>
            Provision tenant
          </button>
        }
      />
      <Banner>{error}</Banner>
      {loading ? (
        <div className="pc-panel p-10 text-center">Loading tenants…</div>
      ) : orgs.length === 0 ? (
        <div className="pc-panel p-10 text-center">
          <h3>No tenants yet</h3>
          <p className="mb-6">Provision a campus, pick departments, then create their admin account.</p>
          <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}>
            Provision the first tenant
          </button>
        </div>
      ) : (
        <div className="pc-tenant-grid">
          {orgs.map((org) => {
            const names = deptNamesForOrg(org, departments);
            const fallback = departments.filter((dept) => deptEnabled(org, dept)).map((dept) => dept.name);
            const labels = names.length ? names : fallback;
            return (
              <Link key={org.id} to={`${SUPER_BASE}/organizations/${org.id}`} className="pc-tenant-card">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="mb-1">{org.name}</h3>
                    <p className="m-0 font-mono text-[0.68rem] text-[var(--pc-muted)]">
                      {org.slug}
                      {org.kind ? ` · ${org.kind === 'hospital' ? 'hospital' : 'education institute'}` : ''}
                      {org.isPublic ? ' · public site' : ''} · {templateById(org.theme?.template).name}
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--pc-text)]">
                    <Pulse on={org.status === 'active' && !org.servicesLocked} tone={org.status === 'active' && !org.servicesLocked ? 'live' : 'warn'} />
                    {org.servicesLocked ? 'locked' : org.status}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {labels.length ? (
                    labels.map((name) => (
                      <span key={name} className="pc-chip">
                        {name}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-[var(--pc-muted)]">No departments enabled</span>
                  )}
                </div>
                <p className="m-0 text-xs text-[var(--pc-muted)]">
                  {org.adminCount} admin{org.adminCount === 1 ? '' : 's'} · {(org.modules || []).length} module
                  {(org.modules || []).length === 1 ? '' : 's'}
                </p>
              </Link>
            );
          })}
        </div>
      )}

      <Toast>{notice}</Toast>

      <Drawer open={open} onClose={() => setOpen(false)} kicker="New tenant" title="Provision organisation">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <p className="pc-kicker mb-0">What is this organisation?</p>
          <div className="grid gap-2">
            {schemes.map((item) => {
              const on = form.kind === item.slug;
              return (
                <button
                  key={item.slug}
                  type="button"
                  className={`pc-pick text-left ${on ? 'is-on' : ''}`}
                  onClick={() => applyScheme(item.slug)}
                >
                  <p className="m-0 text-sm font-semibold text-[var(--pc-text)]">{item.label}</p>
                  <p className="m-0 mt-1 text-xs text-[var(--pc-muted)]">{item.hint}</p>
                  {on && (
                    <p className="m-0 mt-2 text-xs text-[var(--pc-muted)]">
                      Defaults: {(item.units || []).map((unit) => unit.name).join(', ')}
                    </p>
                  )}
                </button>
              );
            })}
          </div>
          <label className={labelClass}>
            Name
            <input required className="field" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </label>
          <label className={labelClass}>
            Slug
            <input className="field" placeholder="auto from name" value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))} />
          </label>
          <label className={labelClass}>
            Email
            <input type="email" className="field" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
          </label>
          <p className="pc-kicker mb-0">Product departments and modules</p>
          <p className="m-0 text-xs text-[var(--pc-muted)]">
            {selectedScheme
              ? `${selectedScheme.label} defaults are selected. Turn modules on or off before you create the tenant.`
              : 'Pick an organisation type first to load the right defaults.'}
          </p>
          <div className="grid gap-2">
            {liveDepartments.map((item) => {
              const on = form.departments.includes(item.slug);
              return (
                <div key={item.slug} className={`pc-pick ${on ? 'is-on' : ''}`}>
                  <button type="button" className="w-full text-left" onClick={() => toggleFormDept(item)}>
                    <p className="m-0 text-sm font-semibold text-[var(--pc-text)]">{item.name}</p>
                    <p className="m-0 mt-1 text-xs text-[var(--pc-muted)]">
                      {on ? 'Click modules below to include them' : 'Enable department, then pick modules'}
                    </p>
                  </button>
                  {on && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {(item.modules || []).filter((mod) => mod.active).map((mod) => (
                        <button
                          key={mod.slug}
                          type="button"
                          className={`pc-chip ${form.modules.includes(mod.slug) ? 'is-on' : ''}`}
                          onClick={() => toggleFormModule(item, mod.slug)}
                        >
                          {mod.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            {liveDepartments.length === 0 && (
              <p className="m-0 text-sm">No published departments. Add them under Catalog first.</p>
            )}
          </div>
          <div className="flex items-center justify-between rounded-[12px] border border-[var(--pc-line)] px-4 py-3">
            <div>
              <p className="m-0 text-sm font-semibold text-[var(--pc-text)]">Public website tenant</p>
              <p className="m-0 text-xs text-[var(--pc-muted)]">Serves the hostname-facing campus site</p>
            </div>
            <GateSwitch on={form.isPublic} onChange={(isPublic) => setForm((f) => ({ ...f, isPublic }))} liveLabel="Yes" offLabel="No" />
          </div>
          <div className="flex gap-2">
            <button type="submit" className="btn btn-primary flex-1" disabled={saving || !form.kind}>
              {saving ? 'Provisioning…' : 'Create tenant'}
            </button>
            <button type="button" className="btn btn-outline flex-1" onClick={() => setOpen(false)}>
              Cancel
            </button>
          </div>
        </form>
      </Drawer>
    </div>
  );
}
