import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/client';
import { signOutPlatform } from '../../auth/platformSession';
import { SUPER_BASE } from '../../admin/paths';
import { Banner, Drawer, PageHead, Pulse, Toast } from './ui';

const emptyDept = { name: '', slug: '', description: '', sortOrder: 0, active: true };
const emptyMod = { name: '', slug: '', description: '', sortOrder: 0, active: true, departmentId: '' };
const labelClass = 'flex flex-col gap-1.5 text-sm font-semibold text-ink';

export default function PlatformModules() {
  const navigate = useNavigate();
  const [departments, setDepartments] = useState([]);
  const [unassigned, setUnassigned] = useState([]);
  const [orgs, setOrgs] = useState([]);
  const [deptForm, setDeptForm] = useState(emptyDept);
  const [modForm, setModForm] = useState(emptyMod);
  const [editingDept, setEditingDept] = useState(null);
  const [editingMod, setEditingMod] = useState(null);
  const [deptOpen, setDeptOpen] = useState(false);
  const [modOpen, setModOpen] = useState(false);
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
      const [catRes, orgRes] = await Promise.all([
        api.get('/platform/catalog', { authScope: 'platform' }),
        api.get('/platform/organizations', { authScope: 'platform' }),
      ]);
      setDepartments(Array.isArray(catRes.data?.departments) ? catRes.data.departments : []);
      setUnassigned(Array.isArray(catRes.data?.unassigned) ? catRes.data.unassigned : []);
      setOrgs(Array.isArray(orgRes.data) ? orgRes.data : []);
      setError('');
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) return kickOut();
      setError(err.response?.data?.message || 'Could not load the catalog.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const tenantCount = (slug) => orgs.filter((org) => (org.modules || []).includes(slug)).length;
  const deptTenantCount = (dept) =>
    orgs.filter((org) => (org.departments || []).includes(dept.slug) || (dept.modules || []).some((item) => (org.modules || []).includes(item.slug)))
      .length;

  const openCreateDept = () => {
    setEditingDept(null);
    setDeptForm(emptyDept);
    setDeptOpen(true);
  };

  const openEditDept = (item) => {
    setEditingDept(item);
    setDeptForm({
      name: item.name,
      slug: item.slug,
      description: item.description || '',
      sortOrder: item.sortOrder || 0,
      active: item.active !== false,
    });
    setDeptOpen(true);
  };

  const openCreateMod = (departmentId = '') => {
    setEditingMod(null);
    setModForm({ ...emptyMod, departmentId });
    setModOpen(true);
  };

  const openEditMod = (item) => {
    setEditingMod(item);
    setModForm({
      name: item.name,
      slug: item.slug,
      description: item.description || '',
      sortOrder: item.sortOrder || 0,
      active: item.active !== false,
      departmentId: item.departmentId || '',
    });
    setModOpen(true);
  };

  const saveDept = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingDept) {
        await api.put(`/platform/departments/${editingDept.id}`, deptForm, { authScope: 'platform' });
        setNotice('Department updated.');
      } else {
        await api.post('/platform/departments', deptForm, { authScope: 'platform' });
        setNotice('Department created. Add modules under it, then enable it on tenants.');
      }
      setDeptOpen(false);
      await load();
    } catch (err) {
      setNotice(err.response?.data?.message || 'Could not save department.');
    } finally {
      setSaving(false);
    }
  };

  const setDeptLive = async (item, active) => {
    try {
      await api.put(`/platform/departments/${item.id}`, { active }, { authScope: 'platform' });
      setNotice(
        active
          ? `${item.name} is in the catalog. Tenants can subscribe.`
          : `${item.name} is hidden from new tenants. Existing entitlements stay until you revoke them.`
      );
      await load();
    } catch (err) {
      setNotice(err.response?.data?.message || 'Could not update department.');
    }
  };

  const saveMod = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...modForm, departmentId: modForm.departmentId || null };
      if (editingMod) {
        await api.put(`/platform/modules/${editingMod.id}`, payload, { authScope: 'platform' });
        setNotice('Module updated.');
      } else {
        await api.post('/platform/modules', payload, { authScope: 'platform' });
        setNotice('Module added to the department.');
      }
      setModOpen(false);
      await load();
    } catch (err) {
      setNotice(err.response?.data?.message || 'Could not save module.');
    } finally {
      setSaving(false);
    }
  };

  const renderModuleRows = (items) =>
    items.length ? (
      <div className="pc-mod-list">
        {items.map((item) => {
          const live = item.active !== false;
          return (
            <button key={item.id} type="button" className="pc-mod-row" onClick={() => openEditMod(item)}>
              <span>
                <strong className="block text-[var(--pc-text)]">{item.name}</strong>
                <span className="text-xs text-[var(--pc-muted)]">{item.description || 'No description'}</span>
              </span>
              <span className="font-mono text-[0.72rem] text-[var(--pc-muted)]">{item.slug}</span>
              <span className="text-xs text-[var(--pc-muted)]">
                {tenantCount(item.slug)} tenant{tenantCount(item.slug) === 1 ? '' : 's'}
              </span>
              <span className={`tag ${live ? 'tag-allied' : 'tag-nursing'}`}>{live ? 'In catalog' : 'Hidden'}</span>
            </button>
          );
        })}
      </div>
    ) : (
      <p className="pc-empty">No modules in this department yet.</p>
    );

  const liveDepts = departments.filter((item) => item.active).length;
  const moduleCount = departments.reduce((sum, item) => sum + (item.modules || []).length, 0) + unassigned.length;

  return (
    <div>
      <PageHead
        kicker="Catalog"
        title="Departments & modules"
        hint="Add departments and modules here. Each campus then enables a department and only the modules it pays for."
        actions={
          <>
            <button type="button" className="btn btn-outline py-2.5 text-sm" onClick={() => openCreateMod()}>
              New module
            </button>
            <button type="button" className="btn btn-primary shrink-0" onClick={openCreateDept}>
              New department
            </button>
          </>
        }
      />
      <div className="mb-5 flex flex-wrap gap-3 text-[0.75rem] font-semibold tracking-wide text-[var(--pc-muted)] uppercase">
        <span className="rounded-md border border-[var(--pc-line)] px-3 py-1.5">
          {liveDepts} live / {departments.length} departments
        </span>
        <span className="rounded-md border border-[var(--pc-line)] px-3 py-1.5">{moduleCount} modules</span>
        <span className="rounded-md border border-[var(--pc-line)] px-3 py-1.5">{orgs.length} tenants</span>
      </div>
      <Banner>{error}</Banner>
      {loading ? (
        <div className="pc-panel p-10 text-center">Loading catalog…</div>
      ) : (
        <div className="grid gap-4">
          {departments.map((dept) => {
            const live = dept.active !== false;
            const count = deptTenantCount(dept);
            return (
              <section key={dept.id} className={`pc-dept ${live ? 'is-live' : 'is-off'}`}>
                <div className="pc-dept-head">
                  <div className="pc-dept-meta">
                    <p className="pc-kicker mb-1">Department</p>
                    <h3 className="mb-1">{dept.name}</h3>
                    <p className="m-0 text-sm">
                      {dept.description || 'No description'} · {(dept.modules || []).length} module
                      {(dept.modules || []).length === 1 ? '' : 's'} · {count} tenant{count === 1 ? '' : 's'}
                    </p>
                  </div>
                  <div className="pc-dept-actions">
                    <span className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--pc-text)]">
                      <Pulse on={live} tone={live ? 'live' : 'warn'} />
                      {live ? 'In catalog' : 'Hidden'}
                    </span>
                    <button type="button" className="btn btn-outline py-2 text-sm" onClick={() => openEditDept(dept)}>
                      Edit
                    </button>
                    <button type="button" className="btn btn-outline py-2 text-sm" onClick={() => openCreateMod(dept.id)}>
                      Add module
                    </button>
                    <button
                      type="button"
                      className={`btn py-2 text-sm ${live ? 'btn-outline' : 'btn-primary'}`}
                      onClick={() => setDeptLive(dept, !live)}
                    >
                      {live ? 'Hide from catalog' : 'Publish department'}
                    </button>
                  </div>
                </div>
                {renderModuleRows(dept.modules || [])}
              </section>
            );
          })}
          {unassigned.length > 0 && (
            <section className="pc-dept">
              <div className="pc-dept-head">
                <div className="pc-dept-meta">
                  <p className="pc-kicker mb-1">Unassigned</p>
                  <h3 className="mb-1">Modules without a department</h3>
                  <p className="m-0 text-sm">Move these into a department before enabling them on a tenant.</p>
                </div>
              </div>
              {renderModuleRows(unassigned)}
            </section>
          )}
        </div>
      )}

      <Toast>{notice}</Toast>

      <Drawer
        open={deptOpen}
        onClose={() => setDeptOpen(false)}
        kicker={editingDept ? 'Edit department' : 'New department'}
        title={editingDept ? 'Update department' : 'Add a department'}
      >
        <form onSubmit={saveDept} className="flex flex-col gap-4">
          <label className={labelClass}>
            Name
            <input required className="field" value={deptForm.name} onChange={(e) => setDeptForm((f) => ({ ...f, name: e.target.value }))} />
          </label>
          <label className={labelClass}>
            Slug
            <input className="field" placeholder="student-intake" value={deptForm.slug} onChange={(e) => setDeptForm((f) => ({ ...f, slug: e.target.value }))} />
          </label>
          <label className={labelClass}>
            Description
            <textarea className="field min-h-24" value={deptForm.description} onChange={(e) => setDeptForm((f) => ({ ...f, description: e.target.value }))} />
          </label>
          <label className="flex items-center gap-3 text-sm font-semibold text-ink">
            <input type="checkbox" checked={deptForm.active} onChange={(e) => setDeptForm((f) => ({ ...f, active: e.target.checked }))} />
            Available in catalog
          </label>
          <div className="flex gap-2">
            <button type="submit" className="btn btn-primary flex-1" disabled={saving}>
              {saving ? 'Saving…' : 'Save department'}
            </button>
            <button type="button" className="btn btn-outline flex-1" onClick={() => setDeptOpen(false)}>
              Cancel
            </button>
          </div>
        </form>
      </Drawer>

      <Drawer
        open={modOpen}
        onClose={() => setModOpen(false)}
        kicker={editingMod ? 'Edit module' : 'New module'}
        title={editingMod ? 'Update module' : 'Add a module'}
      >
        <form onSubmit={saveMod} className="flex flex-col gap-4">
          <label className={labelClass}>
            Department
            <select
              className="field"
              value={modForm.departmentId}
              onChange={(e) => setModForm((f) => ({ ...f, departmentId: e.target.value }))}
            >
              <option value="">Unassigned</option>
              {departments.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            Name
            <input required className="field" value={modForm.name} onChange={(e) => setModForm((f) => ({ ...f, name: e.target.value }))} />
          </label>
          <label className={labelClass}>
            Slug
            <input required className="field" placeholder="admissions" value={modForm.slug} onChange={(e) => setModForm((f) => ({ ...f, slug: e.target.value }))} />
          </label>
          <label className={labelClass}>
            Description
            <textarea className="field min-h-24" value={modForm.description} onChange={(e) => setModForm((f) => ({ ...f, description: e.target.value }))} />
          </label>
          <label className="flex items-center gap-3 text-sm font-semibold text-ink">
            <input type="checkbox" checked={modForm.active} onChange={(e) => setModForm((f) => ({ ...f, active: e.target.checked }))} />
            Available to assign on a tenant
          </label>
          <div className="flex gap-2">
            <button type="submit" className="btn btn-primary flex-1" disabled={saving}>
              {saving ? 'Saving…' : 'Save module'}
            </button>
            <button type="button" className="btn btn-outline flex-1" onClick={() => setModOpen(false)}>
              Cancel
            </button>
          </div>
        </form>
      </Drawer>
    </div>
  );
}
