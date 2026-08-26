import { useMemo, useState } from 'react';

const labelClass = 'flex flex-col gap-1.5 text-sm font-semibold text-ink';

const strengthMeta = [
  { label: 'Too short', bar: 'bg-crimson/25', text: 'text-crimson' },
  { label: 'Fair', bar: 'bg-crimson', text: 'text-crimson' },
  { label: 'Good', bar: 'bg-cardinal', text: 'text-cardinal' },
  { label: 'Strong', bar: 'bg-cardinal', text: 'text-cardinal' },
];

export function passwordScore(value) {
  if (!value) return 0;
  let score = 0;
  if (value.length >= 6) score += 1;
  if (value.length >= 10) score += 1;
  if (/[A-Za-z]/.test(value) && /\d/.test(value)) score += 1;
  if (/[^A-Za-z0-9]/.test(value)) score += 1;
  return Math.min(score, 3);
}

export function PasswordField({
  label,
  name,
  value,
  onChange,
  autoComplete,
  placeholder,
  error,
  required = true,
  onCaps,
}) {
  const [visible, setVisible] = useState(false);

  return (
    <label className={labelClass}>
      <span className="flex items-center gap-2">
        <span className="h-1.5 w-1.5 rounded-full bg-crimson" />
        {label}
      </span>
      <div className="relative">
        <input
          type={visible ? 'text' : 'password'}
          name={name}
          required={required}
          minLength={required ? 6 : undefined}
          value={value}
          onChange={onChange}
          onKeyUp={(e) => onCaps?.(e.getModifierState?.('CapsLock'))}
          placeholder={placeholder}
          className={`field w-full pr-20 ${error ? 'border-crimson/55' : ''}`}
          autoComplete={autoComplete}
        />
        <button
          type="button"
          className="absolute top-1/2 right-4 -translate-y-1/2 text-sm font-semibold text-cardinal"
          onClick={() => setVisible((v) => !v)}
        >
          {visible ? 'Hide' : 'Show'}
        </button>
      </div>
      {error && <span className="font-medium text-crimson">{error}</span>}
    </label>
  );
}

export function CheckRow({ ok, label }) {
  return (
    <li className="flex items-start gap-3">
      <span
        className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
          ok ? 'bg-cardinal' : 'border border-border bg-white'
        }`}
        aria-hidden="true"
      />
      <span className={ok ? 'text-ink' : 'text-text-muted'}>{label}</span>
    </li>
  );
}

export function StrengthMeter({ value }) {
  const score = passwordScore(value);
  const strength = strengthMeta[score];
  return (
    <div className="mt-3">
      <div className="flex h-1.5 overflow-hidden rounded-full bg-border">
        {[0, 1, 2].map((step) => (
          <span
            key={step}
            className={`flex-1 ${step < score ? strength.bar : 'bg-transparent'} ${step > 0 ? 'ml-1' : ''}`}
          />
        ))}
      </div>
      <p className={`mt-2 mb-0 text-xs font-semibold ${value ? strength.text : 'text-text-muted'}`}>
        {value ? strength.label : 'Password strength'}
      </p>
    </div>
  );
}

export default function ChangePasswordForm({
  requireCurrent = true,
  accountName,
  accountEmail,
  note,
  submitLabel = 'Update password',
  onSubmit,
  onAuthError,
}) {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [caps, setCaps] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const checks = useMemo(
    () => ({
      length: form.newPassword.length >= 6,
      different: !requireCurrent || (Boolean(form.newPassword) && form.newPassword !== form.currentPassword),
      match: Boolean(form.confirmPassword) && form.newPassword === form.confirmPassword,
      mixed: /[A-Za-z]/.test(form.newPassword) && /\d/.test(form.newPassword),
    }),
    [form, requireCurrent]
  );
  const canSubmit =
    checks.length &&
    checks.different &&
    checks.match &&
    (!requireCurrent || form.currentPassword) &&
    !saving;

  const handleChange = (e) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
    setMessage({ type: '', text: '' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!checks.match) {
      setMessage({ type: 'error', text: 'New password and confirmation do not match.' });
      return;
    }
    if (!checks.different) {
      setMessage({ type: 'error', text: 'Choose a password that is different from the current one.' });
      return;
    }
    setSaving(true);
    try {
      const text = await onSubmit({
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      });
      setForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setMessage({ type: 'ok', text: text || 'Password updated.' });
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        onAuthError?.(err);
        return;
      }
      setMessage({ type: 'error', text: err.response?.data?.message || 'Could not update password.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(16rem,0.85fr)]">
      <form onSubmit={handleSubmit} className="glass flex flex-col gap-5 rounded-[1.8rem] p-7 md:p-8">
        {requireCurrent && (
          <PasswordField
            label="Current password"
            name="currentPassword"
            value={form.currentPassword}
            onChange={handleChange}
            autoComplete="current-password"
            placeholder="The password you use to sign in"
            onCaps={setCaps}
          />
        )}
        <div>
          <PasswordField
            label="New password"
            name="newPassword"
            value={form.newPassword}
            onChange={handleChange}
            autoComplete="new-password"
            placeholder="At least 6 characters"
            onCaps={setCaps}
          />
          <StrengthMeter value={form.newPassword} />
        </div>
        <PasswordField
          label="Confirm new password"
          name="confirmPassword"
          value={form.confirmPassword}
          onChange={handleChange}
          autoComplete="new-password"
          placeholder="Type the new password again"
          onCaps={setCaps}
          error={
            form.confirmPassword && form.newPassword !== form.confirmPassword
              ? 'The two new passwords do not match.'
              : ''
          }
        />

        {caps && (
          <p className="m-0 rounded-2xl bg-cardinal-pale px-3 py-2.5 text-sm font-bold text-cardinal">
            Caps Lock is on.
          </p>
        )}

        {message.text && (
          <p
            className={`m-0 rounded-2xl px-3 py-2.5 text-sm font-bold ${
              message.type === 'ok' ? 'bg-cardinal-pale text-cardinal' : 'bg-crimson-pale text-crimson-dark'
            }`}
          >
            {message.text}
          </p>
        )}

        <button type="submit" className="btn btn-primary mt-1" disabled={!canSubmit}>
          {saving ? 'Saving…' : submitLabel}
        </button>
      </form>

      <aside className="flex flex-col gap-4">
        {(accountName || accountEmail) && (
          <div className="glass rounded-[1.6rem] p-6">
            <p className="m-0 text-[0.7rem] font-semibold tracking-[0.16em] text-text-muted uppercase">Account</p>
            <p className="mt-3 mb-1 font-serif text-2xl font-extrabold tracking-tight text-ink">
              {accountName || 'Staff'}
            </p>
            <p className="m-0 break-all text-sm text-text-muted">{accountEmail || '—'}</p>
          </div>
        )}

        <div className="glass rounded-[1.6rem] p-6">
          <p className="m-0 text-[0.7rem] font-semibold tracking-[0.16em] text-text-muted uppercase">Requirements</p>
          <ul className="mt-4 mb-0 flex flex-col gap-3 text-sm font-semibold">
            <CheckRow ok={checks.length} label="At least 6 characters" />
            {requireCurrent && <CheckRow ok={checks.different} label="Different from the current password" />}
            <CheckRow ok={checks.match} label="Confirmation matches" />
            <CheckRow ok={checks.mixed} label="Letters and a number (recommended)" />
          </ul>
        </div>

        {note && (
          <div className="rounded-[1.6rem] border border-border bg-white p-6">
            <p className="m-0 text-sm text-text-muted">{note}</p>
          </div>
        )}
      </aside>
    </div>
  );
}
