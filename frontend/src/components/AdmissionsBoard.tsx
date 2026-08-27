import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { ADMIN_BASE, FACULTY_BASE } from '../admin/paths';
import api from '../api/client';
import { canDecideAdmissions } from '../data/roles';
import { countDocuments, initials, statusClass, statusLabel } from '../lib/admissionReview';

const ease = [0.22, 1, 0.36, 1] as const;

const SECTIONS = [
  {
    key: 'pending',
    label: 'Pending',
    description: 'Submitted applications waiting for an officer decision.',
    match: (status) => status === 'submitted',
    tone: 'is-pending',
    icon: '⏳',
  },
  {
    key: 'draft',
    label: 'In progress',
    description: 'Students still filling the form.',
    match: (status) => ['not_started', 'in_progress'].includes(status),
    tone: 'is-draft',
    icon: '✏️',
  },
  {
    key: 'accepted',
    label: 'Accepted',
    description: 'Accepted students are added to the student roster for LMS and attendance enrollment.',
    match: (status) => status === 'accepted',
    tone: 'is-accepted',
    icon: '✓',
  },
  {
    key: 'rejected',
    label: 'Rejected',
    description: 'Rejected applications. Officers can accept them later if circumstances change.',
    match: (status) => status === 'rejected',
    tone: 'is-rejected',
    icon: '✕',
  },
];

function AnimatedCount({ value }: { value: number }) {
  const [display, setDisplay] = useState(value);
  useEffect(() => {
    const from = display;
    const to = value;
    if (from === to) return undefined;
    const start = performance.now();
    const duration = 500;
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      setDisplay(from + (to - from) * (1 - (1 - t) ** 3));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return <>{Math.round(display)}</>;
}

export default function AdmissionsBoard({ authScope, role }) {
  const reduce = useReducedMotion();
  const [rows, setRows] = useState([]);
  const [section, setSection] = useState('pending');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const canDecide = canDecideAdmissions(role);
  const reviewBase = authScope === 'admin' ? `${ADMIN_BASE}/admissions/review` : `${FACULTY_BASE}/admissions/review`;

  useEffect(() => {
    api
      .get('/applications', { authScope })
      .then((res) => setRows(Array.isArray(res.data) ? res.data : []))
      .catch((err) => setError(err.response?.data?.message || 'Could not load student records.'))
      .finally(() => setLoading(false));
  }, [authScope]);

  const activeSection = SECTIONS.find((item) => item.key === section) || SECTIONS[0];

  const counts = useMemo(
    () =>
      SECTIONS.reduce((acc, item) => {
        acc[item.key] = rows.filter((row) => item.match(row.status)).length;
        return acc;
      }, {}),
    [rows]
  );

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (!activeSection.match(row.status)) return false;
      if (!q) return true;
      const name = row.student?.name?.toLowerCase() || '';
      const email = row.student?.email?.toLowerCase() || '';
      return name.includes(q) || email.includes(q);
    });
  }, [rows, activeSection, query]);

  return (
    <div>
      {!canDecide && (
        <motion.p
          className="admit-notice mb-5"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {role === 'admin'
            ? 'Organisation admins can open or close admissions and view records. Only admissions officers can accept or reject.'
            : 'View-only access. You can open applications but cannot accept or reject.'}
        </motion.p>
      )}

      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {SECTIONS.map((item, i) => (
          <motion.button
            key={item.key}
            type="button"
            onClick={() => setSection(item.key)}
            className={`admit-tab ${item.tone} ${section === item.key ? 'is-active' : ''}`}
            initial={reduce ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06, duration: 0.35, ease }}
            whileHover={reduce ? undefined : { y: -2 }}
            whileTap={reduce ? undefined : { scale: 0.98 }}
          >
            <span className="admit-tab-icon" aria-hidden="true">
              {item.icon}
            </span>
            <span className="admit-tab-copy">
              <span className="admit-tab-label">{item.label}</span>
              <span className="admit-tab-count">
                <AnimatedCount value={counts[item.key] || 0} />
              </span>
            </span>
          </motion.button>
        ))}
      </div>

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <p className="m-0 max-w-xl text-sm text-text-muted">{activeSection.description}</p>
        <label className="admit-search">
          <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 text-text-muted" aria-hidden="true">
            <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" />
            <path d="M20 20l-3-3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          <input
            placeholder="Search name or email…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
      </div>

      {error && <p className="admit-error mb-5">{error}</p>}

      {loading ? (
        <div className="admit-empty">
          <div className="admit-spinner" aria-hidden="true" />
          <p className="m-0">Loading student records…</p>
        </div>
      ) : filteredRows.length === 0 ? (
        <div className="admit-empty">
          <p className="m-0 text-lg font-bold text-ink">No {activeSection.label.toLowerCase()} applications</p>
          <p className="m-0 mt-1 text-text-muted">
            {query ? 'Try a different search or switch tabs.' : 'Switch tabs to see other groups.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filteredRows.map((row, i) => {
            const files = countDocuments(row.answers);
            return (
              <motion.article
                key={row.id}
                className="admit-card"
                initial={reduce ? false : { opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04, duration: 0.35, ease }}
                whileHover={reduce ? undefined : { y: -4, transition: { duration: 0.2 } }}
              >
                <div className="admit-card-head">
                  <span className="admit-avatar">{initials(row.student?.name)}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="m-0 truncate text-base font-bold text-ink">{row.student?.name || 'Applicant'}</h3>
                      <span className={`admit-status ${statusClass[row.status]}`}>{statusLabel[row.status]}</span>
                    </div>
                    <p className="m-0 mt-0.5 truncate text-sm text-text-muted">{row.student?.email}</p>
                  </div>
                </div>
                <div className="admit-card-meta">
                  <span>{files ? `${files} document${files === 1 ? '' : 's'}` : 'No documents'}</span>
                  {row.submittedAt ? (
                    <span>Submitted {new Date(row.submittedAt).toLocaleDateString()}</span>
                  ) : (
                    <span>Not submitted</span>
                  )}
                </div>
                <Link to={`${reviewBase}/${row.id}`} className="btn btn-primary w-full py-2.5 text-sm">
                  Open student file →
                </Link>
              </motion.article>
            );
          })}
        </div>
      )}
    </div>
  );
}
