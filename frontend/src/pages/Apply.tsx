import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import BrandMark from '../components/BrandMark';
import Magnetic from '../components/Magnetic';
import { getApplicant, signOutApplicant } from '../auth/session';
import { isLockedOrg, isSuspendedError } from '../auth/serviceLock';
import api from '../api/client';
import {
  CNIC_MAX_LENGTH,
  formatCnic,
  formatPhone,
  isCnicField,
  isPhoneField,
  isValidCnic,
  isValidPhone,
  PHONE_MAX_DIGITS,
} from '../lib/cnic';

const statusMeta = {
  not_started: { label: 'Not started', tone: 'bg-slate-100 text-slate-700' },
  in_progress: { label: 'In progress', tone: 'bg-cardinal-pale text-cardinal' },
  submitted: { label: 'Submitted', tone: 'bg-amber-100 text-amber-900' },
  accepted: { label: 'Accepted', tone: 'bg-emerald-100 text-emerald-800' },
  rejected: { label: 'Rejected', tone: 'bg-crimson-pale text-crimson-dark' },
};

const isEmptyAnswer = (field, value) => {
  if (value == null || value === '') return true;
  if (field.type === 'file') return !(value && value.url);
  return false;
};

const fieldFilled = (field, answers) => {
  const value = answers[field.key];
  if (isEmptyAnswer(field, value)) return false;
  if (isCnicField(field)) return isValidCnic(value);
  if (isPhoneField(field)) return isValidPhone(value);
  return true;
};

function FieldInput({ field, value, disabled, onChange, onUpload, uploading }) {
  const [dragging, setDragging] = useState(false);
  const inputId = `field-${field.key}`;

  if (field.type === 'textarea') {
    return (
      <textarea
        id={inputId}
        className="field min-h-[120px] resize-y"
        disabled={disabled}
        required={field.required}
        placeholder={field.placeholder || undefined}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  if (field.type === 'select') {
    return (
      <select
        id={inputId}
        className="field"
        disabled={disabled}
        required={field.required}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Choose an option…</option>
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
    const onPick = (picked) => {
      if (picked) onUpload(picked);
    };
    return (
      <div
        className={`relative overflow-hidden rounded-[1.25rem] border border-dashed px-4 py-5 transition ${
          dragging
            ? 'border-cardinal bg-cardinal-pale/60'
            : file?.url
              ? 'border-cardinal/30 bg-cardinal-pale/35'
              : 'border-border bg-white/70'
        }`}
        onDragEnter={(e) => {
          e.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (disabled) return;
          onPick(e.dataTransfer.files?.[0]);
        }}
      >
        {file?.url ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="m-0 truncate text-sm font-bold text-ink">{file.name || 'Uploaded file'}</p>
              <a href={file.url} target="_blank" rel="noreferrer" className="text-sm font-semibold text-cardinal">
                View upload
              </a>
            </div>
            {!disabled && (
              <label className="btn btn-outline-light cursor-pointer py-2 text-sm">
                Replace
                <input
                  type="file"
                  accept={field.accept || 'image/*,.pdf'}
                  className="absolute h-px w-px overflow-hidden opacity-0"
                  disabled={disabled || uploading}
                  onChange={(e) => {
                    onPick(e.target.files?.[0]);
                    e.target.value = '';
                  }}
                />
              </label>
            )}
          </div>
        ) : (
          <label className={`relative flex cursor-pointer flex-col items-center gap-2 text-center ${disabled ? 'pointer-events-none opacity-60' : ''}`}>
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-cardinal-pale text-cardinal">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M12 16V4m0 0l-4 4m4-4l4 4M4 16.5V18a2 2 0 002 2h12a2 2 0 002-2v-1.5"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <span className="text-sm font-bold text-ink">
              {uploading ? 'Uploading…' : dragging ? 'Drop to upload' : 'Tap to upload or drag a file'}
            </span>
            <span className="text-xs font-medium text-text-muted">
              Max {field.maxFileMb || 5} MB · {field.accept || 'images or PDF'}
            </span>
            <input
              type="file"
              accept={field.accept || 'image/*,.pdf'}
              className="absolute inset-0 cursor-pointer opacity-0"
              disabled={disabled || uploading}
              onChange={(e) => {
                onPick(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
          </label>
        )}
      </div>
    );
  }

  if (isCnicField(field)) {
    return (
      <input
        id={inputId}
        className="field tracking-wide"
        type="text"
        inputMode="numeric"
        autoComplete="off"
        disabled={disabled}
        required={field.required}
        maxLength={CNIC_MAX_LENGTH}
        placeholder={field.placeholder || '34209-9090987-0'}
        value={formatCnic(value || '')}
        onChange={(e) => onChange(formatCnic(e.target.value))}
      />
    );
  }

  if (isPhoneField(field)) {
    return (
      <input
        id={inputId}
        className="field tracking-wide"
        type="tel"
        inputMode="numeric"
        autoComplete="tel"
        disabled={disabled}
        required={field.required}
        maxLength={PHONE_MAX_DIGITS}
        placeholder={field.placeholder || '03001234567'}
        value={formatPhone(value || '')}
        onChange={(e) => onChange(formatPhone(e.target.value))}
      />
    );
  }

  const inputType =
    field.type === 'email' || field.type === 'number' || field.type === 'date' ? field.type : 'text';

  return (
    <input
      id={inputId}
      className="field"
      type={inputType}
      disabled={disabled}
      required={field.required}
      placeholder={field.placeholder || undefined}
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

function sectionStats(group, answers) {
  const fields = group?.fields || [];
  const required = fields.filter((f) => f.required);
  const requiredDone = required.filter((f) => fieldFilled(f, answers)).length;
  const optionalDone = fields.filter((f) => !f.required && fieldFilled(f, answers)).length;
  const complete = required.length === 0 || requiredDone === required.length;
  return {
    required: required.length,
    requiredDone,
    optionalDone,
    total: fields.length,
    complete,
  };
}

export default function Apply() {
  const navigate = useNavigate();
  const panelRef = useRef(null);
  const [applicant, setApplicant] = useState(() => getApplicant());
  const [appStatus, setAppStatus] = useState('not_started');
  const [form, setForm] = useState({ published: false, intro: '', groups: [] });
  const [answers, setAnswers] = useState({});
  const [editable, setEditable] = useState(true);
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingKey, setUploadingKey] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [shakeStep, setShakeStep] = useState(false);

  const groups = form.groups || [];
  const activeGroup = groups[step] || null;
  const org = applicant?.organization || {};
  const status = statusMeta[appStatus] || statusMeta.not_started;

  const groupStats = useMemo(
    () => groups.map((group) => sectionStats(group, answers)),
    [groups, answers]
  );

  const overall = useMemo(() => {
    const requiredFields = groups.flatMap((g) => (g.fields || []).filter((f) => f.required));
    const done = requiredFields.filter((f) => fieldFilled(f, answers)).length;
    const pct = requiredFields.length ? Math.round((done / requiredFields.length) * 100) : 0;
    return { done, total: requiredFields.length, pct };
  }, [groups, answers]);

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
    if (!current.organization?.id && !current.organization?.slug) {
      navigate('/apply', { replace: true });
      return;
    }
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

  useEffect(() => {
    if (!notice) return undefined;
    const timer = window.setTimeout(() => setNotice(''), 3200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  if (!applicant) return null;

  const setAnswer = (key, value) => {
    setAnswers((prev) => ({ ...prev, [key]: value }));
    setError('');
  };

  const goToStep = (index) => {
    setStep(index);
    setError('');
    window.requestAnimationFrame(() => {
      panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const validateStep = (index = step) => {
    const group = groups[index];
    if (!group) return true;
    for (const field of group.fields || []) {
      if (!field.required) continue;
      const value = answers[field.key];
      if (isEmptyAnswer(field, value)) {
        setError(`Please complete “${field.label}” before continuing.`);
        return false;
      }
      if (isCnicField(field) && !isValidCnic(value)) {
        setError(`“${field.label}” must look like 34209-9090987-0.`);
        return false;
      }
      if (isPhoneField(field) && !isValidPhone(value)) {
        setError(`“${field.label}” must be an 11-digit mobile number.`);
        return false;
      }
    }
    return true;
  };

  const goNext = () => {
    if (!editable) {
      goToStep(Math.min(groups.length - 1, step + 1));
      return;
    }
    if (!validateStep(step)) {
      setShakeStep(true);
      window.setTimeout(() => setShakeStep(false), 420);
      return;
    }
    goToStep(Math.min(groups.length - 1, step + 1));
  };

  const uploadFile = async (field, file) => {
    setUploadingKey(field.key);
    setError('');
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const res = await api.post(
        '/applications/me/files',
        { fieldKey: field.key, file: dataUrl, name: file.name },
        { authScope: 'applicant' }
      );
      setAnswer(field.key, res.data);
      setNotice(`${field.label} uploaded`);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not upload that file.');
    } finally {
      setUploadingKey('');
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
      setNotice('Progress saved');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save progress.');
    } finally {
      setSaving(false);
    }
  };

  const submit = async () => {
    for (let i = 0; i < groups.length; i += 1) {
      if (!validateStep(i)) {
        goToStep(i);
        setShakeStep(true);
        window.setTimeout(() => setShakeStep(false), 420);
        return;
      }
    }
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const res = await api.post('/applications/me/submit', { answers }, { authScope: 'applicant' });
      setAppStatus(res.data?.status || 'submitted');
      setAnswers(res.data?.answers || answers);
      setEditable(false);
      setNotice('Application submitted for review');
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

  const activeStats = activeGroup ? sectionStats(activeGroup, answers) : null;

  return (
    <div className="relative min-h-svh overflow-x-hidden bg-bg">
      <div className="hero-aurora" aria-hidden="true" />
      <div className="hero-aurora hero-aurora-b" aria-hidden="true" />
      <div className="orb -top-10 left-[8%] h-64 w-64 bg-cardinal/15" />
      <div className="orb right-[6%] bottom-[20%] h-72 w-72 bg-cardinal-light/20" />

      <header className="sticky top-0 z-20 border-b border-border/70 bg-bg/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3.5 sm:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <BrandMark org={org} size={42} />
            <div className="min-w-0 leading-tight">
              <strong className="block truncate font-serif text-sm font-bold text-ink">
                {org.title || org.name || 'Admissions'}
              </strong>
              <p className="m-0 truncate text-[0.7rem] font-medium text-text-muted">
                {applicant.name || applicant.email}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`hidden rounded-full px-3 py-1.5 text-xs font-bold sm:inline ${status.tone}`}>
              {status.label}
            </span>
            <button type="button" className="btn btn-outline-light py-2 text-sm" onClick={handleSignOut}>
              Sign out
            </button>
          </div>
        </div>
        {!loading && groups.length > 0 && editable && (
          <div className="h-1 bg-border/70">
            <motion.div
              className="h-full bg-gradient-to-r from-cardinal to-cardinal-light"
              initial={false}
              animate={{ width: `${overall.pct}%` }}
              transition={{ type: 'spring', stiffness: 120, damping: 20 }}
            />
          </div>
        )}
      </header>

      <main className="relative z-1 mx-auto max-w-6xl px-5 py-8 sm:px-8 sm:py-12">
        <div className="mb-8 max-w-2xl">
          <span className="eyebrow">Admission application</span>
          <h1 className="mt-2 mb-3 text-[clamp(1.9rem,4vw,3rem)] tracking-tight text-ink">
            {editable ? 'Tell us about you' : 'Your application'}
          </h1>
          <p className="m-0 text-base text-text-muted sm:text-lg">
            {form.intro ||
              'Move through each section at your pace. Required fields are marked. You can save and return anytime before submitting.'}
          </p>
        </div>

        {loading ? (
          <div className="glass rounded-[1.8rem] p-10 text-center text-text-muted">Preparing your form…</div>
        ) : !groups.length ? (
          <div className="glass glow-border rounded-[1.8rem] p-8 md:p-10">
            <h3 className="mb-2">Form not ready</h3>
            <p className="m-0 text-text-muted">
              This institute has not published an admission form yet. Please check back soon.
            </p>
          </div>
        ) : (
          <>
            {!editable && (
              <motion.div
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass glow-border mx-auto mb-8 max-w-xl rounded-[1.8rem] p-8 text-center md:p-12"
              >
                <span className={`mx-auto mb-5 inline-flex rounded-full px-4 py-2 text-sm font-bold ${status.tone}`}>
                  {status.label}
                </span>
                <h2 className="mb-3">
                  {appStatus === 'accepted'
                    ? 'Welcome aboard'
                    : appStatus === 'rejected'
                      ? 'Application closed'
                      : 'Submitted for review'}
                </h2>
                <p className="mx-auto mb-8 max-w-md text-text-muted">
                  {appStatus === 'accepted'
                    ? 'You are accepted. Open the student portal for LMS and attendance once your classes are assigned.'
                    : appStatus === 'rejected'
                      ? 'This application was rejected. Contact the institute if you have questions.'
                      : 'An admissions officer will review your answers and documents. We will update your status here.'}
                </p>
                <div className="flex flex-wrap justify-center gap-3">
                  {appStatus === 'accepted' ? (
                    <Magnetic>
                      <Link to="/student" className="btn btn-primary">
                        Open student portal
                      </Link>
                    </Magnetic>
                  ) : null}
                  <button type="button" className="btn btn-outline" onClick={() => goToStep(0)}>
                    Review answers
                  </button>
                </div>
              </motion.div>
            )}

            <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
              <aside className="lg:sticky lg:top-24 lg:self-start">
                <div className="glass rounded-[1.5rem] p-4 sm:p-5">
                  <p className="mb-3 text-[0.7rem] font-semibold tracking-[0.16em] text-text-muted uppercase">
                    Sections
                  </p>
                  <ol className="m-0 flex list-none flex-row gap-2 overflow-x-auto p-0 lg:flex-col lg:overflow-visible">
                    {groups.map((group, index) => {
                      const stats = groupStats[index];
                      const active = index === step;
                      return (
                        <li key={group.id} className="min-w-[9.5rem] flex-1 lg:min-w-0 lg:flex-none">
                          <button
                            type="button"
                            onClick={() => {
                              if (editable && index > step) {
                                for (let i = step; i < index; i += 1) {
                                  if (!validateStep(i)) {
                                    goToStep(i);
                                    setShakeStep(true);
                                    window.setTimeout(() => setShakeStep(false), 420);
                                    return;
                                  }
                                }
                              }
                              goToStep(index);
                            }}
                            className={`flex w-full items-start gap-3 rounded-[1.1rem] px-3 py-3 text-left transition ${
                              active
                                ? 'bg-cardinal text-white shadow-[0_14px_30px_-18px_rgba(15,92,92,0.8)]'
                                : 'bg-white/70 text-ink hover:bg-white'
                            }`}
                          >
                            <span
                              className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                                active
                                  ? 'bg-white/20 text-white'
                                  : stats.complete
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-cardinal-pale text-cardinal'
                              }`}
                            >
                              {stats.complete && !active ? '✓' : String(index + 1).padStart(2, '0')}
                            </span>
                            <span className="min-w-0">
                              <strong className="block truncate text-sm">{group.title}</strong>
                              <span className={`mt-0.5 block text-xs ${active ? 'text-white/75' : 'text-text-muted'}`}>
                                {stats.required
                                  ? `${stats.requiredDone}/${stats.required} required`
                                  : `${stats.total} fields`}
                              </span>
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ol>
                  {editable && (
                    <p className="mt-4 mb-0 text-xs font-medium text-text-muted">
                      {overall.done} of {overall.total} required answers complete
                    </p>
                  )}
                </div>
              </aside>

              <div ref={panelRef} className="scroll-mt-28 min-w-0">
                <AnimatePresence mode="wait">
                  {activeGroup && (
                    <motion.section
                      key={activeGroup.id}
                      initial={{ opacity: 0, y: 18 }}
                      animate={{ opacity: 1, y: 0, x: shakeStep ? [0, -8, 8, -5, 5, 0] : 0 }}
                      exit={{ opacity: 0, y: -12 }}
                      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                      className="glass glow-border rounded-[1.8rem] p-6 sm:p-8 md:p-10"
                    >
                      <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
                        <div className="max-w-xl">
                          <span className="eyebrow">
                            Step {step + 1} of {groups.length}
                          </span>
                          <h2 className="mt-2 mb-2 text-[1.7rem] md:text-[2rem]">{activeGroup.title}</h2>
                          {activeGroup.description ? (
                            <p className="m-0 text-text-muted">{activeGroup.description}</p>
                          ) : null}
                        </div>
                        {activeStats && (
                          <div className="rounded-2xl bg-bg/80 px-4 py-3 text-right">
                            <p className="m-0 text-[0.65rem] font-semibold tracking-[0.14em] text-text-muted uppercase">
                              This section
                            </p>
                            <p className="m-0 mt-1 text-sm font-bold text-ink">
                              {activeStats.complete
                                ? 'Ready'
                                : `${activeStats.requiredDone}/${activeStats.required} required`}
                            </p>
                          </div>
                        )}
                      </div>

                      {(error || notice) && (
                        <div className="mb-6 space-y-3">
                          {error && (
                            <p className="m-0 rounded-2xl bg-crimson-pale px-4 py-3 text-sm font-bold text-crimson-dark">
                              {error}
                            </p>
                          )}
                          {notice && (
                            <p className="m-0 rounded-2xl bg-cardinal-pale px-4 py-3 text-sm font-bold text-cardinal">
                              {notice}
                            </p>
                          )}
                        </div>
                      )}

                      <div className="grid gap-5 sm:grid-cols-2">
                        {(activeGroup.fields || []).map((field, index) => {
                          const wide =
                            field.type === 'textarea' ||
                            field.type === 'file' ||
                            field.type === 'select' ||
                            (activeGroup.fields || []).length === 1;
                          return (
                            <motion.label
                              key={field.id || field.key}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: Math.min(index * 0.04, 0.2) }}
                              className={`flex flex-col gap-2 ${wide ? 'sm:col-span-2' : ''}`}
                            >
                              <span className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink">
                                {field.label}
                                {field.required ? (
                                  <span className="rounded-full bg-crimson-pale px-2 py-0.5 text-[0.65rem] font-bold tracking-wide text-crimson uppercase">
                                    Required
                                  </span>
                                ) : (
                                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[0.65rem] font-bold tracking-wide text-slate-600 uppercase">
                                    Optional
                                  </span>
                                )}
                              </span>
                              <FieldInput
                                field={field}
                                value={answers[field.key]}
                                disabled={saving || !editable}
                                uploading={uploadingKey === field.key}
                                onChange={(value) => setAnswer(field.key, value)}
                                onUpload={(file) => uploadFile(field, file)}
                              />
                              {field.helpText ? (
                                <span className="text-xs font-medium text-text-muted">{field.helpText}</span>
                              ) : null}
                            </motion.label>
                          );
                        })}
                      </div>

                      <div className="mt-9 flex flex-col gap-3 border-t border-border/80 pt-6 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                        <button
                          type="button"
                          className="btn btn-outline-light order-2 sm:order-1"
                          disabled={step === 0}
                          onClick={() => goToStep(Math.max(0, step - 1))}
                        >
                          Back
                        </button>
                        <div className="order-1 flex flex-col gap-3 sm:order-2 sm:flex-row sm:flex-wrap">
                          {editable ? (
                            <>
                              <button type="button" className="btn btn-outline" disabled={saving} onClick={saveDraft}>
                                {saving ? 'Saving…' : 'Save progress'}
                              </button>
                              {step < groups.length - 1 ? (
                                <Magnetic>
                                  <button type="button" className="btn btn-primary" onClick={goNext}>
                                    Continue
                                  </button>
                                </Magnetic>
                              ) : (
                                <Magnetic>
                                  <button type="button" className="btn btn-primary" disabled={saving} onClick={submit}>
                                    {saving ? 'Submitting…' : 'Submit application'}
                                  </button>
                                </Magnetic>
                              )}
                            </>
                          ) : (
                            step < groups.length - 1 && (
                              <button type="button" className="btn btn-primary" onClick={goNext}>
                                Next section
                              </button>
                            )
                          )}
                        </div>
                      </div>
                    </motion.section>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
