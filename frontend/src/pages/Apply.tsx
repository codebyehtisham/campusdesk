import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHero from '../components/PageHero';
import Reveal from '../components/Reveal';
import { getApplicant, signOutApplicant } from '../auth/session';
import { isLockedOrg, isSuspendedError } from '../auth/serviceLock';
import api from '../api/client';

const statusLabel = {
  not_started: 'Not started',
  in_progress: 'In progress',
  submitted: 'Submitted',
  accepted: 'Accepted',
  rejected: 'Rejected',
};

const labelClass = 'flex flex-col gap-1.5 text-sm font-semibold text-ink';

function FieldInput({ field, value, disabled, onChange, onUpload }) {
  const common = {
    className: 'field',
    disabled,
    required: field.required,
    placeholder: field.placeholder || undefined,
  };

  if (field.type === 'textarea') {
    return (
      <textarea
        {...common}
        className="field min-h-[110px]"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  if (field.type === 'select') {
    return (
      <select {...common} value={value || ''} onChange={(e) => onChange(e.target.value)}>
        <option value="">Select…</option>
        {(field.options || []).map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    );
  }

  if (field.type === 'file') {
    const file = value && typeof value === 'object' ? value : null;
    return (
      <div className="flex flex-col gap-2">
        {file?.url ? (
          <a href={file.url} target="_blank" rel="noreferrer" className="text-sm font-bold text-cardinal">
            {file.name || 'Uploaded file'} · view
          </a>
        ) : (
          <p className="m-0 text-sm text-text-muted">No file uploaded yet.</p>
        )}
        {!disabled && (
          <input
            type="file"
            accept={field.accept || 'image/*,.pdf'}
            className="text-sm"
            onChange={(e) => {
              const picked = e.target.files?.[0];
              if (picked) onUpload(picked);
              e.target.value = '';
            }}
          />
        )}
        <p className="m-0 text-xs text-text-muted">Max {field.maxFileMb || 5} MB</p>
      </div>
    );
  }

  const inputType =
    field.type === 'email' || field.type === 'tel' || field.type === 'number' || field.type === 'date'
      ? field.type
      : 'text';

  return (
    <input
      {...common}
      type={inputType}
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.readAsDataURL(file);
  });
}

export default function Apply() {
  const navigate = useNavigate();
  const [applicant, setApplicant] = useState(() => getApplicant());
  const [appStatus, setAppStatus] = useState('not_started');
  const [form, setForm] = useState({ published: false, intro: '', groups: [] });
  const [answers, setAnswers] = useState({});
  const [editable, setEditable] = useState(true);
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const groups = form.groups || [];
  const activeGroup = groups[step] || null;

  const progress = useMemo(() => {
    if (!groups.length) return 0;
    return Math.round(((step + 1) / groups.length) * 100);
  }, [groups.length, step]);

  useEffect(() => {
    const current = getApplicant();
    if (!current?.token) {
      navigate('/apply', { replace: true });
      return;
    }
    if (isLockedOrg(current.organization)) {
      navigate('/apply/suspended', { replace: true });
      return;
    }
    setApplicant(current);
    api
      .get('/applications/me', { authScope: 'applicant' })
      .then((res) => {
        setAppStatus(res.data?.status || 'not_started');
        setAnswers(res.data?.answers || {});
        setForm(res.data?.form || { published: false, intro: '', groups: [] });
        setEditable(res.data?.editable !== false);
      })
      .catch((err) => {
        if (isSuspendedError(err)) {
          navigate('/apply/suspended', { replace: true });
          return;
        }
        if (err.response?.status === 401 || err.response?.status === 403) {
          signOutApplicant();
          navigate('/apply', { replace: true });
          return;
        }
        setError(err.response?.data?.message || 'Could not load your application.');
      })
      .finally(() => setLoading(false));
  }, [navigate]);

  if (!applicant) return null;

  const setAnswer = (key, value) => {
    setAnswers((prev) => ({ ...prev, [key]: value }));
    setError('');
  };

  const uploadFile = async (field, file) => {
    setSaving(true);
    setError('');
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const res = await api.post(
        '/applications/me/files',
        { fieldKey: field.key, file: dataUrl, name: file.name },
        { authScope: 'applicant' }
      );
      setAnswer(field.key, res.data);
      setNotice(`${field.label} uploaded.`);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not upload that file.');
    } finally {
      setSaving(false);
    }
  };

  const saveDraft = async () => {
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const res = await api.put('/applications/me', { answers }, { authScope: 'applicant' });
      setAppStatus(res.data?.status || 'in_progress');
      setAnswers(res.data?.answers || answers);
      setNotice('Progress saved.');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save progress.');
    } finally {
      setSaving(false);
    }
  };

  const submit = async () => {
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const res = await api.post('/applications/me/submit', { answers }, { authScope: 'applicant' });
      setAppStatus(res.data?.status || 'submitted');
      setAnswers(res.data?.answers || answers);
      setEditable(false);
      setNotice('Application submitted. An admissions officer will review it.');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not submit application.');
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = () => {
    signOutApplicant();
    navigate('/apply');
  };

  return (
    <>
      <PageHero
        eyebrow="Admissions portal"
        title="Your admission application"
        subtitle={
          form.intro ||
          'Complete each section. Required fields are marked. You can save and return before submitting.'
        }
        image="/images/campus/photos/nursing-skills-lab.jpg"
      />

      <section className="section pt-0">
        <div className="container max-w-3xl">
          <Reveal className="glass mb-8 flex flex-col justify-between gap-6 rounded-[1.8rem] p-8 md:flex-row md:items-center md:p-10">
            <div>
              <span className="eyebrow">Signed in</span>
              <h2 className="mb-2">{applicant.name || 'Applicant'}</h2>
              <p className="m-0 text-text-muted">{applicant.email}</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full bg-cardinal-pale px-4 py-2 text-sm font-bold text-cardinal">
                Status · {statusLabel[appStatus] || appStatus}
              </span>
              <button type="button" className="btn btn-outline-light" onClick={handleSignOut}>
                Sign out
              </button>
            </div>
          </Reveal>

          {loading ? (
            <p className="text-text-muted">Loading your form…</p>
          ) : !groups.length ? (
            <div className="glass rounded-[1.6rem] p-8">
              <h3>Form not ready</h3>
              <p className="m-0 text-text-muted">
                This institute has not published an admission form yet. Please check back soon.
              </p>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <div className="mb-2 flex items-center justify-between text-sm font-semibold text-text-muted">
                  <span>
                    Section {step + 1} of {groups.length}
                  </span>
                  <span>{progress}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-border">
                  <div className="h-full rounded-full bg-cardinal transition-all" style={{ width: `${progress}%` }} />
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {groups.map((g, i) => (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => setStep(i)}
                      className={`rounded-full px-3 py-1.5 text-xs font-bold ${
                        i === step ? 'bg-cardinal text-white' : 'border border-border bg-white text-ink'
                      }`}
                    >
                      {g.title}
                    </button>
                  ))}
                </div>
              </div>

              {error && (
                <p className="mb-5 rounded-2xl bg-crimson-pale px-4 py-3 text-sm font-bold text-crimson-dark">
                  {error}
                </p>
              )}
              {notice && (
                <p className="mb-5 rounded-2xl bg-cardinal-pale px-4 py-3 text-sm font-bold text-cardinal">{notice}</p>
              )}

              {activeGroup && (
                <Reveal className="glass rounded-[1.6rem] p-7 md:p-9">
                  <span className="eyebrow">Section {String(step + 1).padStart(2, '0')}</span>
                  <h2 className="mb-2">{activeGroup.title}</h2>
                  {activeGroup.description ? (
                    <p className="mb-7 text-text-muted">{activeGroup.description}</p>
                  ) : (
                    <div className="mb-7" />
                  )}

                  <div className="flex flex-col gap-5">
                    {(activeGroup.fields || []).map((field) => (
                      <label key={field.id || field.key} className={labelClass}>
                        <span className="flex items-center gap-2">
                          {field.required ? <span className="h-1.5 w-1.5 rounded-full bg-crimson" /> : null}
                          {field.label}
                          {!field.required ? (
                            <span className="text-xs font-medium text-text-muted">(optional)</span>
                          ) : null}
                        </span>
                        <FieldInput
                          field={field}
                          value={answers[field.key]}
                          disabled={!editable || saving}
                          onChange={(value) => setAnswer(field.key, value)}
                          onUpload={(file) => uploadFile(field, file)}
                        />
                        {field.helpText ? <span className="text-xs font-medium text-text-muted">{field.helpText}</span> : null}
                      </label>
                    ))}
                  </div>

                  <div className="mt-8 flex flex-wrap gap-3">
                    <button
                      type="button"
                      className="btn btn-outline-light"
                      disabled={step === 0}
                      onClick={() => setStep((s) => Math.max(0, s - 1))}
                    >
                      Back
                    </button>
                    {step < groups.length - 1 ? (
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => setStep((s) => Math.min(groups.length - 1, s + 1))}
                      >
                        Next section
                      </button>
                    ) : null}
                    {editable ? (
                      <>
                        <button type="button" className="btn btn-outline" disabled={saving} onClick={saveDraft}>
                          Save progress
                        </button>
                        {step === groups.length - 1 ? (
                          <button type="button" className="btn btn-primary" disabled={saving} onClick={submit}>
                            {saving ? 'Submitting…' : 'Submit application'}
                          </button>
                        ) : null}
                      </>
                    ) : (
                      <p className="m-0 self-center text-sm font-semibold text-text-muted">
                        {appStatus === 'accepted'
                          ? 'You are accepted. Use the student portal for LMS and attendance once classes are assigned.'
                          : appStatus === 'rejected'
                            ? 'This application was rejected. Contact the institute if you have questions.'
                            : 'Submitted — waiting for an admissions officer.'}
                      </p>
                    )}
                  </div>
                </Reveal>
              )}
            </>
          )}
        </div>
      </section>
    </>
  );
}
