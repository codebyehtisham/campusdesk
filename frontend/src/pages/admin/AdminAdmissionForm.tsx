import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/client';
import { ADMIN_BASE } from '../../admin/paths';

const FIELD_TYPES = [
  { value: 'text', label: 'Short text' },
  { value: 'textarea', label: 'Long text' },
  { value: 'email', label: 'Email' },
  { value: 'tel', label: 'Phone' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'select', label: 'Dropdown' },
  { value: 'file', label: 'Document upload' },
];

const uid = (prefix) => `${prefix}_${Math.random().toString(36).slice(2, 9)}`;

const blankField = (sortOrder = 0) => ({
  id: uid('f'),
  key: '',
  label: 'New field',
  type: 'text',
  required: true,
  options: [],
  maxFileMb: 5,
  accept: 'image/*,.pdf',
  placeholder: '',
  helpText: '',
  sortOrder,
});

const blankGroup = (sortOrder = 0) => ({
  id: uid('g'),
  title: 'New section',
  description: '',
  sortOrder,
  fields: [blankField(0)],
});

const emptyForm = () => ({
  published: false,
  intro: '',
  groups: [blankGroup(0)],
});

export default function AdminAdmissionForm() {
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [activeGroup, setActiveGroup] = useState(0);

  useEffect(() => {
    api
      .get('/admin/admission-form', { authScope: 'admin' })
      .then((res) => {
        const next = res.data?.groups?.length ? res.data : emptyForm();
        setForm(next);
        setActiveGroup(0);
      })
      .catch((err) => setError(err.response?.data?.message || 'Could not load admission form.'))
      .finally(() => setLoading(false));
  }, []);

  const group = form.groups[activeGroup] || form.groups[0];
  const fieldCount = useMemo(
    () => form.groups.reduce((n, g) => n + (g.fields?.length || 0), 0),
    [form.groups]
  );

  const updateForm = (patch) => setForm((f) => ({ ...f, ...patch }));

  const updateGroup = (index, patch) => {
    setForm((f) => ({
      ...f,
      groups: f.groups.map((g, i) => (i === index ? { ...g, ...patch } : g)),
    }));
  };

  const updateField = (groupIndex, fieldIndex, patch) => {
    setForm((f) => ({
      ...f,
      groups: f.groups.map((g, gi) =>
        gi !== groupIndex
          ? g
          : {
              ...g,
              fields: g.fields.map((field, fi) => (fi === fieldIndex ? { ...field, ...patch } : field)),
            }
      ),
    }));
  };

  const addGroup = () => {
    setForm((f) => {
      const groups = [...f.groups, blankGroup(f.groups.length)];
      setActiveGroup(groups.length - 1);
      return { ...f, groups };
    });
  };

  const removeGroup = (index) => {
    setForm((f) => {
      if (f.groups.length <= 1) return f;
      const groups = f.groups.filter((_, i) => i !== index);
      setActiveGroup(Math.max(0, Math.min(activeGroup, groups.length - 1)));
      return { ...f, groups };
    });
  };

  const addField = (groupIndex) => {
    setForm((f) => ({
      ...f,
      groups: f.groups.map((g, i) =>
        i !== groupIndex ? g : { ...g, fields: [...g.fields, blankField(g.fields.length)] }
      ),
    }));
  };

  const removeField = (groupIndex, fieldIndex) => {
    setForm((f) => ({
      ...f,
      groups: f.groups.map((g, i) =>
        i !== groupIndex
          ? g
          : { ...g, fields: g.fields.length <= 1 ? g.fields : g.fields.filter((_, fi) => fi !== fieldIndex) }
      ),
    }));
  };

  const save = async (published = form.published) => {
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const payload = {
        ...form,
        published,
        groups: form.groups.map((g, gi) => ({
          ...g,
          sortOrder: gi,
          fields: g.fields.map((field, fi) => ({ ...field, sortOrder: fi })),
        })),
      };
      const res = await api.put('/admin/admission-form', payload, { authScope: 'admin' });
      setForm(res.data);
      setNotice(published ? 'Admission portal published for students.' : 'Admission portal saved as draft.');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save the admission form.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="text-text-muted">Loading admission portal…</p>;
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="eyebrow">Admissions</span>
          <h1 className="mb-2 text-[clamp(2rem,4vw,3rem)]">Admission portal</h1>
          <p className="m-0 max-w-2xl text-text-muted">
            Build the form students see when they apply. Group fields, mark required or optional, and set
            document size limits. Officers review submitted applications.
          </p>
        </div>
        <Link to={`${ADMIN_BASE}/admissions`} className="btn btn-outline-light text-sm">
          Back to records
        </Link>
      </div>

      <div className="glass mb-6 flex flex-col gap-4 rounded-[1.6rem] p-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="m-0 text-[0.7rem] font-semibold tracking-[0.16em] text-text-muted uppercase">Status</p>
          <h3 className="mt-2 mb-1">{form.published ? 'Published' : 'Draft'}</h3>
          <p className="m-0 text-sm text-text-muted">
            {fieldCount} fields across {form.groups.length} section{form.groups.length === 1 ? '' : 's'}.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-outline text-sm" disabled={saving} onClick={() => save(false)}>
            Save draft
          </button>
          <button type="button" className="btn btn-primary text-sm" disabled={saving} onClick={() => save(true)}>
            {saving ? 'Saving…' : 'Publish portal'}
          </button>
        </div>
      </div>

      {error && (
        <p className="mb-5 rounded-2xl bg-crimson-pale px-4 py-3 text-sm font-bold text-crimson-dark">{error}</p>
      )}
      {notice && (
        <p className="mb-5 rounded-2xl bg-cardinal-pale px-4 py-3 text-sm font-bold text-cardinal">{notice}</p>
      )}

      <label className="mb-8 flex flex-col gap-1.5 text-sm font-semibold text-ink">
        Intro shown to students
        <textarea
          className="field min-h-[88px]"
          value={form.intro}
          onChange={(e) => updateForm({ intro: e.target.value })}
          placeholder="Short guidance for applicants"
        />
      </label>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {form.groups.map((g, i) => (
          <button
            key={g.id}
            type="button"
            onClick={() => setActiveGroup(i)}
            className={`rounded-full px-4 py-2 text-sm font-bold ${
              activeGroup === i ? 'bg-cardinal text-white' : 'border border-border bg-white text-ink'
            }`}
          >
            {g.title || `Section ${i + 1}`}
          </button>
        ))}
        <button type="button" className="rounded-full border border-dashed border-cardinal/40 px-4 py-2 text-sm font-bold text-cardinal" onClick={addGroup}>
          + Section
        </button>
      </div>

      {group && (
        <div className="glass rounded-[1.6rem] p-6 md:p-8">
          <div className="mb-6 grid gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
              Section title
              <input
                className="field"
                value={group.title}
                onChange={(e) => updateGroup(activeGroup, { title: e.target.value })}
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
              Section help text
              <input
                className="field"
                value={group.description}
                onChange={(e) => updateGroup(activeGroup, { description: e.target.value })}
                placeholder="Optional description"
              />
            </label>
          </div>

          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="m-0 text-lg">Fields</h3>
            <div className="flex gap-2">
              <button type="button" className="btn btn-outline-light py-2 text-sm" onClick={() => addField(activeGroup)}>
                Add field
              </button>
              {form.groups.length > 1 && (
                <button
                  type="button"
                  className="rounded-full border border-crimson/25 bg-crimson-pale px-4 py-2 text-sm font-bold text-crimson"
                  onClick={() => removeGroup(activeGroup)}
                >
                  Remove section
                </button>
              )}
            </div>
          </div>

          <div className="grid gap-4">
            {group.fields.map((field, fi) => (
              <article key={field.id} className="rounded-2xl border border-border bg-white/70 p-4 md:p-5">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <strong className="text-sm">{field.label || `Field ${fi + 1}`}</strong>
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="flex items-center gap-2 text-sm font-semibold text-ink">
                      <input
                        type="checkbox"
                        checked={field.required}
                        onChange={(e) => updateField(activeGroup, fi, { required: e.target.checked })}
                      />
                      Required
                    </label>
                    {group.fields.length > 1 && (
                      <button
                        type="button"
                        className="text-sm font-bold text-crimson"
                        onClick={() => removeField(activeGroup, fi)}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="flex flex-col gap-1 text-sm font-semibold text-ink">
                    Label
                    <input
                      className="field"
                      value={field.label}
                      onChange={(e) => updateField(activeGroup, fi, { label: e.target.value })}
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm font-semibold text-ink">
                    Type
                    <select
                      className="field"
                      value={field.type}
                      onChange={(e) => updateField(activeGroup, fi, { type: e.target.value })}
                    >
                      {FIELD_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-sm font-semibold text-ink">
                    Placeholder
                    <input
                      className="field"
                      value={field.placeholder}
                      onChange={(e) => updateField(activeGroup, fi, { placeholder: e.target.value })}
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm font-semibold text-ink">
                    Help text
                    <input
                      className="field"
                      value={field.helpText}
                      onChange={(e) => updateField(activeGroup, fi, { helpText: e.target.value })}
                    />
                  </label>
                  {field.type === 'select' && (
                    <label className="flex flex-col gap-1 text-sm font-semibold text-ink md:col-span-2">
                      Options (comma separated)
                      <input
                        className="field"
                        value={(field.options || []).join(', ')}
                        onChange={(e) =>
                          updateField(activeGroup, fi, {
                            options: e.target.value
                              .split(',')
                              .map((s) => s.trim())
                              .filter(Boolean),
                          })
                        }
                      />
                    </label>
                  )}
                  {field.type === 'file' && (
                    <>
                      <label className="flex flex-col gap-1 text-sm font-semibold text-ink">
                        Max file size (MB)
                        <input
                          type="number"
                          min="0.5"
                          max="25"
                          step="0.5"
                          className="field"
                          value={field.maxFileMb}
                          onChange={(e) => updateField(activeGroup, fi, { maxFileMb: Number(e.target.value) || 5 })}
                        />
                      </label>
                      <label className="flex flex-col gap-1 text-sm font-semibold text-ink">
                        Accepted types
                        <input
                          className="field"
                          value={field.accept}
                          onChange={(e) => updateField(activeGroup, fi, { accept: e.target.value })}
                          placeholder="image/*,.pdf"
                        />
                      </label>
                    </>
                  )}
                </div>
              </article>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
