import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import api from '../api/client';

const formatCount = (count) => {
  if (count > 99) return '99+';
  return String(count);
};

export default function NotificationBell({ authScope = 'staff', className = '' }) {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState(null);
  const [items, setItems] = useState([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const rootRef = useRef(null);

  const load = async () => {
    try {
      const base = authScope === 'platform' ? '/platform' : '/staff';
      const [listRes, countRes] = await Promise.all([
        api.get(`${base}/notifications`, { authScope }),
        api.get(`${base}/notifications/unread-count`, { authScope }),
      ]);
      setItems(Array.isArray(listRes.data) ? listRes.data : []);
      setCount(Number(countRes.data?.count) || 0);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    load();
    const timer = window.setInterval(load, 45000);
    return () => window.clearInterval(timer);
  }, [authScope]);

  useEffect(() => {
    const onDoc = (e) => {
      if (!rootRef.current?.contains(e.target)) {
        setOpen(false);
        setDetail(null);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const openItem = async (item) => {
    setLoading(true);
    try {
      const base = authScope === 'platform' ? '/platform' : '/staff';
      const res = await api.get(`${base}/notifications/${item.id}`, { authScope });
      setDetail(res.data);
      if (!item.read) {
        await api.put(`${base}/notifications/${item.id}/read`, {}, { authScope });
        await load();
      }
    } finally {
      setLoading(false);
    }
  };

  const markAllRead = async () => {
    const base = authScope === 'platform' ? '/platform' : '/staff';
    await api.put(`${base}/notifications/read-all`, {}, { authScope });
    await load();
  };

  return (
    <div className={`notify-bell ${className}`} ref={rootRef}>
      <button
        type="button"
        className="notify-bell-btn"
        aria-label="Notifications"
        onClick={() => {
          setOpen((v) => !v);
          setDetail(null);
          if (!open) load();
        }}
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
          <path
            d="M15 17H9l-1 2h8l-1-2Zm-1-13a4 4 0 00-8 0v4.1c0 .5-.2 1-.5 1.4L4 13.5V15h16v-1.5l-1.5-4.1c-.3-.4-.5-.9-.5-1.4V4Z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
        </svg>
        {count > 0 ? <span className="notify-bell-badge">{formatCount(count)}</span> : null}
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            className="notify-panel"
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
          >
            <div className="notify-panel-head">
              <strong>{detail ? 'Notification' : 'Notifications'}</strong>
              <div className="flex gap-2">
                {detail ? (
                  <button type="button" className="notify-link" onClick={() => setDetail(null)}>
                    Back
                  </button>
                ) : (
                  <button type="button" className="notify-link" onClick={markAllRead}>
                    Mark all read
                  </button>
                )}
              </div>
            </div>

            {detail ? (
              <div className="notify-detail">
                <p className="notify-detail-title">{detail.title}</p>
                <p className="notify-detail-body">{detail.body}</p>
                <p className="notify-detail-time">{new Date(detail.createdAt).toLocaleString()}</p>
              </div>
            ) : loading ? (
              <p className="notify-empty">Loading…</p>
            ) : items.length === 0 ? (
              <p className="notify-empty">No notifications yet.</p>
            ) : (
              <ul className="notify-list">
                {items.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      className={`notify-item ${item.read ? '' : 'is-unread'}`}
                      onClick={() => openItem(item)}
                    >
                      <strong>{item.title}</strong>
                      <span>{item.body}</span>
                      <small>{new Date(item.createdAt).toLocaleString()}</small>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
